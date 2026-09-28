import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LoginRequestSchema } from '@mindset/shared';
import {
  verifyPassphraseTimingSafe,
  generateSessionToken,
  hashSessionToken,
  DUMMY_ARGON2_HASH,
} from '../auth/service';
import { AuthRepository } from '../db/repositories/auth.repository';
import { AppEnv } from '../config/env';

const SESSION_COOKIE_NAME = 'mindset_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authRepo = (app as any).authRepo as AuthRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (app as any).env as AppEnv;

  // POST /api/v1/auth/login
  app.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
          errorResponseBuilder: () => ({
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many login attempts. Please try again in 15 minutes.',
            },
          }),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = LoginRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid login payload',
            details: parseResult.error.flatten(),
          },
        });
      }

      const { passphrase } = parseResult.data;
      const credential = await authRepo.getCredential();

      // Constant-time verification to prevent user/timing enumeration attacks
      const targetHash = credential ? credential.passphraseHash : DUMMY_ARGON2_HASH;
      const isValid = await verifyPassphraseTimingSafe(passphrase, targetHash);

      if (!isValid || !credential) {
        return reply.status(401).send({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid passphrase',
          },
        });
      }

      // Generate cryptographically secure session token
      const rawToken = generateSessionToken();
      const tokenHash = hashSessionToken(rawToken);
      const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();

      const user = await authRepo.getUser();
      if (!user) {
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'User record missing',
          },
        });
      }

      await authRepo.createSession(
        user.id,
        tokenHash,
        expiresAt,
        request.headers['user-agent'],
        request.ip
      );

      // Set HttpOnly, SameSite=Lax session cookie
      reply.setCookie(SESSION_COOKIE_NAME, rawToken, {
        path: '/',
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE_SECONDS,
      });

      return reply.send({
        user: {
          id: user.id,
        },
      });
    }
  );

  // POST /api/v1/auth/logout
  app.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const rawToken = request.cookies[SESSION_COOKIE_NAME];
    if (rawToken) {
      const tokenHash = hashSessionToken(rawToken);
      await authRepo.deleteSession(tokenHash);
    }

    reply.clearCookie(SESSION_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return reply.send({ success: true });
  });

  // GET /api/v1/auth/me
  app.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const rawToken = request.cookies[SESSION_COOKIE_NAME];
    if (!rawToken) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
      });
    }

    const tokenHash = hashSessionToken(rawToken);
    const session = await authRepo.getSessionByHashedToken(tokenHash);

    if (!session) {
      reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session invalid or expired',
        },
      });
    }

    if (new Date(session.expiresAt) < new Date()) {
      await authRepo.deleteSession(tokenHash);
      reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session has expired',
        },
      });
    }

    return reply.send({
      authenticated: true,
      user: {
        id: session.userId,
      },
    });
  });
}

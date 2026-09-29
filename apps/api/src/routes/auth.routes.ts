import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LoginRequestSchema, SetupRequestSchema } from '@mindset/shared';
import {
  hashPassphrase,
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

  // GET /api/v1/auth/status — Checks whether first-run setup is required
  app.get('/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    const credential = await authRepo.getCredential();
    const setupRequired = !credential;
    return reply.send({
      setupRequired,
      data: { setupRequired },
    });
  });

  // POST /api/v1/auth/setup — One-time first-run passphrase setup
  app.post('/setup', async (request: FastifyRequest, reply: FastifyReply) => {
    const existingCred = await authRepo.getCredential();
    if (existingCred) {
      return reply.status(409).send({
        error: {
          code: 'SETUP_ALREADY_COMPLETED',
          message: 'Initial passphrase setup has already been completed.',
        },
      });
    }

    const parseResult = SetupRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid setup payload. Passphrase must be at least 8 characters.',
          details: parseResult.error.flatten(),
        },
      });
    }

    const { passphrase } = parseResult.data;
    const hash = await hashPassphrase(passphrase);
    const { userId } = await authRepo.ensureUserExists(hash);

    // Create initial authenticated session
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();

    await authRepo.createSession(
      userId,
      tokenHash,
      expiresAt,
      request.headers['user-agent'],
      request.ip
    );

    reply.setCookie(SESSION_COOKIE_NAME, rawToken, {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return reply.status(201).send({
      user: { id: userId },
      message: 'Setup completed successfully',
    });
  });

  // POST /api/v1/auth/login
  app.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
          errorResponseBuilder: () => {
            const err = new Error('Too many login attempts. Please try again in 15 minutes.');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (err as any).statusCode = 429;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (err as any).code = 'RATE_LIMIT_EXCEEDED';
            return err;
          },
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

  // POST /api/v1/auth/logout-all — Invalidate all sessions
  app.post('/logout-all', async (_request: FastifyRequest, reply: FastifyReply) => {
    await authRepo.deleteAllSessions();

    reply.clearCookie(SESSION_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return reply.send({ success: true, message: 'All sessions invalidated' });
  });

  // POST /api/v1/auth/dev-reset — Development-only helper to reset credentials if forgotten
  app.post('/dev-reset', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (env.NODE_ENV !== 'development') {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Development reset is only available in development mode',
        },
      });
    }

    await authRepo.resetCredentials();
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return reply.send({
      success: true,
      message: 'Workspace credentials reset. You can now perform first-run setup.',
    });
  });

  // Handler for /me and /session
  const getSessionHandler = async (request: FastifyRequest, reply: FastifyReply) => {
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
  };

  // GET /api/v1/auth/me and GET /api/v1/auth/session
  app.get('/me', getSessionHandler);
  app.get('/session', getSessionHandler);
}

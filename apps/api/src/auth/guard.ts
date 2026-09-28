import { FastifyRequest, FastifyReply } from 'fastify';
import { hashSessionToken } from './service';
import { AuthRepository } from '../db/repositories/auth.repository';

export const SESSION_COOKIE_NAME = 'mindset_session';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authRepo = (request.server as any).authRepo as AuthRepository;
  const rawToken = request.cookies[SESSION_COOKIE_NAME];

  if (!rawToken) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
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

  // Attach authenticated user id to request
  (request as any).userId = session.userId;
}

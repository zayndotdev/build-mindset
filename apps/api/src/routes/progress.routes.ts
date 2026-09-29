import { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../auth/guard';

export const progressRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/progress/overview
  app.get('/overview', { preHandler: [requireAuth] }, async (_req, reply) => {
    const overview = await (app as any).sessionRepo.getProgressOverview();
    return reply.status(200).send({
      success: true,
      data: overview,
    });
  });

  // GET /api/v1/progress/history
  app.get('/history', { preHandler: [requireAuth] }, async (req, reply) => {
    const limit = Number((req.query as any)?.limit) || 30;
    const history = await (app as any).sessionRepo.getSessionHistory(limit);
    return reply.status(200).send({
      success: true,
      data: history,
    });
  });

  // GET /api/v1/progress/sessions/:id
  app.get('/sessions/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sessionDetails = await (app as any).sessionRepo.getSessionWithDetails(id);

    if (!sessionDetails) {
      return reply.status(404).send({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session with ID ${id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: sessionDetails,
    });
  });
};

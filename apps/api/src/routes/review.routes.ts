import { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../auth/guard';
import { calculateSM2 } from '@mindset/learning';

export const reviewRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/reviews/due
  app.get('/due', { preHandler: [requireAuth] }, async (_req, reply) => {
    const dueReviews = await (app as any).sessionRepo.getDueReviewsWithTopics();
    return reply.status(200).send({
      success: true,
      data: dueReviews,
    });
  });

  // GET /api/v1/reviews/stats
  app.get('/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const stats = await (app as any).sessionRepo.getReviewStats();
    return reply.status(200).send({
      success: true,
      data: stats,
    });
  });

  // POST /api/v1/reviews/:id/answer
  app.post('/:id/answer', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { quality?: number } | undefined;

    const quality = Number(body?.quality);
    if (isNaN(quality) || quality < 1 || quality > 4) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_QUALITY_SCORE',
          message: 'Quality score must be an integer between 1 and 4 (1=Forgot, 2=Hard, 3=Good, 4=Easy)',
        },
      });
    }

    const item = await (app as any).sessionRepo.getReviewItem(id);
    if (!item) {
      return reply.status(404).send({
        error: {
          code: 'REVIEW_ITEM_NOT_FOUND',
          message: `Review item with ID ${id} not found`,
        },
      });
    }

    // Calculate next SM-2 schedule
    const currentState = {
      easeFactor: item.easeFactor,
      intervalDays: item.intervalDays,
      repetitions: item.repetitions,
      nextDue: item.nextDue,
    };

    const nextState = calculateSM2(currentState, quality);

    const updated = await (app as any).sessionRepo.updateReviewItem(id, {
      easeFactor: nextState.easeFactor,
      intervalDays: nextState.intervalDays,
      repetitions: nextState.repetitions,
      nextDue: nextState.nextDue,
      lastQuality: quality,
      lastReviewed: nextState.lastReviewed || new Date().toISOString(),
    });

    return reply.status(200).send({
      success: true,
      data: updated,
    });
  });
};

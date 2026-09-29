import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../auth/guard';
import { TopicRepository } from '../db/repositories/topic.repository';

export async function topicRoutes(app: FastifyInstance): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topicRepo = (app as any).topicRepo as TopicRepository;

  // GET /api/v1/topics
  app.get('/', { preHandler: [requireAuth] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const topics = await topicRepo.listTopics();
    return reply.send({ topics });
  });

  // GET /api/v1/topics/:id
  app.get('/:id', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const topic = await topicRepo.getTopicById(id);
    if (!topic) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: `Topic ${id} not found` },
      });
    }

    return reply.send({ topic });
  });
}

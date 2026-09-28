import { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Liveness probe: returns 200 as long as the process is alive
  app.get('/healthz', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  // Readiness probe: verifies database connectivity
  app.get('/readyz', async (_request, reply) => {
    try {
      // Execute a lightweight query to verify SQLite connection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (app as any).db?.$client;
      if (client) {
        client.prepare('SELECT 1;').get();
      }
      return {
        status: 'ok',
        db: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const error = err as Error;
      app.log.error({ err: error }, 'Readiness check failed');
      return reply.status(503).send({
        status: 'error',
        db: 'unreachable',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });
}

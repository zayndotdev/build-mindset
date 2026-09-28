import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ProviderIdSchema } from '@mindset/shared';
import { requireAuth } from '../auth/guard';
import { ProviderRepository } from '../db/repositories/provider.repository';
import { AIService } from '../ai/service';

const UpdateKeySchema = z.object({
  apiKey: z.string().min(1, 'API key cannot be empty'),
});

const UpdateConfigSchema = z.object({
  model: z.string().min(1).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  isGradingPrimary: z.boolean().optional(),
});

const TestProviderSchema = z.object({
  apiKey: z.string().optional(),
});

export async function providerRoutes(app: FastifyInstance): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providerRepo = (app as any).providerRepo as ProviderRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiService = (app as any).aiService as AIService;

  // GET /api/v1/providers
  app.get('/', { preHandler: [requireAuth] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    await providerRepo.ensureDefaultProviders();
    const providers = await providerRepo.listProviders();
    const router = aiService.getRouter();
    const quotaTracker = router.getQuotaTracker();

    const result = await Promise.all(
      providers.map(async (p) => {
        const cb = router.getCircuitBreaker(p.id);
        const restingUntilDate = quotaTracker.getRestingUntil(p.id);
        const models = await aiService.listModelsForProvider(p.id);

        return {
          id: p.id,
          model: p.model,
          priority: p.priority,
          isGradingPrimary: p.isGradingPrimary,
          hasKey: p.hasKey,
          isHealthy: p.isHealthy,
          lastError: p.lastError,
          circuitState: cb ? cb.getState() : 'CLOSED',
          isResting: quotaTracker.isResting(p.id),
          restingUntil: restingUntilDate ? restingUntilDate.toISOString() : null,
          models,
        };
      })
    );

    return reply.send({ providers: result });
  });

  // PUT /api/v1/providers/:id/key
  app.put('/:id/key', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const idValidation = ProviderIdSchema.safeParse(id);
    if (!idValidation.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_PROVIDER_ID', message: `Unknown provider id: ${id}` },
      });
    }
    const providerId = idValidation.data;

    const parseResult = UpdateKeySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid payload. apiKey is required.',
          details: parseResult.error.flatten(),
        },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (app as any).env;
    await providerRepo.updateApiKey(providerId, parseResult.data.apiKey, env.ENCRYPTION_KEY);
    await aiService.reloadProviders();

    return reply.send({
      success: true,
      id: providerId,
      hasKey: true,
      message: `API key encrypted and saved for ${providerId}`,
    });
  });

  // DELETE /api/v1/providers/:id/key
  app.delete('/:id/key', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const idValidation = ProviderIdSchema.safeParse(id);
    if (!idValidation.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_PROVIDER_ID', message: `Unknown provider id: ${id}` },
      });
    }
    const providerId = idValidation.data;

    await providerRepo.deleteApiKey(providerId);
    await aiService.reloadProviders();

    return reply.send({
      success: true,
      id: providerId,
      hasKey: false,
      message: `API key removed for ${providerId}`,
    });
  });

  // PUT /api/v1/providers/:id/config
  app.put('/:id/config', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const idValidation = ProviderIdSchema.safeParse(id);
    if (!idValidation.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_PROVIDER_ID', message: `Unknown provider id: ${id}` },
      });
    }
    const providerId = idValidation.data;

    const parseResult = UpdateConfigSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid provider configuration',
          details: parseResult.error.flatten(),
        },
      });
    }

    await providerRepo.updateConfig(providerId, parseResult.data);
    await aiService.reloadProviders();

    const updated = await providerRepo.getProvider(providerId);
    return reply.send({
      success: true,
      provider: updated,
    });
  });

  // POST /api/v1/providers/:id/test
  app.post('/:id/test', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const idValidation = ProviderIdSchema.safeParse(id);
    if (!idValidation.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_PROVIDER_ID', message: `Unknown provider id: ${id}` },
      });
    }
    const providerId = idValidation.data;

    const parseResult = TestProviderSchema.safeParse(request.body || {});
    const apiKey = parseResult.success ? parseResult.data.apiKey : undefined;

    const testResult = await aiService.testProvider(providerId, apiKey);
    return reply.send({
      id: providerId,
      ...testResult,
    });
  });
}

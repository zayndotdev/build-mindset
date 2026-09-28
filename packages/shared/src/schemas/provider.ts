import { z } from 'zod';

export const ProviderIdSchema = z.enum(['gemini', 'groq', 'mistral', 'cohere']);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const SaveApiKeySchema = z.object({
  providerId: ProviderIdSchema,
  apiKey: z.string().min(1, 'API key cannot be empty'),
});
export type SaveApiKeyInput = z.infer<typeof SaveApiKeySchema>;

export const UpdateProviderConfigSchema = z.object({
  model: z.string().optional(),
  priority: z.number().int().optional(),
  isGradingPrimary: z.boolean().optional(),
});
export type UpdateProviderConfigInput = z.infer<typeof UpdateProviderConfigSchema>;

export const ProviderStatusSchema = z.object({
  id: ProviderIdSchema,
  name: z.string(),
  hasKey: z.boolean(),
  model: z.string(),
  priority: z.number(),
  isGradingPrimary: z.boolean(),
  isHealthy: z.boolean(),
  lastError: z.string().nullable().optional(),
});
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;

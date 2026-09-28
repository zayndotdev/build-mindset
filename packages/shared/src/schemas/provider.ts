import { z } from 'zod';

export const ProviderIdSchema = z.enum(['gemini', 'groq', 'mistral', 'cohere', 'mock']);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const CircuitStateSchema = z.enum(['CLOSED', 'OPEN', 'HALF_OPEN']);
export type CircuitState = z.infer<typeof CircuitStateSchema>;

export const TaskTypeSchema = z.enum([
  'coach_chat',
  'grade_answer',
  'generate_topic',
  'english_feedback',
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const ModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  contextWindow: z.number().optional(),
  maxOutputTokens: z.number().optional(),
  isDefault: z.boolean().optional(),
});
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

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
  discoveredModels: z.array(ModelInfoSchema).default([]),
  priority: z.number(),
  isGradingPrimary: z.boolean(),
  isHealthy: z.boolean(),
  circuitState: CircuitStateSchema.default('CLOSED'),
  isResting: z.boolean().default(false),
  restingUntil: z.string().nullable().optional(),
  consecutiveFailures: z.number().default(0),
  lastError: z.string().nullable().optional(),
});
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;

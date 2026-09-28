import { z } from 'zod';

export const IdempotencyRecordSchema = z.object({
  key: z.string(),
  requestHash: z.string(),
  responseStatus: z.number().int(),
  responseBody: z.string(),
  responseHeaders: z.record(z.string(), z.string()).optional(),
  createdAt: z.string(),
  expiresAt: z.string(),
});
export type IdempotencyRecord = z.infer<typeof IdempotencyRecordSchema>;

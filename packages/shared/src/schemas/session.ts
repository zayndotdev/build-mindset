import { z } from 'zod';
import { LevelSchema } from './topic';

export const SessionModeSchema = z.enum(['standard', 'quick']);
export type SessionMode = z.infer<typeof SessionModeSchema>;

export const CreateSessionSchema = z.object({
  topicId: z.string().min(1),
  level: LevelSchema,
  sessionMode: SessionModeSchema.default('standard'),
});
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

export const SubmitAnswerSchema = z.object({
  answer: z.string().min(1, 'Answer cannot be empty'),
  voiceTranscriptOriginal: z.string().optional(),
});
export type SubmitAnswerInput = z.infer<typeof SubmitAnswerSchema>;

export const StepGradeSchema = z.object({
  qualityScore: z.number().min(0).max(4),
  independenceScore: z.number().int().min(0).max(4),
  compositeScore: z.number().min(0).max(4),
  covered: z.array(z.string()),
  missed: z.array(z.string()),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  graderId: z.string(),
  rubricVersion: z.string(),
  isFallbackGrade: z.boolean(),
  gradedAt: z.string(),
});
export type StepGrade = z.infer<typeof StepGradeSchema>;

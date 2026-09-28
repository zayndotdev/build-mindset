import { z } from 'zod';

export const LevelSchema = z.enum(['junior', 'mid', 'senior']);
export type Level = z.infer<typeof LevelSchema>;

export const KeyPointSchema = z.object({
  point: z.string().min(1),
  isCore: z.boolean(),
});
export type KeyPoint = z.infer<typeof KeyPointSchema>;

export const TopicStepDataSchema = z.object({
  coachQuestion: z.string().min(1),
  keyPoints: z.object({
    junior: z.array(KeyPointSchema),
    mid: z.array(KeyPointSchema),
    senior: z.array(KeyPointSchema),
  }),
  modelAnswer: z.object({
    junior: z.string().min(1),
    mid: z.string().min(1),
    senior: z.string().min(1),
  }),
});
export type TopicStepData = z.infer<typeof TopicStepDataSchema>;

export const TopicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  prerequisites: z.array(z.string()).default([]),
  learningObjectives: z.array(z.string()),
  keyTradeoffs: z.array(z.string()),
  commonPitfalls: z.array(z.string()),
  transferTopicId: z.string(),
  transferPrompt: z.string(),
  standardSteps: z.array(z.number()),
  estimatedMinutes: z.number().positive(),
  tags: z.array(z.string()),
  isCustom: z.boolean().default(false),
  isActive: z.boolean().default(true),
  steps: z.record(z.string(), TopicStepDataSchema),
});
export type Topic = z.infer<typeof TopicSchema>;

import { z } from 'zod';

export type SessionState =
  | 'INITIALIZING'
  | 'QUESTION'
  | 'WAITING_ANSWER'
  | 'EVALUATING'
  | 'FEEDBACK'
  | 'HINT_GIVEN'
  | 'STEP_COMPLETED'
  | 'SESSION_RECAP'
  | 'TRANSFER_CHALLENGE'
  | 'SESSION_COMPLETED';

export type SessionLevel = 'foundation' | 'working' | 'advanced';
export type SessionMode = 'standard' | 'quick';

export type QualityScore = 0 | 1 | 2 | 3 | 4;
export type IndependenceScore = 0 | 1 | 2 | 3 | 4;

export const RubricEvaluationSchema = z.object({
  qualityScore: z.number().int().min(0).max(4),
  coveredKeyPoints: z.array(z.string()),
  missingKeyPoints: z.array(z.string()),
  feedback: z.string(),
  suggestedFollowup: z.string(),
  isPass: z.boolean(),
});

export type RubricEvaluation = z.infer<typeof RubricEvaluationSchema>;

export interface HintRequestResult {
  hintLevel: 1 | 2;
  hintsRemaining: number;
  hintText: string;
  newIndependenceScore: IndependenceScore;
}

export interface StepEvaluationResult {
  stepNumber: number;
  stepSlug: string;
  qualityScore: QualityScore;
  independenceScore: IndependenceScore;
  compositeScore: number;
  rubric: RubricEvaluation;
  isStepPass: boolean;
  canAdvance: boolean;
}

export interface SM2State {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextDue: string;
  lastQuality?: number;
  lastReviewed?: string;
}

export interface EnglishFeedback {
  fluencyScore: number;
  grammarScore: number;
  concisenessScore: number;
  feedback: string;
  suggestions: string[];
  corrections: Array<{ original: string; corrected: string; explanation: string }>;
  technicalVocab: Array<{ originalTerm: string; suggestedTerm: string; rationale: string }>;
  seniorRewrite: string;
  pronunciationNote?: string;
}

import { IndependenceScore } from './types';

export const MAX_HINTS_PER_STEP = 2;

/**
 * Calculates independence score based on number of hints used or skip flag.
 * 0 hints used -> 4
 * 1 hint used  -> 3
 * 2 hints used -> 2
 * skipped      -> 0
 */
export function calculateIndependenceScore(hintsUsed: number, isSkipped = false): IndependenceScore {
  if (isSkipped) return 0;
  if (hintsUsed <= 0) return 4;
  if (hintsUsed === 1) return 3;
  return 2;
}

/**
 * Calculates the composite score weighting: 70% Quality + 30% Independence.
 * Returns score rounded to 2 decimal places.
 */
export function calculateCompositeScore(quality: number, independence: number): number {
  const composite = quality * 0.7 + independence * 0.3;
  return Math.round(composite * 100) / 100;
}

/**
 * Evaluates whether a quality score meets the passing threshold (score >= 3).
 */
export function isScorePassing(quality: number): boolean {
  return quality >= 3;
}

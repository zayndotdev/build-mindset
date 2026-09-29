import { SM2State } from './types';

/**
 * SuperMemo SM-2 Spaced Repetition Algorithm.
 * Adapts next review interval and ease factor based on performance quality (1-4).
 */
export function calculateSM2(
  currentState: SM2State,
  qualityScore: number,
  now = new Date()
): SM2State {
  let { easeFactor, intervalDays, repetitions } = currentState;

  // Map 1-4 quality score to SM-2 2-5 scale
  const q = Math.min(5, Math.max(0, qualityScore + 1));

  if (q >= 3) {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitions++;
  } else {
    // Failed recall: reset repetitions and review tomorrow
    repetitions = 0;
    intervalDays = 1;
  }

  // Update ease factor: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const diff = 5 - q;
  easeFactor = easeFactor + (0.1 - diff * (0.08 + diff * 0.02));
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }
  easeFactor = Math.round(easeFactor * 100) / 100;

  const nextDueDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    easeFactor,
    intervalDays,
    repetitions,
    nextDue: nextDueDate.toISOString(),
    lastQuality: qualityScore,
    lastReviewed: now.toISOString(),
  };
}

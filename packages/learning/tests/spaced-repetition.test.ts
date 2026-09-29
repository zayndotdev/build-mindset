import { describe, it, expect } from 'vitest';
import { calculateSM2 } from '../src/spaced-repetition';

describe('SM-2 Spaced Repetition Algorithm', () => {
  it('schedules review for tomorrow on initial successful review (quality >= 3)', () => {
    const initial = {
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 0,
      nextDue: new Date().toISOString(),
    };

    const next = calculateSM2(initial, 3);
    expect(next.intervalDays).toBe(1);
    expect(next.repetitions).toBe(1);
    expect(next.easeFactor).toBe(2.5); // q=4: delta is 0, so EF remains 2.5
  });

  it('progresses to 6-day interval on second consecutive success', () => {
    const firstReview = {
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 1,
      nextDue: new Date().toISOString(),
    };

    const next = calculateSM2(firstReview, 4);
    expect(next.intervalDays).toBe(6);
    expect(next.repetitions).toBe(2);
    expect(next.easeFactor).toBe(2.6); // adjusted up for score 4 (mastery)
  });

  it('multiplies interval by ease factor on subsequent successes', () => {
    const secondReview = {
      easeFactor: 2.5,
      intervalDays: 6,
      repetitions: 2,
      nextDue: new Date().toISOString(),
    };

    const next = calculateSM2(secondReview, 4);
    expect(next.intervalDays).toBe(15); // Math.round(6 * 2.5) = 15
    expect(next.repetitions).toBe(3);
  });

  it('resets interval to 1 day and repetitions to 0 on failure (quality < 3)', () => {
    const matureItem = {
      easeFactor: 2.5,
      intervalDays: 30,
      repetitions: 5,
      nextDue: new Date().toISOString(),
    };

    const next = calculateSM2(matureItem, 1);
    expect(next.intervalDays).toBe(1);
    expect(next.repetitions).toBe(0);
    expect(next.easeFactor).toBe(2.18);
  });

  it('enforces a minimum ease factor of 1.3 to avoid negative spiral', () => {
    const degradedItem = {
      easeFactor: 1.35,
      intervalDays: 1,
      repetitions: 0,
      nextDue: new Date().toISOString(),
    };

    const next = calculateSM2(degradedItem, 1);
    expect(next.easeFactor).toBe(1.3);
  });
});

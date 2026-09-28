import { describe, it, expect, beforeEach } from 'vitest';
import { QuotaTracker } from '../src/quota-tracker';

describe('QuotaTracker & Resting State', () => {
  let tracker: QuotaTracker;

  beforeEach(() => {
    tracker = new QuotaTracker();
  });

  it('marks provider as resting upon receiving 429 rate limit', () => {
    expect(tracker.isResting('gemini')).toBe(false);

    tracker.recordRateLimit('gemini', 100); // 100ms for test
    expect(tracker.isResting('gemini')).toBe(true);
    expect(tracker.getRestingUntil('gemini')).toBeInstanceOf(Date);
  });

  it('clears resting state automatically once backoff window expires', async () => {
    tracker.recordRateLimit('groq', 100);
    expect(tracker.isResting('groq')).toBe(true);

    await new Promise((r) => setTimeout(r, 110));
    expect(tracker.isResting('groq')).toBe(false);
    expect(tracker.getRestingUntil('groq')).toBeNull();
  });

  it('allows manual clearance of resting state', () => {
    tracker.recordRateLimit('mistral', 60000);
    expect(tracker.isResting('mistral')).toBe(true);

    tracker.clearResting('mistral');
    expect(tracker.isResting('mistral')).toBe(false);
  });
});

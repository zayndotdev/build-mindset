import { describe, it, expect, beforeEach } from 'vitest';
import { AIRouter } from '../src/router';
import { MockAdapter } from '../src/adapters/mock';
import { ProviderUnavailableError } from '../src/types';

describe('AIRouter Multi-Provider Fallback & Pinned Grader', () => {
  let router: AIRouter;
  let p1: MockAdapter;
  let p2: MockAdapter;
  let p3: MockAdapter;

  beforeEach(() => {
    router = new AIRouter({
      priority: ['gemini', 'groq', 'mistral'],
      pinnedGraderId: 'gemini',
      pinnedGraderModel: 'gemini-2.5-flash',
      rubricVersion: 'v1.0',
      circuitBreakerThreshold: 3,
      circuitBreakerResetMs: 100,
    });

    p1 = new MockAdapter('gemini', 'Mock Gemini', 'gemini-2.5-flash');
    p2 = new MockAdapter('groq', 'Mock Groq', 'llama-3.3-70b-versatile');
    p3 = new MockAdapter('mistral', 'Mock Mistral', 'mistral-small-latest');

    router.registerProvider(p1);
    router.registerProvider(p2);
    router.registerProvider(p3);
  });

  it('routes to primary provider when healthy', async () => {
    p1.setBehavior({ content: 'Gemini primary response' });

    const result = await router.generate({
      messages: [{ role: 'user', content: 'Design auth' }],
    });

    expect(result.providerId).toBe('gemini');
    expect(result.content).toBe('Gemini primary response');
    expect(result.isFallback).toBe(false);
    expect(p1.callCount).toBe(1);
    expect(p2.callCount).toBe(0);
  });

  it('transparently falls back to secondary provider on 429 rate limit', async () => {
    // P1 fails with 429 quota exhaustion
    p1.setBehavior({ mode: 'rate_limit', retryAfterMs: 5000 });
    p2.setBehavior({ content: 'Groq fallback response' });

    const result = await router.generate({
      messages: [{ role: 'user', content: 'Design auth' }],
    });

    expect(result.providerId).toBe('groq');
    expect(result.content).toBe('Groq fallback response');
    expect(result.isFallback).toBe(true);
    expect(p1.callCount).toBe(1);
    expect(p2.callCount).toBe(1);

    // Verify P1 is now marked as resting in QuotaTracker
    expect(router.getQuotaTracker().isResting('gemini')).toBe(true);

    // Next request skips resting P1 entirely and hits P2 directly
    const secondResult = await router.generate({
      messages: [{ role: 'user', content: 'Followup question' }],
    });
    expect(secondResult.providerId).toBe('groq');
    expect(p1.callCount).toBe(1); // Not called again while resting
    expect(p2.callCount).toBe(2);
  });

  it('transparently falls back on request timeout', async () => {
    p1.setBehavior({ mode: 'timeout' });
    p2.setBehavior({ content: 'Groq timeout-fallback response' });

    const result = await router.generate({
      messages: [{ role: 'user', content: 'Design auth' }],
    });

    expect(result.providerId).toBe('groq');
    expect(result.isFallback).toBe(true);
  });

  it('skips provider once circuit breaker trips after 3 failures', async () => {
    p1.setBehavior({ mode: 'custom_error', customErrorMessage: 'Internal server error 500' });
    p2.setBehavior({ content: 'Groq recovery' });

    // 1st failure
    await router.generate({ messages: [{ role: 'user', content: 'test 1' }] });
    // 2nd failure
    await router.generate({ messages: [{ role: 'user', content: 'test 2' }] });
    // 3rd failure (trips circuit breaker)
    await router.generate({ messages: [{ role: 'user', content: 'test 3' }] });

    const cb1 = router.getCircuitBreaker('gemini')!;
    expect(cb1.getState()).toBe('OPEN');

    // 4th request: Circuit breaker is OPEN, so P1 is not even attempted!
    p1.resetBehavior();
    p1.setBehavior({ content: 'Should not run' });

    const result4 = await router.generate({ messages: [{ role: 'user', content: 'test 4' }] });
    expect(result4.providerId).toBe('groq');
    expect(p1.callCount).toBe(3); // untouched on 4th call
  });

  it('supports Pinned Grader: uses primary when healthy with isFallbackGrade = false', async () => {
    p1.setBehavior({ content: JSON.stringify({ qualityScore: 4, independenceScore: 4 }) });

    const { result, provenance } = await router.generateWithPinnedGrader({
      messages: [{ role: 'user', content: 'Grade answer' }],
    });

    expect(result.providerId).toBe('gemini');
    expect(provenance.graderId).toBe('gemini');
    expect(provenance.model).toBe('gemini-2.5-flash');
    expect(provenance.rubricVersion).toBe('v1.0');
    expect(provenance.isFallbackGrade).toBe(false);
  });

  it('supports Pinned Grader: falls back and records provenance when primary grader fails', async () => {
    // Gemini fails
    p1.setBehavior({ mode: 'rate_limit' });
    p2.setBehavior({ content: JSON.stringify({ qualityScore: 3, independenceScore: 4 }) });

    const { result, provenance } = await router.generateWithPinnedGrader({
      messages: [{ role: 'user', content: 'Grade answer' }],
    });

    expect(result.providerId).toBe('groq');
    expect(provenance.graderId).toBe('groq');
    expect(provenance.isFallbackGrade).toBe(true);
    expect(provenance.rubricVersion).toBe('v1.0');
  });

  it('throws ProviderUnavailableError when all providers fail', async () => {
    p1.setBehavior({ mode: 'custom_error' });
    p2.setBehavior({ mode: 'custom_error' });
    p3.setBehavior({ mode: 'custom_error' });

    await expect(
      router.generate({ messages: [{ role: 'user', content: 'Hello' }] })
    ).rejects.toThrow(ProviderUnavailableError);
  });

  it('streams chunks across providers with fallback', async () => {
    p1.setBehavior({ mode: 'rate_limit' });
    p2.setBehavior({ content: 'Streamed answer from Groq' });

    const chunks: string[] = [];
    for await (const chunk of router.stream({ messages: [{ role: 'user', content: 'Stream me' }] })) {
      if (chunk.delta) {
        chunks.push(chunk.delta);
      }
    }

    expect(chunks.join('')).toBe('Streamed answer from Groq');
  });
});

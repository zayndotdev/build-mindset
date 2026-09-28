import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker } from '../src/circuit-breaker';
import { CircuitBreakerOpenError } from '../src/types';

describe('CircuitBreaker State Machine', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker('mock', {
      failureThreshold: 3,
      resetTimeoutMs: 100, // 100ms for fast testing
    });
  });

  it('initializes in CLOSED state with 0 failures', () => {
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
    expect(cb.isAvailable()).toBe(true);
  });

  it('resets failure count on successful execution', async () => {
    cb.onFailure(new Error('transient'));
    expect(cb.getFailureCount()).toBe(1);

    const result = await cb.execute(async () => 'success');
    expect(result).toBe('success');
    expect(cb.getFailureCount()).toBe(0);
    expect(cb.getState()).toBe('CLOSED');
  });

  it('transitions from CLOSED to OPEN after failureThreshold errors', async () => {
    const errorAction = async () => {
      throw new Error('Provider failed');
    };

    // 1st failure
    await expect(cb.execute(errorAction)).rejects.toThrow('Provider failed');
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(1);

    // 2nd failure
    await expect(cb.execute(errorAction)).rejects.toThrow('Provider failed');
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(2);

    // 3rd failure (trips)
    await expect(cb.execute(errorAction)).rejects.toThrow('Provider failed');
    expect(cb.getState()).toBe('OPEN');
    expect(cb.getFailureCount()).toBe(3);
    expect(cb.isAvailable()).toBe(false);

    // 4th execution should reject immediately with CircuitBreakerOpenError without running action
    const mockFn = vi.fn().mockResolvedValue('ok');
    await expect(cb.execute(mockFn)).rejects.toThrow(CircuitBreakerOpenError);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('transitions to HALF_OPEN after cooldown period and recovers on success', async () => {
    // Trip the circuit breaker
    cb.onFailure();
    cb.onFailure();
    cb.onFailure();
    expect(cb.getState()).toBe('OPEN');

    // Wait for cooldown
    await new Promise((resolve) => setTimeout(resolve, 110));

    expect(cb.getState()).toBe('HALF_OPEN');
    expect(cb.isAvailable()).toBe(true);

    // Probe succeeds -> recovers to CLOSED
    const result = await cb.execute(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
  });

  it('re-trips immediately from HALF_OPEN to OPEN if probe fails', async () => {
    // Trip the circuit breaker
    cb.onFailure();
    cb.onFailure();
    cb.onFailure();
    expect(cb.getState()).toBe('OPEN');

    // Wait for cooldown
    await new Promise((resolve) => setTimeout(resolve, 110));
    expect(cb.getState()).toBe('HALF_OPEN');

    // Probe fails
    await expect(
      cb.execute(async () => {
        throw new Error('Probe failed');
      })
    ).rejects.toThrow('Probe failed');

    expect(cb.getState()).toBe('OPEN');
    expect(cb.isAvailable()).toBe(false);
  });
});

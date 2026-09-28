import type { ProviderId, CircuitState } from '@mindset/shared';
import { CircuitBreakerOpenError } from './types';

export interface CircuitBreakerConfig {
  failureThreshold?: number; // Number of consecutive failures to trip
  resetTimeoutMs?: number;   // Cooldown period before half-open attempt
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenProbeRunning: boolean = false;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(
    public readonly providerId: ProviderId,
    config: CircuitBreakerConfig = {}
  ) {
    this.failureThreshold = config.failureThreshold ?? 3;
    this.resetTimeoutMs = config.resetTimeoutMs ?? 30000;
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenProbeRunning = false;
      }
    }
    return this.state;
  }

  public getFailureCount(): number {
    return this.failureCount;
  }

  public isAvailable(): boolean {
    const currentState = this.getState();
    if (currentState === 'OPEN') {
      return false;
    }
    if (currentState === 'HALF_OPEN' && this.halfOpenProbeRunning) {
      return false;
    }
    return true;
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new CircuitBreakerOpenError(
        this.providerId,
        `Circuit breaker is OPEN for provider '${this.providerId}'. Waiting for cooldown.`
      );
    }

    if (currentState === 'HALF_OPEN') {
      if (this.halfOpenProbeRunning) {
        throw new CircuitBreakerOpenError(
          this.providerId,
          `Circuit breaker is HALF_OPEN and test probe is already in progress for '${this.providerId}'.`
        );
      }
      this.halfOpenProbeRunning = true;
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      throw err;
    }
  }

  public onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.halfOpenProbeRunning = false;
  }

  public onFailure(_error?: unknown): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.halfOpenProbeRunning = false;

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenProbeRunning = false;
  }
}

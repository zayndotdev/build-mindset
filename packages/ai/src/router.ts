import type { ProviderId, ProviderStatus, ModelInfo, TaskType, CircuitState } from '@mindset/shared';
import {
  LLMProvider,
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  PinnedGraderProvenance,
  RateLimitError,
  ProviderUnavailableError,
  AudioTranscriptionOptions,
  AudioTranscriptionResult,
} from './types';
import { CircuitBreaker } from './circuit-breaker';
import { QuotaTracker } from './quota-tracker';
import { BaseAdapter } from './adapters/base';

export interface RouterConfig {
  priority?: ProviderId[];
  pinnedGraderId?: ProviderId;
  pinnedGraderModel?: string;
  rubricVersion?: string;
  circuitBreakerThreshold?: number;
  circuitBreakerResetMs?: number;
}

export class AIRouter {
  private providers = new Map<ProviderId, LLMProvider>();
  private circuitBreakers = new Map<ProviderId, CircuitBreaker>();
  private quotaTracker = new QuotaTracker();
  private priority: ProviderId[] = ['gemini', 'groq', 'mistral', 'cohere'];

  private pinnedGraderId: ProviderId = 'gemini';
  private pinnedGraderModel: string = 'gemini-2.5-flash';
  private rubricVersion: string = 'v1.0';

  private circuitBreakerThreshold: number;
  private circuitBreakerResetMs: number;

  constructor(config: RouterConfig = {}) {
    if (config.priority) {
      this.priority = config.priority;
    }
    if (config.pinnedGraderId) {
      this.pinnedGraderId = config.pinnedGraderId;
    }
    if (config.pinnedGraderModel) {
      this.pinnedGraderModel = config.pinnedGraderModel;
    }
    if (config.rubricVersion) {
      this.rubricVersion = config.rubricVersion;
    }
    this.circuitBreakerThreshold = config.circuitBreakerThreshold ?? 3;
    this.circuitBreakerResetMs = config.circuitBreakerResetMs ?? 30000;
  }

  public registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
    if (!this.circuitBreakers.has(provider.id)) {
      this.circuitBreakers.set(
        provider.id,
        new CircuitBreaker(provider.id, {
          failureThreshold: this.circuitBreakerThreshold,
          resetTimeoutMs: this.circuitBreakerResetMs,
        })
      );
    }
  }

  public getProvider(id: ProviderId): LLMProvider | undefined {
    return this.providers.get(id);
  }

  public setPriority(priority: ProviderId[]): void {
    this.priority = priority;
  }

  public getPriority(): ProviderId[] {
    return [...this.priority];
  }

  public setPinnedGrader(id: ProviderId, model: string, rubricVersion: string = 'v1.0'): void {
    this.pinnedGraderId = id;
    this.pinnedGraderModel = model;
    this.rubricVersion = rubricVersion;
  }

  public getCircuitBreaker(id: ProviderId): CircuitBreaker | undefined {
    return this.circuitBreakers.get(id);
  }

  public getQuotaTracker(): QuotaTracker {
    return this.quotaTracker;
  }

  public async generate(options: GenerateOptions, _taskType?: TaskType): Promise<GenerateResult> {
    const sequence = this.getEligibleSequence();

    if (sequence.length === 0) {
      throw new ProviderUnavailableError(
        'mock',
        'No AI providers are configured, available, or out of cooldown/resting.'
      );
    }

    let lastError: unknown = null;

    for (let i = 0; i < sequence.length; i++) {
      const providerId = sequence[i]!;
      const provider = this.providers.get(providerId)!;
      const cb = this.circuitBreakers.get(providerId)!;

      try {
        const result = await cb.execute(async () => {
          return await provider.generate(options);
        });

        // Set fallback flag if not first in priority
        result.isFallback = i > 0;
        return result;
      } catch (err: unknown) {
        lastError = err;

        if (err instanceof RateLimitError) {
          this.quotaTracker.recordRateLimit(providerId, err.retryAfterMs);
        }
        // Proceed to next fallback provider
      }
    }

    throw new ProviderUnavailableError(
      sequence[0] || 'gemini',
      `All available AI providers failed. Last error: ${(lastError as Error)?.message || String(lastError)}`
    );
  }

  public async *stream(options: GenerateOptions, _taskType?: TaskType): AsyncIterable<StreamChunk> {
    const sequence = this.getEligibleSequence();

    if (sequence.length === 0) {
      throw new ProviderUnavailableError(
        'mock',
        'No AI providers are configured, available, or out of cooldown/resting.'
      );
    }

    let lastError: unknown = null;

    for (const providerId of sequence) {
      const provider = this.providers.get(providerId)!;
      const cb = this.circuitBreakers.get(providerId)!;

      try {
        if (!cb.isAvailable()) {
          continue;
        }

        const generator = provider.stream(options);

        for await (const chunk of generator) {
          yield chunk;
        }

        cb.onSuccess();
        return;
      } catch (err: unknown) {
        lastError = err;
        cb.onFailure(err);

        if (err instanceof RateLimitError) {
          this.quotaTracker.recordRateLimit(providerId, err.retryAfterMs);
        }
        // Proceed to next fallback provider
      }
    }

    throw new ProviderUnavailableError(
      sequence[0] || 'gemini',
      `All streaming AI providers failed. Last error: ${(lastError as Error)?.message || String(lastError)}`
    );
  }

  /**
   * Pinned Grader: Always attempts designated primary grader first.
   * If primary grader trips, rests, or fails, falls back transparently and flags provenance.
   */
  public async generateWithPinnedGrader(
    options: GenerateOptions
  ): Promise<{ result: GenerateResult; provenance: PinnedGraderProvenance }> {
    const primaryId = this.pinnedGraderId;
    const primaryProvider = this.providers.get(primaryId);
    const primaryCb = this.circuitBreakers.get(primaryId);

    const isPrimaryEligible =
      primaryProvider &&
      this.isProviderConfigured(primaryProvider) &&
      !this.quotaTracker.isResting(primaryId) &&
      primaryCb?.isAvailable();

    if (isPrimaryEligible) {
      try {
        const result = await primaryCb!.execute(async () => {
          return await primaryProvider!.generate({
            ...options,
            model: this.pinnedGraderModel,
          });
        });

        return {
          result,
          provenance: {
            graderId: primaryId,
            model: result.model || this.pinnedGraderModel,
            rubricVersion: this.rubricVersion,
            isFallbackGrade: false,
          },
        };
      } catch (err) {
        if (err instanceof RateLimitError) {
          this.quotaTracker.recordRateLimit(primaryId, err.retryAfterMs);
        }
        // Fall back below
      }
    }

    // Fallback: use router priority excluding primary that failed
    const fallbackSequence = this.getEligibleSequence().filter((id) => id !== primaryId);
    if (fallbackSequence.length === 0) {
      throw new ProviderUnavailableError(
        primaryId,
        'Pinned grader failed and no eligible fallback providers are configured.'
      );
    }

    const fallbackResult = await this.generate({ ...options });
    return {
      result: fallbackResult,
      provenance: {
        graderId: fallbackResult.providerId,
        model: fallbackResult.model,
        rubricVersion: this.rubricVersion,
        isFallbackGrade: true,
      },
    };
  }

  public getEligibleSequence(): ProviderId[] {
    return this.priority.filter((id) => {
      const provider = this.providers.get(id);
      if (!provider) return false;
      if (!this.isProviderConfigured(provider)) return false;
      if (this.quotaTracker.isResting(id)) return false;

      const cb = this.circuitBreakers.get(id);
      if (cb && !cb.isAvailable()) return false;

      return true;
    });
  }

  public isProviderConfigured(provider: LLMProvider): boolean {
    if (provider.id === 'mock') return true;
    if (provider instanceof BaseAdapter) {
      return provider.hasApiKey();
    }
    return true;
  }

  public async getProviderStatuses(): Promise<ProviderStatus[]> {
    const statuses: ProviderStatus[] = [];

    for (const [id, provider] of this.providers.entries()) {
      const hasKey = this.isProviderConfigured(provider);
      const cb = this.circuitBreakers.get(id);
      const circuitState: CircuitState = cb ? cb.getState() : 'CLOSED';
      const isResting = this.quotaTracker.isResting(id);
      const restingUntilDate = this.quotaTracker.getRestingUntil(id);

      let discoveredModels: ModelInfo[] = [];
      let isHealthy = hasKey && circuitState !== 'OPEN' && !isResting;
      let lastError: string | null = null;

      try {
        if (hasKey) {
          discoveredModels = await provider.listModels().catch(() => []);
        }
      } catch (err) {
        isHealthy = false;
        lastError = (err as Error).message;
      }

      const defaultModel = provider instanceof BaseAdapter ? provider.getDefaultModel() : 'default';

      statuses.push({
        id,
        name: provider.name,
        hasKey,
        model: defaultModel,
        discoveredModels,
        priority: this.priority.indexOf(id) + 1,
        isGradingPrimary: id === this.pinnedGraderId,
        isHealthy,
        circuitState,
        isResting,
        restingUntil: restingUntilDate ? restingUntilDate.toISOString() : null,
        consecutiveFailures: cb ? cb.getFailureCount() : 0,
        lastError,
      });
    }

    return statuses;
  }

  public async transcribe(options: AudioTranscriptionOptions): Promise<AudioTranscriptionResult> {
    const candidateProviders: LLMProvider[] = [];

    // Prioritize Groq, then others in priority order, then any other registered provider
    for (const id of ['groq', ...this.priority]) {
      const p = this.providers.get(id as ProviderId);
      if (p && p.capabilities.audioTranscription && typeof p.transcribe === 'function' && !candidateProviders.includes(p)) {
        candidateProviders.push(p);
      }
    }

    for (const p of this.providers.values()) {
      if (p.capabilities.audioTranscription && typeof p.transcribe === 'function' && !candidateProviders.includes(p)) {
        candidateProviders.push(p);
      }
    }

    if (candidateProviders.length === 0) {
      throw new ProviderUnavailableError('groq', 'No audio transcription provider is registered or configured');
    }

    let lastError: unknown = null;

    for (const provider of candidateProviders) {
      const cb = this.circuitBreakers.get(provider.id);
      if (this.quotaTracker.isResting(provider.id)) {
        continue;
      }

      try {
        if (cb) {
          return await cb.execute(async () => {
            return await provider.transcribe!(options);
          });
        }
        return await provider.transcribe!(options);
      } catch (err: unknown) {
        lastError = err;
        if (err instanceof RateLimitError) {
          this.quotaTracker.recordRateLimit(provider.id, err.retryAfterMs);
        }
      }
    }

    throw (lastError as Error) || new ProviderUnavailableError('groq', 'All audio transcription providers failed');
  }
}


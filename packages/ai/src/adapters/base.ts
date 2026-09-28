import type { ProviderId, ModelInfo } from '@mindset/shared';
import {
  LLMProvider,
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  ProviderCapabilities,
  AIError,
  RateLimitError,
  TimeoutError,
  AuthenticationError,
  ProviderUnavailableError,
} from '../types';

export abstract class BaseAdapter implements LLMProvider {
  abstract readonly id: ProviderId;
  abstract readonly name: string;
  abstract readonly capabilities: ProviderCapabilities;

  protected apiKey: string | null = null;
  protected defaultModel: string;

  constructor(defaultModel: string, apiKey?: string) {
    this.defaultModel = defaultModel;
    if (apiKey) {
      this.apiKey = apiKey;
    }
  }

  public setApiKey(key: string | null): void {
    this.apiKey = key;
  }

  public hasApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public getDefaultModel(): string {
    return this.defaultModel;
  }

  abstract generate(options: GenerateOptions): Promise<GenerateResult>;
  abstract stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
  abstract listModels(): Promise<ModelInfo[]>;

  public async healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    if (!this.hasApiKey()) {
      return { ok: false, latencyMs: 0, error: 'API key not configured' };
    }

    const start = Date.now();
    try {
      const models = await this.listModels();
      const latencyMs = Date.now() - start;
      return { ok: models.length > 0, latencyMs };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      return {
        ok: false,
        latencyMs,
        error: (err as Error).message || 'Health check failed',
      };
    }
  }

  protected normalizeError(err: unknown, statusCode?: number): AIError {
    if (err instanceof AIError) {
      return err;
    }

    const message = (err as Error)?.message || String(err);

    if (statusCode === 429 || /rate limit|quota|429|resource_exhausted/i.test(message)) {
      return new RateLimitError(this.id, message);
    }

    if (statusCode === 401 || statusCode === 403 || /unauthorized|api key|forbidden/i.test(message)) {
      return new AuthenticationError(this.id, message);
    }

    if (/timeout|aborted|timed out|econnaborted/i.test(message)) {
      return new TimeoutError(this.id, message);
    }

    return new ProviderUnavailableError(this.id, message);
  }
}

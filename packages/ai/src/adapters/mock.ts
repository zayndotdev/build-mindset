import type { ProviderId, ModelInfo } from '@mindset/shared';
import { BaseAdapter } from './base';
import {
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  ProviderCapabilities,
  RateLimitError,
  TimeoutError,
  AuthenticationError,
} from '../types';

export interface MockBehavior {
  mode?: 'success' | 'rate_limit' | 'timeout' | 'auth_error' | 'malformed_json' | 'custom_error';
  content?: string;
  delayMs?: number;
  retryAfterMs?: number;
  customErrorMessage?: string;
  models?: ModelInfo[];
}

export class MockAdapter extends BaseAdapter {
  readonly id: ProviderId;
  readonly name: string;
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    structuredJson: true,
    audioTranscription: false,
    audioSpeech: false,
    maxContextTokens: 128000,
  };

  private behavior: MockBehavior = { mode: 'success' };
  public callCount: number = 0;

  constructor(id: ProviderId = 'mock', name: string = 'Mock Provider', defaultModel = 'mock-model-v1') {
    super(defaultModel, 'mock-api-key');
    this.id = id;
    this.name = name;
  }

  public setBehavior(behavior: MockBehavior): void {
    this.behavior = { ...this.behavior, ...behavior };
  }

  public resetBehavior(): void {
    this.behavior = { mode: 'success' };
  }

  public resetCallCount(): void {
    this.callCount = 0;
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    this.callCount++;

    if (this.behavior.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.behavior.delayMs));
    }

    if (options.signal?.aborted) {
      throw new TimeoutError(this.id, 'Client aborted request');
    }

    switch (this.behavior.mode) {
      case 'rate_limit':
        throw new RateLimitError(this.id, 'Simulated HTTP 429 quota exhaustion', this.behavior.retryAfterMs ?? 60000);
      case 'timeout':
        throw new TimeoutError(this.id, 'Simulated request timeout');
      case 'auth_error':
        throw new AuthenticationError(this.id, 'Simulated HTTP 401 unauthorized');
      case 'malformed_json':
        return {
          content: 'This is not JSON: { broken_key: missing_quote, }',
          model: options.model || this.defaultModel,
          providerId: this.id,
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          finishReason: 'stop',
        };
      case 'custom_error':
        throw new Error(this.behavior.customErrorMessage || 'Custom mock error');
      case 'success':
      default: {
        const responseText =
          this.behavior.content ??
          (options.responseFormat === 'json'
            ? JSON.stringify({
                qualityScore: 3,
                independenceScore: 4,
                compositeScore: 3,
                coveredKeyPoints: ['Argon2id hashing', '16-byte random salt'],
                missedKeyPoints: ['Timing attacks'],
                feedback: 'Good architectural reasoning.',
              })
            : 'Mock response answering your system design question.');

        return {
          content: responseText,
          model: options.model || this.defaultModel,
          providerId: this.id,
          usage: {
            promptTokens: 50,
            completionTokens: 25,
            totalTokens: 75,
          },
          finishReason: 'stop',
        };
      }
    }
  }

  public async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.callCount++;

    if (this.behavior.mode === 'rate_limit') {
      throw new RateLimitError(this.id, 'Simulated HTTP 429 quota exhaustion', this.behavior.retryAfterMs ?? 60000);
    }
    if (this.behavior.mode === 'timeout') {
      throw new TimeoutError(this.id, 'Simulated streaming timeout');
    }
    if (this.behavior.mode === 'auth_error') {
      throw new AuthenticationError(this.id, 'Simulated HTTP 401 unauthorized');
    }

    const fullText = this.behavior.content || 'Mock streaming response for testing.';
    const words = fullText.split(' ');

    for (let i = 0; i < words.length; i++) {
      if (options.signal?.aborted) {
        throw new TimeoutError(this.id, 'Streaming aborted by caller');
      }

      const chunkText = i === 0 ? words[i]! : ' ' + words[i]!;
      yield {
        delta: chunkText,
        isDone: false,
      };

      if (this.behavior.delayMs) {
        await new Promise((r) => setTimeout(r, this.behavior.delayMs));
      }
    }

    yield {
      delta: '',
      isDone: true,
      usage: { promptTokens: 30, completionTokens: words.length * 2, totalTokens: 30 + words.length * 2 },
      finishReason: 'stop',
    };
  }

  public async listModels(): Promise<ModelInfo[]> {
    if (this.behavior.mode === 'auth_error') {
      throw new AuthenticationError(this.id, 'Invalid mock credentials');
    }
    return (
      this.behavior.models ?? [
        { id: this.defaultModel, name: 'Mock Default Model', contextWindow: 128000, isDefault: true },
        { id: 'mock-model-fast', name: 'Mock Fast Model', contextWindow: 64000 },
      ]
    );
  }
}

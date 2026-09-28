import type { ProviderId, ModelInfo } from '@mindset/shared';
import { BaseAdapter } from './base';
import {
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  ProviderCapabilities,
  AuthenticationError,
} from '../types';

export class CohereAdapter extends BaseAdapter {
  readonly id: ProviderId = 'cohere';
  readonly name: string = 'Cohere';
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    structuredJson: true,
    audioTranscription: false,
    audioSpeech: false,
    maxContextTokens: 128000,
  };

  private baseUrl: string = 'https://api.cohere.com/v2';

  constructor(apiKey?: string, defaultModel: string = 'command-r-plus-08-2024') {
    super(defaultModel, apiKey);
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (!this.hasApiKey()) {
      throw new AuthenticationError(this.id, 'Cohere API key is not configured');
    }

    const model = options.model || this.defaultModel;

    // Cohere v2 format: messages with role and content
    const messages = options.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    };

    if (options.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    try {
      const res = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: options.signal,
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        const errMessage = (errorBody as { message?: string })?.message || res.statusText;
        throw this.normalizeError(errMessage, res.status);
      }

      const data = await res.json();
      const contentList = (data as { message?: { content?: Array<{ text?: string }> } }).message?.content || [];
      const text = contentList.map((c) => c.text || '').join('');
      const usage = (data as { usage?: { tokens?: { input_tokens?: number; output_tokens?: number } } }).usage?.tokens;

      return {
        content: text,
        model,
        providerId: this.id,
        usage: {
          promptTokens: usage?.input_tokens ?? 0,
          completionTokens: usage?.output_tokens ?? 0,
          totalTokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
        },
        finishReason: 'stop',
      };
    } catch (err) {
      throw this.normalizeError(err);
    }
  }

  public async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (!this.hasApiKey()) {
      throw new AuthenticationError(this.id, 'Cohere API key is not configured');
    }

    const model = options.model || this.defaultModel;
    const messages = options.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const body = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: true,
    };

    const res = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw this.normalizeError(errText, res.status);
    }

    if (!res.body) {
      throw new Error('ReadableStream not supported on response body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line.trim());
            if (parsed.type === 'content-delta') {
              const text = parsed.delta?.message?.content?.text;
              if (text) {
                yield { delta: text, isDone: false };
              }
            }
          } catch {
            // ignore partial line
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { delta: '', isDone: true, finishReason: 'stop' };
  }

  public async listModels(): Promise<ModelInfo[]> {
    if (!this.hasApiKey()) {
      throw new AuthenticationError(this.id, 'API key required to list models');
    }

    try {
      const res = await fetch('https://api.cohere.com/v1/models', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) {
        throw this.normalizeError(await res.text(), res.status);
      }
      const data = await res.json();
      const modelsList = (data as { models?: Array<{ name: string; context_length?: number }> }).models || [];

      return modelsList
        .filter((m) => m.name.includes('command'))
        .map((m) => ({
          id: m.name,
          name: m.name,
          contextWindow: m.context_length,
          isDefault: m.name === this.defaultModel,
        }));
    } catch (err) {
      throw this.normalizeError(err);
    }
  }
}

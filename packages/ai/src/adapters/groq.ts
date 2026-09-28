import type { ProviderId, ModelInfo } from '@mindset/shared';
import { BaseAdapter } from './base';
import {
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  ProviderCapabilities,
  AuthenticationError,
} from '../types';

export class GroqAdapter extends BaseAdapter {
  readonly id: ProviderId = 'groq';
  readonly name: string = 'Groq (Llama / OpenAI Compatible)';
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    structuredJson: true,
    audioTranscription: true,
    audioSpeech: false,
    maxContextTokens: 128000,
  };

  private baseUrl: string = 'https://api.groq.com/openai/v1';

  constructor(apiKey?: string, defaultModel: string = 'llama-3.3-70b-versatile') {
    super(defaultModel, apiKey);
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (!this.hasApiKey()) {
      throw new AuthenticationError(this.id, 'Groq API key is not configured');
    }

    const model = options.model || this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    };

    if (options.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
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
        const errMessage = (errorBody as { error?: { message?: string } })?.error?.message || res.statusText;
        throw this.normalizeError(errMessage, res.status);
      }

      const data = await res.json();
      const choice = (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0];
      const text = choice?.message?.content || '';
      const usage = (data as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage;

      return {
        content: text,
        model,
        providerId: this.id,
        usage: {
          promptTokens: usage?.prompt_tokens ?? 0,
          completionTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
        },
        finishReason: 'stop',
      };
    } catch (err) {
      throw this.normalizeError(err);
    }
  }

  public async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (!this.hasApiKey()) {
      throw new AuthenticationError(this.id, 'Groq API key is not configured');
    }

    const model = options.model || this.defaultModel;
    const body = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: true,
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
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
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                yield { delta, isDone: false };
              }
            } catch {
              // ignore partial line
            }
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
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) {
        throw this.normalizeError(await res.text(), res.status);
      }
      const data = await res.json();
      const modelsList = (data as { data?: Array<{ id: string }> }).data || [];

      return modelsList
        .filter((m) => !m.id.includes('whisper'))
        .map((m) => ({
          id: m.id,
          name: m.id,
          isDefault: m.id === this.defaultModel,
        }));
    } catch (err) {
      throw this.normalizeError(err);
    }
  }
}

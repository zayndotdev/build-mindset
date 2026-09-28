import type { ProviderId, ModelInfo } from '@mindset/shared';
import { BaseAdapter } from './base';
import {
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  ProviderCapabilities,
  AuthenticationError,
} from '../types';

export class GeminiAdapter extends BaseAdapter {
  readonly id: ProviderId = 'gemini';
  readonly name: string = 'Google Gemini';
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    structuredJson: true,
    audioTranscription: true,
    audioSpeech: false,
    maxContextTokens: 1000000,
  };

  private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey?: string, defaultModel: string = 'gemini-2.5-flash') {
    super(defaultModel, apiKey);
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (!this.hasApiKey()) {
      throw new AuthenticationError(this.id, 'Gemini API key is not configured');
    }

    const model = options.model || this.defaultModel;
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    // Separate system instructions from user/assistant turns
    const systemMessage = options.messages.find((m) => m.role === 'system');
    const conversationMessages = options.messages.filter((m) => m.role !== 'system');

    const contents = conversationMessages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
        responseMimeType: options.responseFormat === 'json' ? 'application/json' : 'text/plain',
      },
    };

    if (systemMessage) {
      body.systemInstruction = {
        parts: [{ text: systemMessage.content }],
      };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: options.signal,
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        const errMessage = (errorBody as { error?: { message?: string } })?.error?.message || res.statusText;
        throw this.normalizeError(errMessage, res.status);
      }

      const data = await res.json();
      const candidate = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text || '';
      const usageMetadata = (data as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } }).usageMetadata;

      return {
        content: text,
        model,
        providerId: this.id,
        usage: {
          promptTokens: usageMetadata?.promptTokenCount ?? 0,
          completionTokens: usageMetadata?.candidatesTokenCount ?? 0,
          totalTokens: usageMetadata?.totalTokenCount ?? 0,
        },
        finishReason: 'stop',
      };
    } catch (err) {
      throw this.normalizeError(err);
    }
  }

  public async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (!this.hasApiKey()) {
      throw new AuthenticationError(this.id, 'Gemini API key is not configured');
    }

    const model = options.model || this.defaultModel;
    const url = `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const systemMessage = options.messages.find((m) => m.role === 'system');
    const conversationMessages = options.messages.filter((m) => m.role !== 'system');

    const contents = conversationMessages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
      },
    };

    if (systemMessage) {
      body.systemInstruction = {
        parts: [{ text: systemMessage.content }],
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const chunkText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (chunkText) {
                yield { delta: chunkText, isDone: false };
              }
            } catch {
              // ignore partial SSE json line
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

    const url = `${this.baseUrl}/models?key=${this.apiKey}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw this.normalizeError(await res.text(), res.status);
      }
      const data = await res.json();
      const modelsList = (data as { models?: Array<{ name: string; displayName?: string; inputTokenLimit?: number }> }).models || [];

      return modelsList
        .filter((m) => m.name.includes('gemini') && !m.name.includes('vision') && !m.name.includes('embedding'))
        .map((m) => {
          const id = m.name.replace(/^models\//, '');
          return {
            id,
            name: m.displayName || id,
            contextWindow: m.inputTokenLimit,
            isDefault: id === this.defaultModel,
          };
        });
    } catch (err) {
      throw this.normalizeError(err);
    }
  }
}

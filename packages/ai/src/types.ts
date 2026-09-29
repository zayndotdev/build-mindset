import type { ProviderId, ModelInfo } from '@mindset/shared';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  signal?: AbortSignal;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerateResult {
  content: string;
  model: string;
  providerId: ProviderId;
  usage: TokenUsage;
  finishReason: 'stop' | 'length' | 'error' | 'other';
  isFallback?: boolean;
}

export interface StreamChunk {
  delta: string;
  isDone: boolean;
  usage?: TokenUsage;
  finishReason?: string;
}

export interface ProviderCapabilities {
  streaming: boolean;
  structuredJson: boolean;
  audioTranscription?: boolean;
  audioSpeech?: boolean;
  maxContextTokens: number;
}

export interface AudioTranscriptionOptions {
  audio: Uint8Array | Buffer;
  mimeType?: string;
  filename?: string;
  language?: string;
  prompt?: string;
  signal?: AbortSignal;
}

export interface AudioTranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  providerId: ProviderId;
  model: string;
}

export interface LLMProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  generate(options: GenerateOptions): Promise<GenerateResult>;
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
  listModels(): Promise<ModelInfo[]>;
  healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  transcribe?(options: AudioTranscriptionOptions): Promise<AudioTranscriptionResult>;
}

export interface PinnedGraderProvenance {
  graderId: ProviderId;
  model: string;
  rubricVersion: string;
  isFallbackGrade: boolean;
}

// Normalized Error Hierarchy
export class AIError extends Error {
  constructor(
    message: string,
    public readonly providerId: ProviderId,
    public readonly code: string,
    public readonly retryable: boolean = false,
    cause?: unknown
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'AIError';
  }
}

export class RateLimitError extends AIError {
  constructor(
    providerId: ProviderId,
    message: string = 'Provider rate limit exceeded',
    public readonly retryAfterMs: number = 60000
  ) {
    super(message, providerId, 'RATE_LIMIT_EXCEEDED', true);
    this.name = 'RateLimitError';
  }
}

export class TimeoutError extends AIError {
  constructor(providerId: ProviderId, message: string = 'Request to provider timed out') {
    super(message, providerId, 'TIMEOUT', true);
    this.name = 'TimeoutError';
  }
}

export class AuthenticationError extends AIError {
  constructor(providerId: ProviderId, message: string = 'Invalid API key or unauthorized') {
    super(message, providerId, 'AUTHENTICATION_FAILED', false);
    this.name = 'AuthenticationError';
  }
}

export class MalformedOutputError extends AIError {
  public readonly raw?: string;

  constructor(
    providerId: ProviderId,
    message: string = 'Model returned malformed or invalid JSON',
    raw?: string
  ) {
    super(message, providerId, 'MALFORMED_OUTPUT', true);
    this.name = 'MalformedOutputError';
    this.raw = raw;
  }
}

export class CircuitBreakerOpenError extends AIError {
  constructor(
    providerId: ProviderId,
    message: string = 'Circuit breaker is OPEN for this provider'
  ) {
    super(message, providerId, 'CIRCUIT_BREAKER_OPEN', false);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class ProviderUnavailableError extends AIError {
  constructor(
    providerId: ProviderId,
    message: string = 'Provider is unavailable or exhausted'
  ) {
    super(message, providerId, 'PROVIDER_UNAVAILABLE', true);
    this.name = 'ProviderUnavailableError';
  }
}

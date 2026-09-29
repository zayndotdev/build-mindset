import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { createDbClient } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
import { AuthRepository } from '../src/db/repositories/auth.repository';
import { hashPassphrase } from '../src/auth/service';
import { AppEnv } from '../src/config/env';
import { MockAdapter } from '@mindset/ai';

const TEST_ENV: AppEnv = {
  NODE_ENV: 'test',
  PORT: 0,
  HOST: '127.0.0.1',
  CORS_ORIGIN: 'http://localhost:3000',
  SESSION_SECRET: 'test-session-secret-at-least-32-chars-long-xyz',
  DATABASE_PATH: ':memory:',
  LOG_LEVEL: 'silent',
  APP_PASSPHRASE: 'test-secure-passphrase-2026',
};

describe('Voice Pipeline & Transcription Routes (Phase 5)', () => {
  let app: FastifyInstance;
  let authCookie: string;
  let mockAdapter: MockAdapter;

  beforeEach(async () => {
    const db = createDbClient(':memory:');
    runMigrations(db);

    const authRepo = new AuthRepository(db);
    const hash = await hashPassphrase('test-secure-passphrase-2026');
    await authRepo.ensureUserExists(hash);
    await seedDatabase(db);

    app = buildApp({ env: TEST_ENV, db, logger: false });
    await app.ready();

    // Register MockAdapter as audio transcription provider
    mockAdapter = new MockAdapter('groq', 'Groq (Mocked Whisper)', 'whisper-large-v3-turbo');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app as any).aiService.getRouter().registerProvider(mockAdapter);

    // Initial passphrase setup / login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { passphrase: 'test-secure-passphrase-2026' },
    });
    const sessionCookieObj = loginRes.cookies.find((c) => c.name === 'mindset_session');
    authCookie = sessionCookieObj?.value || '';
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unauthenticated voice transcription requests with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/voice/transcribe',
      payload: { audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects empty or invalid audio payloads with 400 INVALID_AUDIO', async () => {
    const emptyJsonRes = await app.inject({
      method: 'POST',
      url: '/api/v1/voice/transcribe',
      cookies: { mindset_session: authCookie },
      payload: { audioBase64: '' },
    });

    expect(emptyJsonRes.statusCode).toBe(400);
    const body = JSON.parse(emptyJsonRes.body);
    expect(body.error.code).toBe('INVALID_AUDIO');

    const emptyBinaryRes = await app.inject({
      method: 'POST',
      url: '/api/v1/voice/transcribe',
      cookies: { mindset_session: authCookie },
      headers: { 'content-type': 'audio/webm' },
      body: Buffer.alloc(0),
    });

    expect(emptyBinaryRes.statusCode).toBe(400);
  });

  it('transcribes base64 JSON audio payload via audio adapter', async () => {
    mockAdapter.setBehavior({
      content: 'I would use PostgreSQL with B-tree composite indexes for user lookups.',
    });

    const dummyAudioBase64 = Buffer.from('RIFF....WAVEfmt....data....').toString('base64');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/voice/transcribe',
      cookies: { mindset_session: authCookie },
      payload: {
        audioBase64: dummyAudioBase64,
        mimeType: 'audio/wav',
        language: 'en',
      },
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.text).toBe('I would use PostgreSQL with B-tree composite indexes for user lookups.');
    expect(data.provider).toBe('groq');
    expect(data.model).toBe('mock-whisper-v3');
    expect(data.duration).toBeGreaterThan(0);
  });

  it('transcribes binary audio buffer payload with audio/webm content-type', async () => {
    mockAdapter.setBehavior({
      content: 'We should implement exponential backoff with full jitter.',
    });

    const binaryAudio = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]); // Mock WebM header bytes

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/voice/transcribe',
      cookies: { mindset_session: authCookie },
      headers: { 'content-type': 'audio/webm' },
      body: binaryAudio,
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.text).toBe('We should implement exponential backoff with full jitter.');
    expect(data.provider).toBe('groq');
  });

  it('persists voice modality and original transcript in session message history', async () => {
    // 1. Create a session
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      cookies: { mindset_session: authCookie },
      payload: {
        topicId: 'auth-email-password',
        level: 'working',
        sessionMode: 'standard',
      },
    });
    expect(sessionRes.statusCode).toBe(201);
    const sessionData = JSON.parse(sessionRes.body);
    const sessionId = sessionData.session.id;

    // 2. Submit spoken answer with modality: 'voice' and original voice transcript
    const answerRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${sessionId}/answer`,
      cookies: { mindset_session: authCookie },
      payload: {
        answer: 'I would use Argon2id with 64 megabytes of memory and a 16-byte random salt.',
        modality: 'voice',
        voiceTranscriptOriginal: 'um I would use Argon 2 id with 64 megabytes of memory and like a 16 byte random salt',
      },
    });

    expect(answerRes.statusCode).toBe(200);

    // 3. Fetch session details and inspect persisted messages
    const detailsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/sessions/${sessionId}`,
      cookies: { mindset_session: authCookie },
    });

    expect(detailsRes.statusCode).toBe(200);
    const details = JSON.parse(detailsRes.body);
    const userMsg = details.messages.find((m: any) => m.role === 'user');

    expect(userMsg).toBeDefined();
    expect(userMsg.modality).toBe('voice');
    expect(userMsg.voiceTranscriptOriginal).toBe(
      'um I would use Argon 2 id with 64 megabytes of memory and like a 16 byte random salt'
    );
  });

  it('handles provider rate limits and errors with 429 / 503', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aiService = (app as any).aiService;
    mockAdapter.setBehavior({ mode: 'rate_limit', retryAfterMs: 5000 });
    for (const id of ['groq', 'gemini', 'mistral', 'cohere'] as const) {
      aiService.setMockBehavior(id, { mode: 'rate_limit', retryAfterMs: 5000 });
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/voice/transcribe',
      cookies: { mindset_session: authCookie },
      payload: {
        audioBase64: Buffer.from('test-audio').toString('base64'),
      },
    });

    expect(res.statusCode).toBe(429);
    const data = JSON.parse(res.body);
    expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});

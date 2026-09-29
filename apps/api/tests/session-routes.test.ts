import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { createDbClient } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
import { AuthRepository } from '../src/db/repositories/auth.repository';
import { hashPassphrase } from '../src/auth/service';
import { AIService } from '../src/ai/service';
import fs from 'node:fs';
import path from 'node:path';

describe('Chat Core & SSE Streaming Session Routes (Phase 3)', () => {
  let app: FastifyInstance;
  let testDbPath: string;
  let sessionCookie: string;
  const testEncryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(async () => {
    testDbPath = path.resolve(process.cwd(), `test-session-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    const dbClient = createDbClient(testDbPath);
    runMigrations(dbClient);

    const authRepo = new AuthRepository(dbClient);
    const hash = await hashPassphrase('test-passphrase-12345');
    await authRepo.ensureUserExists(hash);

    await seedDatabase(dbClient);

    const testEnv = {
      NODE_ENV: 'test' as const,
      PORT: 0,
      HOST: '127.0.0.1',
      LOG_LEVEL: 'silent' as const,
      DATABASE_URL: testDbPath,
      APP_PASSPHRASE: 'test-passphrase-12345',
      ENCRYPTION_KEY: testEncryptionKey,
      SESSION_SECRET: 'test-session-secret-at-least-32-chars-long',
      CORS_ORIGIN: 'http://localhost:3000',
    };

    app = buildApp({ env: testEnv, db: dbClient, logger: false });
    await app.ready();

    // Authenticate with seeded passphrase and obtain session cookie
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { passphrase: 'test-passphrase-12345' },
    });

    const cookies = loginRes.cookies;
    const sessionTokenCookie = cookies.find((c) => c.name === 'mindset_session');
    expect(sessionTokenCookie).toBeDefined();
    sessionCookie = `mindset_session=${sessionTokenCookie!.value}`;

    // Configure mock AI behavior for consistent grading and streaming
    const aiService = (app as any).aiService as AIService;
    aiService.setMockBehavior('gemini', {
      content: JSON.stringify({
        qualityScore: 4,
        coveredKeyPoints: ['Who are the users', 'Target scale'],
        missingKeyPoints: [],
        feedback: 'Superb initial clarifying questions.',
        suggestedFollowup: 'How should we store passwords in the database?',
        isPass: true,
      }),
    });
  });

  afterEach(async () => {
    await app.close();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // ignore
      }
    }
  });

  it('creates a new session and returns initial coach question', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { cookie: sessionCookie },
      payload: {
        topicId: 'auth-email-password',
        level: 'working',
        sessionMode: 'standard',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.session.id).toBeDefined();
    expect(body.currentStep).toBe(1);
    expect(body.hintsRemaining).toBe(2);
    expect(body.initialQuestion).toContain('Before writing any code');

    // Verify initial message stored in DB
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/sessions/${body.session.id}`,
      headers: { cookie: sessionCookie },
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = getRes.json();
    expect(getBody.messages).toHaveLength(1);
    expect(getBody.messages[0].role).toBe('coach');
  });

  it('submits an answer and receives Server-Sent Events (SSE) stream', async () => {
    // 1. Create session
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { cookie: sessionCookie },
      payload: {
        topicId: 'auth-email-password',
        level: 'working',
        sessionMode: 'standard',
      },
    });
    const sessionId = startRes.json().session.id;

    // 2. Submit answer via POST /sessions/:id/answer
    const answerRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${sessionId}/answer`,
      headers: { cookie: sessionCookie },
      payload: {
        answer: 'I would clarify user categories, expected throughput, and whether email verification is required.',
      },
    });

    expect(answerRes.statusCode).toBe(200);
    expect(answerRes.headers['content-type']).toContain('text/event-stream');

    const rawStream = answerRes.body;
    expect(rawStream).toContain('event: grade');
    expect(rawStream).toContain('event: done');

    // Parse grade event data
    const gradeEventMatch = rawStream.match(/event: grade\ndata: (\{.*?\})\n/);
    expect(gradeEventMatch).not.toBeNull();
    const gradeData = JSON.parse(gradeEventMatch![1]!);

    expect(gradeData.qualityScore).toBe(4);
    expect(gradeData.independenceScore).toBe(4); // No hints used
    expect(gradeData.compositeScore).toBe(4);
    expect(gradeData.isStepPass).toBe(true);

    // Verify database persistence: both user answer and coach response are saved
    const sessionDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/sessions/${sessionId}`,
      headers: { cookie: sessionCookie },
    });

    const detailBody = sessionDetail.json();
    expect(detailBody.messages.length).toBeGreaterThanOrEqual(3); // Initial coach Q, User A, Coach feedback
    expect(detailBody.steps).toHaveLength(1);
    expect(detailBody.steps[0].qualityScore).toBe(4);
    expect(detailBody.steps[0].independenceScore).toBe(4);
  });

  it('enforces the hint ladder and caps hints at 2 per step', async () => {
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { cookie: sessionCookie },
      payload: { topicId: 'auth-email-password', level: 'working', sessionMode: 'standard' },
    });
    const sessionId = startRes.json().session.id;

    // Hint 1
    const h1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${sessionId}/hint`,
      headers: { cookie: sessionCookie },
    });
    expect(h1Res.statusCode).toBe(200);
    expect(h1Res.json().hintLevel).toBe(1);
    expect(h1Res.json().hintsRemaining).toBe(1);
    expect(h1Res.json().newIndependenceScore).toBe(3);

    // Hint 2
    const h2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${sessionId}/hint`,
      headers: { cookie: sessionCookie },
    });
    expect(h2Res.statusCode).toBe(200);
    expect(h2Res.json().hintLevel).toBe(2);
    expect(h2Res.json().hintsRemaining).toBe(0);
    expect(h2Res.json().newIndependenceScore).toBe(2);

    // Hint 3: Capped! Rejects with 400
    const h3Res = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${sessionId}/hint`,
      headers: { cookie: sessionCookie },
    });
    expect(h3Res.statusCode).toBe(400);
    expect(h3Res.json().error.code).toBe('MAX_HINTS_REACHED');
  });

  it('skips a step, awards model answer, and marks independence score = 0', async () => {
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { cookie: sessionCookie },
      payload: { topicId: 'auth-email-password', level: 'working', sessionMode: 'standard' },
    });
    const sessionId = startRes.json().session.id;

    const skipRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${sessionId}/skip`,
      headers: { cookie: sessionCookie },
    });

    expect(skipRes.statusCode).toBe(200);
    const body = skipRes.json();
    expect(body.skippedStepNumber).toBe(1);
    expect(body.modelAnswer).toBeDefined();

    // Verify step persistence has independence score 0
    const sessionDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/sessions/${sessionId}`,
      headers: { cookie: sessionCookie },
    });

    const step = sessionDetail.json().steps[0];
    expect(step.independenceScore).toBe(0);
    expect(step.qualityScore).toBe(1);
  });
});

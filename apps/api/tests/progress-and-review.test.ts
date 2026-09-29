import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { createDbClient } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
import { AuthRepository } from '../src/db/repositories/auth.repository';
import { hashPassphrase } from '../src/auth/service';
import { AppEnv } from '../src/config/env';

const TEST_ENV: AppEnv = {
  NODE_ENV: 'test',
  PORT: 0,
  HOST: '127.0.0.1',
  CORS_ORIGIN: 'http://localhost:3000',
  SESSION_SECRET: 'test-session-secret-at-least-32-chars-long-xyz',
  DATABASE_PATH: ':memory:',
  LOG_LEVEL: 'silent',
  APP_PASSPHRASE: 'test-secure-passphrase-2026',
  MASTER_KEY_HEX: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
};

describe('Progress, Reviews & History Routes (Phase 6)', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  let testSessionId: string;
  let testReviewItemId: string;

  beforeAll(async () => {
    const db = createDbClient(':memory:');
    runMigrations(db);
    const authRepo = new AuthRepository(db);
    const hash = await hashPassphrase('test-secure-passphrase-2026');
    await authRepo.ensureUserExists(hash);
    await seedDatabase(db);

    app = buildApp({ env: TEST_ENV, db, logger: false });
    await app.ready();

    // Authenticate
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { passphrase: 'test-secure-passphrase-2026' },
    });
    const sessionCookieObj = loginRes.cookies.find((c) => c.name === 'mindset_session');
    sessionCookie = `mindset_session=${sessionCookieObj!.value}`;

    // Create a completed test session to populate progress data
    const sess = await app.sessionRepo.createSession({
      topicId: 'auth-email-password',
      level: 'working',
      sessionMode: 'standard',
    });
    testSessionId = sess!.id;

    // Record 2 steps with quality and independence scores
    await app.sessionRepo.recordStep({
      sessionId: testSessionId,
      stepNumber: 1,
      stepSlug: 'problem_exploration',
      qualityScore: 3.5,
      independenceScore: 4,
      coachQuestion: 'What are the core requirements?',
      userAnswer: 'Argon2id and rate limiting on failed attempts.',
      completedAt: new Date().toISOString(),
    });

    await app.sessionRepo.recordStep({
      sessionId: testSessionId,
      stepNumber: 2,
      stepSlug: 'architecture_tradeoffs',
      qualityScore: 3.2,
      independenceScore: 3,
      coachQuestion: 'Compare bcrypt and argon2id.',
      userAnswer: 'Argon2id has memory hardness resistance against GPU/ASIC attacks.',
      completedAt: new Date().toISOString(),
    });

    await app.sessionRepo.updateSessionState(testSessionId, 'SESSION_COMPLETED', new Date().toISOString());

    // Record an initial review item
    await app.sessionRepo.recordReviewItem('auth-email-password', 1, 'problem_framing', {
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 0,
      nextDue: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago (due now)
      lastQuality: 3,
    });

    const due = await app.sessionRepo.getDueReviewsWithTopics();
    testReviewItemId = due[0].id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('rejects unauthenticated requests to progress endpoints with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/progress/overview',
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns comprehensive progress overview for authenticated user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/progress/overview',
      headers: { cookie: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    const { data } = body;
    expect(data.overallReadiness).toBeGreaterThan(0);
    expect(data.avgQuality).toBeGreaterThan(0);
    expect(data.avgIndependence).toBeGreaterThan(0);
    expect(data.completedSessionsCount).toBeGreaterThanOrEqual(1);
    expect(data.streakDays).toBeGreaterThanOrEqual(1);

    // Verify Radar dimensions (Quality only, scale 0-4)
    expect(Array.isArray(data.dimensions)).toBe(true);
    expect(data.dimensions.length).toBe(5);
    data.dimensions.forEach((dim: any) => {
      expect(dim.name).toBeDefined();
      expect(dim.slug).toBeDefined();
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(4.0);
      expect(dim.max).toBe(4.0);
    });

    // Verify Independence trend is separate
    expect(Array.isArray(data.independenceTrend)).toBe(true);
    expect(data.independenceTrend.length).toBeGreaterThan(0);
  });

  it('returns past session history list and session details', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/progress/history',
      headers: { cookie: sessionCookie },
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    expect(listBody.success).toBe(true);
    expect(Array.isArray(listBody.data)).toBe(true);
    expect(listBody.data.length).toBeGreaterThan(0);

    const sessionSummary = listBody.data[0];
    expect(sessionSummary.topicTitle).toBeDefined();
    expect(sessionSummary.stepsCount).toBeGreaterThanOrEqual(1);

    // Inspect individual session details
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/progress/sessions/${testSessionId}`,
      headers: { cookie: sessionCookie },
    });

    expect(detailRes.statusCode).toBe(200);
    const detailBody = JSON.parse(detailRes.body);
    expect(detailBody.success).toBe(true);
    expect(detailBody.data.session.id).toBe(testSessionId);
    expect(detailBody.data.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('returns 404 for non-existent session detail query', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/progress/sessions/non-existent-session-id',
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects unauthenticated requests to review queue with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reviews/due',
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns due review items with enriched topic metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reviews/due',
      headers: { cookie: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    const item = body.data[0];
    expect(item.id).toBeDefined();
    expect(item.topicTitle).toBeDefined();
    expect(item.stepTitle).toBeDefined();
    expect(item.isDue).toBe(true);
  });

  it('returns review queue stats (dueToday, dueThisWeek, totalTracked)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reviews/stats',
      headers: { cookie: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.totalTracked).toBeGreaterThanOrEqual(1);
    expect(body.data.dueToday).toBeGreaterThanOrEqual(1);
  });

  it('rejects invalid recall scores on review items with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reviews/${testReviewItemId}/answer`,
      headers: { cookie: sessionCookie },
      payload: { quality: 5 }, // must be 1-4
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('INVALID_QUALITY_SCORE');
  });

  it('processes review recall rating and adapts SM-2 schedule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reviews/${testReviewItemId}/answer`,
      headers: { cookie: sessionCookie },
      payload: { quality: 4 }, // Easy recall
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    const updated = body.data;
    expect(updated.repetitions).toBe(1);
    expect(updated.intervalDays).toBe(1);
    expect(updated.lastQuality).toBe(4);
    expect(new Date(updated.nextDue).getTime()).toBeGreaterThan(Date.now());
  });
});

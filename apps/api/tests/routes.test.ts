import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { createDbClient } from '../src/db/client';
import { hashPassphrase } from '../src/auth/service';
import { AuthRepository } from '../src/db/repositories/auth.repository';

describe('Fastify Server & Route Integration Tests', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const testDb = createDbClient(':memory:');

    // Run table creation on in-memory SQLite
    const sqlite = testDb.$client;
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS user (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS credential (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        passphrase_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS session_auth (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        hashed_token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        user_agent TEXT,
        ip_address TEXT
      );
      CREATE TABLE IF NOT EXISTS topic (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        standard_steps TEXT NOT NULL,
        prerequisites TEXT NOT NULL DEFAULT '[]',
        learning_objectives TEXT NOT NULL,
        key_tradeoffs TEXT NOT NULL,
        common_pitfalls TEXT NOT NULL,
        transfer_topic_id TEXT NOT NULL,
        transfer_prompt TEXT NOT NULL,
        estimated_minutes INTEGER NOT NULL,
        tags TEXT NOT NULL,
        is_custom INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        steps_data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Seed test user with known passphrase
    const authRepo = new AuthRepository(testDb);
    const hash = await hashPassphrase('correct-horse-battery-staple');
    await authRepo.ensureUserExists(hash);

    app = buildApp({
      db: testDb,
      logger: false,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /healthz returns 200 with liveness status and RateLimit headers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();

    // Verify RateLimit headers aligned to IETF standard draft
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
    expect(res.headers['ratelimit-reset']).toBeDefined();

    // Verify Helmet security headers
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('GET /readyz returns 200 with database connectivity verification', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/readyz',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.db).toBe('connected');
  });

  it('POST /api/v1/auth/login rejects empty or invalid body with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/auth/login rejects incorrect passphrase with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { passphrase: 'wrong-passphrase' },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('handles complete login, session authentication, and logout lifecycle', async () => {
    // 1. Login with correct passphrase
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { passphrase: 'correct-horse-battery-staple' },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = JSON.parse(loginRes.body);
    expect(loginBody.user.id).toBeDefined();

    // Cookie must be set with HttpOnly and SameSite=Lax
    const setCookie = loginRes.headers['set-cookie'] as string;
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('mindset_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');

    // Extract cookie value for subsequent requests
    const cookieHeader = setCookie.split(';')[0];

    // 2. GET /me with valid cookie
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        cookie: cookieHeader,
      },
    });

    expect(meRes.statusCode).toBe(200);
    const meBody = JSON.parse(meRes.body);
    expect(meBody.authenticated).toBe(true);
    expect(meBody.user.id).toBe(loginBody.user.id);

    // 3. GET /me without cookie -> 401
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });
    expect(unauthRes.statusCode).toBe(401);

    // 4. Logout with cookie
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        cookie: cookieHeader,
      },
    });
    expect(logoutRes.statusCode).toBe(200);

    // 5. GET /me after logout -> 401 (session revoked in database)
    const afterLogoutRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        cookie: cookieHeader,
      },
    });
    expect(afterLogoutRes.statusCode).toBe(401);
  });
});

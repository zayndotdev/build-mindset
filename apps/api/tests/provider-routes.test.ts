import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { createDbClient } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { providerConfigs } from '../src/db/schema';
import { hashPassphrase } from '../src/auth/service';
import { ProviderRepository } from '../src/db/repositories/provider.repository';
import { decryptApiKey } from '@mindset/shared';
import fs from 'node:fs';
import path from 'node:path';

describe('Provider Routes & Encryption (Phase 2)', () => {
  let app: FastifyInstance;
  let testDbPath: string;
  let sessionCookie: string;
  const testEncryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(async () => {
    testDbPath = path.resolve(process.cwd(), `test-provider-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    const dbClient = createDbClient(testDbPath);
    runMigrations(dbClient);

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

    // 1. Initial setup to create user and session
    const setupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/setup',
      payload: { passphrase: 'test-passphrase-12345' },
    });

    const cookies = setupRes.cookies;
    const sessionTokenCookie = cookies.find((c) => c.name === 'mindset_session');
    expect(sessionTokenCookie).toBeDefined();
    sessionCookie = `mindset_session=${sessionTokenCookie!.value}`;
  });

  afterEach(async () => {
    await app.close();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // ignore on Windows if lock takes a split second
      }
    }
  });

  it('rejects unauthenticated requests to /api/v1/providers with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/providers',
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns default seeded providers with masked credentials', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/providers',
      headers: { cookie: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.providers).toHaveLength(4);

    const gemini = body.providers.find((p: any) => p.id === 'gemini');
    expect(gemini).toBeDefined();
    expect(gemini.priority).toBe(1);
    expect(gemini.isGradingPrimary).toBe(true);
    expect(gemini.hasKey).toBe(false);
    expect(gemini.circuitState).toBe('CLOSED');
    expect(gemini.isResting).toBe(false);
    // Raw key or encrypted key must NEVER be leaked in API response
    expect(gemini.apiKey).toBeUndefined();
    expect(gemini.apiKeyEncrypted).toBeUndefined();
  });

  it('securely encrypts API key using AES-256-GCM and stores in database', async () => {
    const rawApiKey = 'test-gemini-secret-api-key-999';

    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/providers/gemini/key',
      headers: { cookie: sessionCookie },
      payload: { apiKey: rawApiKey },
    });

    expect(putRes.statusCode).toBe(200);
    expect(putRes.json().hasKey).toBe(true);

    // Verify database record has ciphertext, not raw plaintext
    const dbRows = await (app as any).db.select().from(providerConfigs).all();
    const geminiRow = dbRows.find((r: any) => r.id === 'gemini');

    expect(geminiRow.apiKeyEncrypted).toBeDefined();
    expect(geminiRow.apiKeyEncrypted).not.toContain(rawApiKey);
    expect(geminiRow.apiKeyEncrypted).toMatch(/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i); // iv:tag:ciphertext

    // Verify decryption matches original key
    const decrypted = decryptApiKey(geminiRow.apiKeyEncrypted, testEncryptionKey);
    expect(decrypted).toBe(rawApiKey);

    // Verify GET response now reports hasKey: true
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/providers',
      headers: { cookie: sessionCookie },
    });

    const p = getRes.json().providers.find((item: any) => item.id === 'gemini');
    expect(p.hasKey).toBe(true);
  });

  it('updates provider configuration (model, priority, isGradingPrimary)', async () => {
    const updateRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/providers/groq/config',
      headers: { cookie: sessionCookie },
      payload: {
        model: 'llama-3.3-70b-versatile',
        priority: 1,
        isGradingPrimary: true,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().provider.isGradingPrimary).toBe(true);
    expect(updateRes.json().provider.priority).toBe(1);

    // Verify that previously pinned grader (gemini) is no longer primary
    const providerRepo = (app as any).providerRepo as ProviderRepository;
    const gemini = await providerRepo.getProvider('gemini');
    expect(gemini?.isGradingPrimary).toBe(false);
  });

  it('tests provider connectivity with mock adapter', async () => {
    const testRes = await app.inject({
      method: 'POST',
      url: '/api/v1/providers/groq/test',
      headers: { cookie: sessionCookie },
      payload: { apiKey: 'test-key-mock' },
    });

    expect(testRes.statusCode).toBe(200);
    const body = testRes.json();
    expect(body.success).toBe(true);
    expect(body.models.length).toBeGreaterThan(0);
  });

  it('deletes API key and resets hasKey to false', async () => {
    // Set key
    await app.inject({
      method: 'PUT',
      url: '/api/v1/providers/mistral/key',
      headers: { cookie: sessionCookie },
      payload: { apiKey: 'mistral-api-key-test' },
    });

    // Delete key
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/providers/mistral/key',
      headers: { cookie: sessionCookie },
    });

    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().hasKey).toBe(false);

    // Verify in GET /api/v1/providers
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/providers',
      headers: { cookie: sessionCookie },
    });
    const mistral = getRes.json().providers.find((p: any) => p.id === 'mistral');
    expect(mistral.hasKey).toBe(false);
  });
});

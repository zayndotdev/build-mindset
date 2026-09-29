import { buildApp } from '../apps/api/src/app';
import { createDbClient } from '../apps/api/src/db/client';
import { runMigrations } from '../apps/api/src/db/migrate';
import { seedDatabase } from '../apps/api/src/db/seed';
import { AppEnv } from '../apps/api/src/config/env';
import fs from 'node:fs';
import path from 'node:path';

async function verifyNativeHealth() {
  console.log('[Verify Health] Starting native local verification test...');
  const testDbPath = path.resolve(process.cwd(), 'temp-verify-health.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const env: AppEnv = {
    NODE_ENV: 'test',
    PORT: 3333,
    HOST: '127.0.0.1',
    DATABASE_PATH: testDbPath,
    SESSION_SECRET: 'test-session-secret-at-least-32-chars-long-xyz',
    LOG_LEVEL: 'silent',
    MASTER_KEY_HEX: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    APP_PASSPHRASE: 'test-passphrase-2026',
    CORS_ORIGIN: 'http://localhost:3000',
  };

  const db = createDbClient(testDbPath);
  runMigrations(db);
  await seedDatabase(db);

  const app = buildApp({ env, db, logger: false });
  await app.listen({ port: 3333, host: '127.0.0.1' });
  console.log('[Verify Health] API listening on http://127.0.0.1:3333');

  try {
    // 1. Check /healthz
    const healthRes = await fetch('http://127.0.0.1:3333/healthz');
    console.log('[Verify Health] /healthz HTTP status:', healthRes.status);
    const healthJson = (await healthRes.json()) as any;
    console.log('[Verify Health] /healthz response body:', JSON.stringify(healthJson));
    if (healthRes.status !== 200 || healthJson.status !== 'ok') {
      throw new Error(`Healthz check failed: status ${healthRes.status}`);
    }

    // 2. Check /readyz
    const readyRes = await fetch('http://127.0.0.1:3333/readyz');
    console.log('[Verify Health] /readyz HTTP status:', readyRes.status);
    const readyJson = (await readyRes.json()) as any;
    console.log('[Verify Health] /readyz response body:', JSON.stringify(readyJson));
    if (readyRes.status !== 200 || readyJson.status !== 'ok' || readyJson.db !== 'connected') {
      throw new Error(`Readyz check failed: status ${readyRes.status}`);
    }

    console.log('[Verify Health] ALL NATIVE HEALTH & READINESS ENDPOINTS VERIFIED GREEN!');
  } finally {
    await app.close();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  }
}

verifyNativeHealth()
  .then(() => {
    console.log('[Verify Health] Completed cleanly.');
  })
  .catch((err) => {
    console.error('[Verify Health] Verification failed:', err);
    process.exit(1);
  });

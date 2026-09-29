import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createDbClient } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
import { AuthRepository } from '../src/db/repositories/auth.repository';
import { SessionRepository } from '../src/db/repositories/session.repository';
import { hashPassphrase } from '../src/auth/service';
import { createEncryptedBackup, restoreEncryptedBackup } from '@mindset/shared';

describe('Automated Backup & Restore Pipeline (Phase 7)', () => {
  const masterKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const wrongKey = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

  const sourceDbPath = path.resolve(process.cwd(), 'test-live-backup-source.db');
  const backupEncPath = path.resolve(process.cwd(), 'test-live-backup.enc');
  const restoredDbPath = path.resolve(process.cwd(), 'test-live-backup-restored.db');

  beforeAll(async () => {
    // Cleanup any leftovers
    [sourceDbPath, backupEncPath, restoredDbPath].forEach((p) => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    // 1. Initialize and populate source database
    const db = createDbClient(sourceDbPath);
    runMigrations(db);

    const authRepo = new AuthRepository(db);
    const hash = await hashPassphrase('backup-test-passphrase-2026');
    await authRepo.ensureUserExists(hash);
    await seedDatabase(db);

    const sessionRepo = new SessionRepository(db);
    const sess = await sessionRepo.createSession({
      topicId: 'auth-email-password',
      level: 'working',
      sessionMode: 'standard',
    });

    await sessionRepo.recordStep({
      sessionId: sess!.id,
      stepNumber: 1,
      stepSlug: 'problem_exploration',
      qualityScore: 3.8,
      independenceScore: 4,
      coachQuestion: 'What hashing algorithm should we use?',
      userAnswer: 'Argon2id with memory-hardness configuration.',
    });

    await sessionRepo.recordReviewItem('auth-email-password', 1, 'problem_framing', {
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 1,
      nextDue: new Date().toISOString(),
      lastQuality: 4,
    });
  });

  afterAll(() => {
    [sourceDbPath, backupEncPath, restoredDbPath].forEach((p) => {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {}
    });
  });

  it('creates an AES-256-GCM encrypted backup with valid header and tamper protection', async () => {
    const backupFile = await createEncryptedBackup({
      dbPath: sourceDbPath,
      outputPath: backupEncPath,
      masterKeyHex: masterKey,
    });

    expect(fs.existsSync(backupFile)).toBe(true);

    const backupBytes = fs.readFileSync(backupFile);
    expect(backupBytes.length).toBeGreaterThan(100);

    // Verify magic header: 'MBKP' + version 0x01
    const magic = backupBytes.subarray(0, 4).toString('utf8');
    const version = backupBytes[4];
    expect(magic).toBe('MBKP');
    expect(version).toBe(0x01);

    // Plaintext SQLite string should NOT be visible anywhere in the ciphertext
    expect(backupBytes.includes(Buffer.from('SQLite format 3'))).toBe(false);
  });

  it('rejects restore when provided an incorrect master key', async () => {
    await expect(
      restoreEncryptedBackup({
        backupPath: backupEncPath,
        targetDbPath: restoredDbPath,
        masterKeyHex: wrongKey,
      })
    ).rejects.toThrow();
  });

  it('rejects restore when ciphertext or auth tag is tampered with', async () => {
    const tamperedPath = `${backupEncPath}.tampered`;
    const bytes = Buffer.from(fs.readFileSync(backupEncPath));
    // Flip a byte in the ciphertext payload
    bytes[bytes.length - 5] ^= 0xff;
    fs.writeFileSync(tamperedPath, bytes);

    await expect(
      restoreEncryptedBackup({
        backupPath: tamperedPath,
        targetDbPath: restoredDbPath,
        masterKeyHex: masterKey,
      })
    ).rejects.toThrow();

    if (fs.existsSync(tamperedPath)) fs.unlinkSync(tamperedPath);
  });

  it('restores database perfectly and verifies all records, schema, and relations', async () => {
    const restoredFile = await restoreEncryptedBackup({
      backupPath: backupEncPath,
      targetDbPath: restoredDbPath,
      masterKeyHex: masterKey,
    });

    expect(fs.existsSync(restoredFile)).toBe(true);

    // Connect to restored DB and verify contents
    const restoredDb = createDbClient(restoredFile);
    const authRepo = new AuthRepository(restoredDb);
    const sessionRepo = new SessionRepository(restoredDb);

    // 1. Verify user exists
    const user = await authRepo.getUser();
    expect(user).not.toBeNull();
    const cred = await authRepo.getCredential();
    expect(cred).not.toBeNull();

    // 2. Verify sessions and steps exist
    const sessions = await sessionRepo.listRecentSessions();
    expect(sessions.length).toBeGreaterThanOrEqual(1);

    const steps = await sessionRepo.getSteps(sessions[0].id);
    expect(steps.length).toBe(1);
    expect(steps[0].userAnswer).toBe('Argon2id with memory-hardness configuration.');
    expect(steps[0].qualityScore).toBe(3.8);
    expect(steps[0].independenceScore).toBe(4);

    // 3. Verify review items
    const reviews = await sessionRepo.getDueReviewsWithTopics();
    expect(reviews.length).toBeGreaterThanOrEqual(1);
    expect(reviews[0].topicTitle).toBeDefined();

    // 4. Verify progress overview can compute from restored data
    const overview = await sessionRepo.getProgressOverview();
    expect(overview.totalSessions).toBeGreaterThanOrEqual(1);
    expect(overview.avgQuality).toBe(3.8);
  });
});

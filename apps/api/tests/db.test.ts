import { describe, it, expect, beforeEach } from 'vitest';
import { createDbClient, AppDatabase } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { AuthRepository } from '../src/db/repositories/auth.repository';
import { TopicRepository } from '../src/db/repositories/topic.repository';
import { hashPassphrase } from '../src/auth/service';
import { topics } from '../src/db/schema';
import fs from 'node:fs';
import path from 'node:path';

describe('Database Repositories — SQLite & Drizzle ORM', () => {
  let db: AppDatabase;
  let authRepo: AuthRepository;
  let topicRepo: TopicRepository;

  beforeEach(async () => {
    // Fresh in-memory database
    db = createDbClient(':memory:');
    runMigrations(db);

    authRepo = new AuthRepository(db);
    topicRepo = new TopicRepository(db);
  });

  it('initializes single user and credentials', async () => {
    const hash = await hashPassphrase('test-passphrase-1234');
    const user = await authRepo.ensureUserExists(hash);
    expect(user).toBeDefined();
    expect(user.userId).toBeDefined();

    const cred = await authRepo.getCredential();
    expect(cred).not.toBeNull();
    expect(cred?.passphraseHash).toBe(hash);
  });

  it('stores and validates session auth tokens', async () => {
    const hash = await hashPassphrase('test-passphrase-1234');
    const { userId } = await authRepo.ensureUserExists(hash);

    const tokenHash = 'sha256-mock-token-hash-123456';
    const expiresAt = new Date(Date.now() + 86400000).toISOString();

    await authRepo.createSession(userId, tokenHash, expiresAt, 'TestAgent', '127.0.0.1');

    const session = await authRepo.getSessionByHashedToken(tokenHash);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe(userId);
    expect(session?.hashedToken).toBe(tokenHash);

    // Revocation / logout
    await authRepo.deleteSession(tokenHash);
    const deletedSession = await authRepo.getSessionByHashedToken(tokenHash);
    expect(deletedSession).toBeNull();
  });

  it('seeds and retrieves seed topics', async () => {
    const seedFilePath = path.resolve(__dirname, '../../../packages/learning/topics/auth-email-password.json');
    const rawData = JSON.parse(fs.readFileSync(seedFilePath, 'utf8'));

    await topicRepo.seedTopic(rawData);

    const topic = await topicRepo.getTopicById('auth-email-password');
    expect(topic).not.toBeNull();
    expect(topic?.title).toBe('Email + Password Authentication');
    expect(topic?.category).toBe('authentication');
    expect(topic?.standardSteps).toEqual([1, 5, 8, 9]);

    const allTopics = await topicRepo.listTopics();
    expect(allTopics.length).toBeGreaterThanOrEqual(1);
  });

  it('rolls back database operations on transaction failure', async () => {
    const initialTopics = await topicRepo.listTopics();
    const countBefore = initialTopics.length;

    await expect(
      db.transaction(async (tx) => {
        await tx.insert(topics).values({
          id: 'rollback-test-topic',
          title: 'Rollback Test',
          category: 'test',
          difficulty: 'beginner',
          standardSteps: [1, 2, 3, 4],
          prerequisites: [],
          learningObjectives: ['test'],
          keyTradeoffs: ['test'],
          commonPitfalls: ['test'],
          transferTopicId: 'none',
          transferPrompt: 'test',
          estimatedMinutes: 10,
          tags: ['test'],
          isCustom: true,
          isActive: true,
          stepsData: JSON.stringify({}),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).run();

        // Intentionally throw an exception to force rollback
        throw new Error('Simulated transaction failure');
      })
    ).rejects.toThrow('Simulated transaction failure');

    const topicsAfter = await topicRepo.listTopics();
    expect(topicsAfter.length).toBe(countBefore);
    const rolledBackTopic = await topicRepo.getTopicById('rollback-test-topic');
    expect(rolledBackTopic).toBeNull();
  });
});

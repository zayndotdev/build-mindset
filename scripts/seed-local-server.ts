import { createDbClient } from '../apps/api/src/db/client';
import { runMigrations } from '../apps/api/src/db/migrate';
import { seedDatabase } from '../apps/api/src/db/seed';
import { AuthRepository } from '../apps/api/src/db/repositories/auth.repository';
import { SessionRepository } from '../apps/api/src/db/repositories/session.repository';
import { hashPassphrase } from '../apps/api/src/auth/service';
import path from 'node:path';

async function seedLocal() {
  const dbPath = path.resolve(process.cwd(), 'data/mindset.db');
  console.log(`[Seed Local] Seeding database at ${dbPath}`);
  const db = createDbClient(dbPath);
  runMigrations(db);

  const authRepo = new AuthRepository(db);
  const hash = await hashPassphrase('test-passphrase-2026');
  await authRepo.ensureUserExists(hash);
  await seedDatabase(db);

  const sessionRepo = new SessionRepository(db);
  const existing = await sessionRepo.listRecentSessions();
  if (existing.length === 0) {
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
      coachQuestion: 'What are the core requirements and attack surfaces for username/password authentication?',
      userAnswer: 'Argon2id for password hashing with random salt, rate limiting on login endpoint, and timing attack mitigation.',
      completedAt: new Date().toISOString(),
    });

    await sessionRepo.recordStep({
      sessionId: sess!.id,
      stepNumber: 2,
      stepSlug: 'architecture_tradeoffs',
      qualityScore: 3.5,
      independenceScore: 3,
      coachQuestion: 'How would you choose between bcrypt, scrypt, and argon2id in modern production?',
      userAnswer: 'Argon2id is memory-hard and parameterized against both GPU and ASIC brute-force attacks, winner of the Password Hashing Competition.',
      completedAt: new Date().toISOString(),
    });

    await sessionRepo.updateSessionState(sess!.id, 'SESSION_COMPLETED', new Date().toISOString());

    await sessionRepo.recordReviewItem('auth-email-password', 1, 'problem_framing', {
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 1,
      nextDue: new Date().toISOString(),
      lastQuality: 4,
    });

    await sessionRepo.recordEnglishReport(sess!.id, {
      corrections: [
        { original: 'We use hashing algorithm', corrected: 'We use a hashing algorithm', reason: 'Missing indefinite article' },
      ],
      technicalVocab: ['Argon2id', 'Memory-Hardness', 'Timing Attacks', 'Constant-Time Comparison'],
      seniorRewrite: 'In production, we employ Argon2id with fine-tuned memory and time cost parameters to neutralize specialized hardware brute-force attacks.',
    });
  }

  console.log('[Seed Local] Database seeded successfully with user, topics, session history, and review items.');
}

seedLocal()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[Seed Local] Failed:', err);
    process.exit(1);
  });

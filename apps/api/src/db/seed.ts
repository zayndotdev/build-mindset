import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './client';
import { runMigrations } from './migrate';
import { AuthRepository } from './repositories/auth.repository';
import { TopicRepository } from './repositories/topic.repository';
import { ProviderRepository } from './repositories/provider.repository';
import { hashPassphrase } from '../auth/service';
import { TopicSchema } from '@mindset/shared';
import { getEnv } from '../config/env';

export async function seedDatabase(db = getDb()): Promise<void> {
  const env = getEnv();
  // Ensure schema exists first
  runMigrations(db);

  const authRepo = new AuthRepository(db);
  const topicRepo = new TopicRepository(db);
  const providerRepo = new ProviderRepository(db);

  // 1. Ensure User & Credential exist if APP_PASSPHRASE provided
  const existingCred = await authRepo.getCredential();
  if (!existingCred && env.APP_PASSPHRASE) {
    const hash = await hashPassphrase(env.APP_PASSPHRASE);
    await authRepo.ensureUserExists(hash);
    console.log('[Seed] Single user and initial passphrase hash initialized from APP_PASSPHRASE.');
  }

  // 2. Ensure default providers (gemini, groq, mistral, cohere) exist
  await providerRepo.ensureDefaultProviders();
  console.log('[Seed] Default provider configs verified.');

  // 2. Seed all topics from packages/learning/topics
  const candidateDirs = [
    path.resolve(process.cwd(), 'packages/learning/topics'),
    path.resolve(process.cwd(), '../packages/learning/topics'),
    path.resolve(process.cwd(), '../../packages/learning/topics'),
  ];
  const topicsDir = candidateDirs.find((d) => fs.existsSync(d));
  if (topicsDir && fs.existsSync(topicsDir)) {
    const files = fs.readdirSync(topicsDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const fullPath = path.join(topicsDir, file);
        const rawContent = fs.readFileSync(fullPath, 'utf8');
        const parsedJson = JSON.parse(rawContent);
        const validated = TopicSchema.parse(parsedJson);

        await topicRepo.seedTopic(validated);
        console.log(`[Seed] Successfully seeded topic: ${validated.id}`);
      } catch (err: unknown) {
        console.warn(`[Seed] Warning seeding ${file}:`, (err as Error).message);
      }
    }
  }
}

// When run directly as a script
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  console.log('Seeding database...');
  seedDatabase()
    .then(() => {
      console.log('Database seeding finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database seeding failed:', err);
      process.exit(1);
    });
}

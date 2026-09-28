import { buildApp } from './app';
import { getEnv } from './config/env';
import { runMigrations } from './db/migrate';
import { seedDatabase } from './db/seed';

async function main() {
  const env = getEnv();

  // Run migrations and seeds on startup
  console.log('[Mindset API] Initializing database...');
  runMigrations();
  await seedDatabase();

  const app = buildApp({ env });

  const host = '0.0.0.0';
  const port = env.PORT;

  try {
    const address = await app.listen({ port, host });
    console.log(`[Mindset API] Server running at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'] as const;
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`[Mindset API] Received ${signal}, closing server...`);
      await app.close();
      console.log('[Mindset API] Server closed gracefully.');
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error('[Mindset API] Fatal startup error:', err);
  process.exit(1);
});

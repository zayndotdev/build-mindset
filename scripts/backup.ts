import { createEncryptedBackup } from '@mindset/shared';
import { getEnv } from '../apps/api/src/config/env';

export { createEncryptedBackup };

// Direct execution
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  let envKey = '';
  let envDb = './data/mindset.db';
  try {
    const env = getEnv();
    envKey = env.MASTER_KEY_HEX;
    envDb = env.DATABASE_PATH;
  } catch {}

  const customDb = process.argv[2] || process.env.DATABASE_PATH || envDb;
  const customOut = process.argv[3];
  const masterKey = process.env.MASTER_KEY_HEX || envKey;

  createEncryptedBackup({ dbPath: customDb, outputPath: customOut, masterKeyHex: masterKey })
    .then((p) => {
      console.log(`[Backup] Completed successfully: ${p}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[Backup] Failed:`, err);
      process.exit(1);
    });
}

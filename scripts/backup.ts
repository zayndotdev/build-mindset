import { createEncryptedBackup } from '@mindset/shared';
import { getEnv } from '../apps/api/src/config/env';

export { createEncryptedBackup };

import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Direct execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  let envKey = process.env.MASTER_KEY_HEX || '';
  let envDb = process.env.DATABASE_URL || process.env.DATABASE_PATH || './data/mindset.db';
  try {
    const env = getEnv();
    envKey = envKey || (env as any).MASTER_KEY_HEX || env.ENCRYPTION_KEY;
    envDb = (env as any).DATABASE_PATH || env.DATABASE_URL || envDb;
  } catch {}

  const customDb = process.argv[2] || envDb;
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

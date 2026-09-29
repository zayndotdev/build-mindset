import { restoreEncryptedBackup } from '@mindset/shared';
import { getEnv } from '../apps/api/src/config/env';

export { restoreEncryptedBackup };

import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Direct execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const backupFile = process.argv[2];
  let envKey = process.env.MASTER_KEY_HEX || '';
  let envDb = process.env.DATABASE_URL || process.env.DATABASE_PATH || './data/mindset.db';
  try {
    const env = getEnv();
    envKey = envKey || (env as any).MASTER_KEY_HEX || env.ENCRYPTION_KEY;
    envDb = (env as any).DATABASE_PATH || env.DATABASE_URL || envDb;
  } catch {}

  const targetDb = process.argv[3] || envDb;
  const masterKey = process.env.MASTER_KEY_HEX || envKey;

  if (!backupFile) {
    console.error('Usage: tsx scripts/restore.ts <path-to-backup.enc> [target-db-path]');
    process.exit(1);
  }

  restoreEncryptedBackup({ backupPath: backupFile, targetDbPath: targetDb, masterKeyHex: masterKey })
    .then((p) => {
      console.log(`[Restore] Completed successfully: ${p}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[Restore] Failed:`, err);
      process.exit(1);
    });
}

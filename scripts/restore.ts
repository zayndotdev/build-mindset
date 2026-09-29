import { restoreEncryptedBackup } from '@mindset/shared';
import { getEnv } from '../apps/api/src/config/env';

export { restoreEncryptedBackup };

// Direct execution
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const backupFile = process.argv[2];
  let envKey = '';
  let envDb = './data/mindset.db';
  try {
    const env = getEnv();
    envKey = env.MASTER_KEY_HEX;
    envDb = env.DATABASE_PATH;
  } catch {}

  const targetDb = process.argv[3] || process.env.DATABASE_PATH || envDb;
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

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createEncryptedBackup } from '@mindset/shared';
import { getEnv } from '../apps/api/src/config/env';

/**
 * ============================================================================
 * Mindset: Scheduled Off-VM Encrypted Backup Runner
 * ============================================================================
 * Creates an atomic, AES-256-GCM encrypted backup of the SQLite database and
 * copies it off-VM to an offsite target.
 *
 * CRITICAL SECURITY INVARIANT:
 * ----------------------------
 * The 256-bit master key (MASTER_KEY_HEX / ENCRYPTION_KEY) MUST BE STORED
 * SEPARATELY FROM THE VM.
 *
 * Storing the master key only on the VM exposes you to total data loss if the
 * VM is terminated or reclaimed (the off-VM encrypted backups cannot be
 * decrypted). Storing the key alongside the backup archive destroys encryption
 * at rest if either system is compromised. Keep an offline copy in a secure
 * password manager (1Password, Bitwarden, KeePassXC, or HashiCorp Vault).
 * ============================================================================
 */

export interface BackupOptions {
  dbPath?: string;
  backupDir?: string;
  retentionDays?: number;
  offsiteType?: 'none' | 'copy' | 'command' | 's3' | 'rclone' | 'scp';
  offsiteTarget?: string;
}

export async function runScheduledBackup(options: BackupOptions = {}): Promise<string> {
  const env = getEnv();
  const dbPath = options.dbPath || env.DATABASE_URL || 'data/mindset.db';
  const backupDir = options.backupDir || path.resolve(process.cwd(), 'backups');
  const retentionDays = options.retentionDays ?? 14;
  const offsiteType = options.offsiteType || process.env.OFFSITE_BACKUP_TYPE || 'none';
  const offsiteTarget = options.offsiteTarget || process.env.OFFSITE_BACKUP_TARGET || '';
  const masterKey = process.env.MASTER_KEY_HEX || env.ENCRYPTION_KEY;

  console.log('----------------------------------------------------------------------');
  console.log('🔒 Mindset Scheduled Encrypted Backup');
  console.log('----------------------------------------------------------------------');

  if (!masterKey || masterKey.length !== 64) {
    throw new Error(
      'FATAL: MASTER_KEY_HEX must be exactly 64 hex characters (32 bytes). Backup aborted.'
    );
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `mindset-backup-${timestamp}.mbkp`;
  const backupFilePath = path.join(backupDir, backupFileName);

  console.log(`[Backup] Source SQLite:  ${dbPath}`);
  console.log(`[Backup] Local Target:   ${backupFilePath}`);

  // 1. Create atomic, encrypted snapshot
  const createdPath = await createEncryptedBackup({
    dbPath,
    outputPath: backupFilePath,
    masterKeyHex: masterKey,
  });

  const stats = fs.statSync(createdPath);
  console.log(`[Backup] Encrypted archive created successfully (${stats.size} bytes, AES-256-GCM).`);

  // 2. Off-VM Transfer
  if (offsiteType === 'none' || !offsiteTarget) {
    console.warn('\n⚠️  WARNING: No off-VM backup destination configured (OFFSITE_BACKUP_TYPE=none).');
    console.warn('   The archive exists ONLY on this local filesystem.');
    console.warn('   Configure OFFSITE_BACKUP_TYPE (s3, rclone, scp, or copy) to enable disaster recovery.\n');
  } else {
    console.log(`[Backup] Transferring off-VM using transport [${offsiteType}] to: ${offsiteTarget}`);

    switch (offsiteType) {
      case 'copy': {
        // Direct file copy to external mount / secondary volume / network share
        const destFile = path.join(offsiteTarget, backupFileName);
        fs.copyFileSync(createdPath, destFile);
        console.log(`[Backup] Copied to off-VM mount: ${destFile}`);
        break;
      }
      case 's3': {
        execSync(`aws s3 cp "${createdPath}" "${offsiteTarget}"`, { stdio: 'inherit' });
        break;
      }
      case 'rclone': {
        execSync(`rclone copy "${createdPath}" "${offsiteTarget}"`, { stdio: 'inherit' });
        break;
      }
      case 'scp': {
        execSync(`scp -o StrictHostKeyChecking=accept-new "${createdPath}" "${offsiteTarget}"`, {
          stdio: 'inherit',
        });
        break;
      }
      case 'command': {
        // Run custom command with %FILE% placeholder
        const cmd = offsiteTarget.replace(/%FILE%/g, createdPath);
        execSync(cmd, { stdio: 'inherit' });
        break;
      }
      default:
        throw new Error(`Unsupported offsiteType: ${offsiteType}`);
    }

    console.log('[Backup] Off-VM transfer completed successfully.');
  }

  // 3. Prune local archives older than retention threshold
  try {
    const files = fs.readdirSync(backupDir);
    const now = Date.now();
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
    let prunedCount = 0;

    for (const f of files) {
      if (f.startsWith('mindset-backup-') && (f.endsWith('.mbkp') || f.endsWith('.enc'))) {
        const full = path.join(backupDir, f);
        const fstat = fs.statSync(full);
        if (now - fstat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(full);
          prunedCount++;
        }
      }
    }

    if (prunedCount > 0) {
      console.log(`[Backup] Pruned ${prunedCount} local backup archives older than ${retentionDays} days.`);
    }
  } catch (err: unknown) {
    console.warn('[Backup] Warning during retention prune:', (err as Error).message);
  }

  console.log('----------------------------------------------------------------------');
  console.log('🔑 CRITICAL REMINDER: SEPARATE MASTER KEY STORAGE');
  console.log('----------------------------------------------------------------------');
  console.log('The encrypted archive CANNOT be restored without MASTER_KEY_HEX.');
  console.log('Verify you have recorded MASTER_KEY_HEX in an offline password manager.');
  console.log('NEVER upload or store MASTER_KEY_HEX in the same bucket as the archives.');
  console.log('----------------------------------------------------------------------\n');

  return createdPath;
}

// Direct execution CLI
import { fileURLToPath } from 'node:url';

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runScheduledBackup()
    .then((p) => {
      console.log(`[Backup] Finished: ${p}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Backup] Fatal error:', err);
      process.exit(1);
    });
}

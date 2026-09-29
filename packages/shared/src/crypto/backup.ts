import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { encryptBuffer, decryptBuffer } from './encryption';

export async function createEncryptedBackup(options: {
  dbPath: string;
  outputPath?: string;
  masterKeyHex: string;
}): Promise<string> {
  const dbPath = path.resolve(process.cwd(), options.dbPath);
  const masterKey = options.masterKeyHex;

  if (!masterKey || masterKey.length !== 64) {
    throw new Error('Valid masterKeyHex (64 hex characters) is required for encrypted backup.');
  }

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found at: ${dbPath}`);
  }

  const defaultDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.resolve(
    process.cwd(),
    options.outputPath || path.join(defaultDir, `mindset-backup-${timestamp}.enc`)
  );

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Use SQLite VACUUM INTO to produce an atomic, clean snapshot with all WAL pages merged
  let dbBytes: Buffer;
  const tempSnapshot = path.resolve(
    process.cwd(),
    `temp-snap-${Date.now()}-${Math.random().toString(36).substring(7)}.db`
  );
  if (fs.existsSync(tempSnapshot)) fs.unlinkSync(tempSnapshot);

  try {
    const require = createRequire(import.meta.url);
    const { DatabaseSync } = require('node:sqlite');
    const syncDb = new DatabaseSync(dbPath);
    syncDb.exec(`VACUUM INTO '${tempSnapshot.replace(/\\/g, '/')}'`);
    syncDb.close();
    dbBytes = fs.readFileSync(tempSnapshot);
    if (fs.existsSync(tempSnapshot)) fs.unlinkSync(tempSnapshot);
  } catch (err: unknown) {
    console.warn('[Backup] VACUUM INTO fallback to direct read:', (err as Error).message);
    dbBytes = fs.readFileSync(dbPath);
  }

  // Encrypt with AES-256-GCM
  const encryptedBytes = encryptBuffer(dbBytes, masterKey);

  // Write atomically via temporary file
  const tempPath = `${outputPath}.tmp`;
  fs.writeFileSync(tempPath, encryptedBytes);
  fs.renameSync(tempPath, outputPath);

  return outputPath;
}

export async function restoreEncryptedBackup(options: {
  backupPath: string;
  targetDbPath: string;
  masterKeyHex: string;
}): Promise<string> {
  const backupPath = path.resolve(process.cwd(), options.backupPath);
  const targetDbPath = path.resolve(process.cwd(), options.targetDbPath);
  const masterKey = options.masterKeyHex;

  if (!masterKey || masterKey.length !== 64) {
    throw new Error('Valid masterKeyHex (64 hex characters) is required to restore encrypted backup.');
  }

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Encrypted backup file not found at: ${backupPath}`);
  }

  const targetDir = path.dirname(targetDbPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const encryptedBytes = fs.readFileSync(backupPath);

  // Decrypt and verify cryptographic authenticity tag
  const decryptedBytes = decryptBuffer(encryptedBytes, masterKey);

  // Validate SQLite header: first 16 bytes must be "SQLite format 3\0"
  const sqliteHeader = decryptedBytes.subarray(0, 16).toString('utf8');
  if (!sqliteHeader.startsWith('SQLite format 3')) {
    throw new Error('Restored data is not a valid SQLite database header');
  }

  // Write atomically to target path
  const tempPath = `${targetDbPath}.restoring`;
  fs.writeFileSync(tempPath, decryptedBytes);
  if (fs.existsSync(targetDbPath)) {
    fs.unlinkSync(targetDbPath);
  }
  fs.renameSync(tempPath, targetDbPath);

  return targetDbPath;
}

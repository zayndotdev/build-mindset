import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { argon2id } from 'hash-wasm';
import { randomBytes } from 'node:crypto';

async function hashPassphrase(passphrase: string): Promise<string> {
  const salt = new Uint8Array(randomBytes(16));
  return argon2id({
    password: passphrase,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'encoded',
  });
}

async function main() {
  const dbPath = path.resolve(process.cwd(), 'data/mindset.db');
  console.log('Target DB:', dbPath);

  const db = new DatabaseSync(dbPath);
  const passphrase = process.argv[2] || 'zayn';
  const newHash = await hashPassphrase(passphrase);

  db.prepare('DELETE FROM session_auth').run();
  db.prepare('DELETE FROM credential').run();

  const user = db.prepare('SELECT id FROM user LIMIT 1').get() as { id: string } | undefined;
  let userId = user?.id;
  if (!userId) {
    userId = 'user-' + Date.now();
    db.prepare('INSERT INTO user (id, created_at, updated_at) VALUES (?, ?, ?)').run(userId, new Date().toISOString(), new Date().toISOString());
  }

  db.prepare('INSERT INTO credential (id, user_id, passphrase_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
    'cred-' + Date.now(),
    userId,
    newHash,
    new Date().toISOString(),
    new Date().toISOString()
  );

  console.log(`[SUCCESS] Stored master passphrase credential for "${passphrase}" in ${dbPath}`);
}

main().catch(console.error);

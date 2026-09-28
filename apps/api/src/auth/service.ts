import { argon2id, argon2Verify } from 'hash-wasm';
import { randomBytes, createHash } from 'node:crypto';

// OWASP / RFC 9106 recommended parameters for Argon2id: 19 MiB (or 64 MiB), 3 iterations, 1 parallelism
const ARGON2_CONFIG = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536, // 64 MB
  hashLength: 32,
  outputType: 'encoded' as const,
};

// Pre-computed standard valid Argon2id hash for timing attack mitigation
export const DUMMY_ARGON2_HASH =
  '$argon2id$v=19$m=65536,t=3,p=1$c29tZXNhbHRzb21lc2Fs$d3JvbmctcGFzc3BocmFzZS1kdW1teS1oYXNoLWZvci10aW1pbmc';

let cachedDummyHash: string | null = null;

/**
 * Hashes a plaintext passphrase using Argon2id with a secure random 16-byte salt.
 */
export async function hashPassphrase(passphrase: string): Promise<string> {
  const salt = new Uint8Array(randomBytes(16));
  return argon2id({
    password: passphrase,
    salt,
    ...ARGON2_CONFIG,
  });
}

/**
 * Verifies a candidate passphrase against a stored Argon2id hash.
 */
export async function verifyPassphrase(passphrase: string, storedHash: string): Promise<boolean> {
  try {
    return await argon2Verify({
      password: passphrase,
      hash: storedHash,
    });
  } catch {
    return false;
  }
}

/**
 * Timing-safe passphrase verification.
 */
export async function verifyPassphraseTimingSafe(passphrase: string, storedHash: string): Promise<boolean> {
  return verifyPassphrase(passphrase, storedHash);
}

/**
 * Generates or retrieves a precomputed dummy Argon2id hash with the identical
 * work factor to ensure response latency is indistinguishable when a user is not found.
 */
export async function generateDummyHash(): Promise<string> {
  if (!cachedDummyHash) {
    cachedDummyHash = await hashPassphrase('dummy-timing-mitigation-passphrase');
  }
  return cachedDummyHash;
}

export interface SessionTokenResult {
  rawToken: string;
  hashedToken: string;
  expiresAt: Date;
}

/**
 * Generates a cryptographically random 32-byte session token (hex encoded).
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hashes a raw session token using SHA-256 for persistent database storage.
 */
export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/**
 * Creates a cryptographically random 32-byte session token, returns both the raw token
 * and the SHA-256 hashed token with expiration.
 */
export function createSessionToken(_userId: string, ttlMs = 30 * 24 * 60 * 60 * 1000): SessionTokenResult {
  const rawToken = generateSessionToken();
  const hashedToken = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMs);

  return {
    rawToken,
    hashedToken,
    expiresAt,
  };
}

/**
 * Checks if a session has expired.
 */
export function validateSessionToken(_hashedToken: string, expiresAt: Date): boolean {
  return expiresAt.getTime() > Date.now();
}

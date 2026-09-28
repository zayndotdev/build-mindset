import { describe, it, expect } from 'vitest';
import {
  hashPassphrase,
  verifyPassphrase,
  createSessionToken,
  validateSessionToken,
  generateDummyHash,
} from '../src/auth/service';

describe('Auth Service — Argon2id and Session Tokens', () => {
  const testPassphrase = 'correct-horse-battery-staple-2026';

  it('hashes a passphrase using Argon2id producing standard crypt format', async () => {
    const hash = await hashPassphrase(testPassphrase);
    expect(hash).toBeDefined();
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$/);
  });

  it('generates unique random 16-byte salts for consecutive hashes of the same passphrase', async () => {
    const hash1 = await hashPassphrase(testPassphrase);
    const hash2 = await hashPassphrase(testPassphrase);

    expect(hash1).not.toBe(hash2);

    // Extract base64 salt from crypt format: $argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>
    const parts1 = hash1.split('$');
    const parts2 = hash2.split('$');
    const salt1 = parts1[4];
    const salt2 = parts2[4];

    expect(salt1).toBeDefined();
    expect(salt2).toBeDefined();
    expect(salt1).not.toBe(salt2);
    expect(salt1!.length).toBeGreaterThanOrEqual(20);
  });

  it('verifies correct passphrase against Argon2id hash', async () => {
    const hash = await hashPassphrase(testPassphrase);
    const isValid = await verifyPassphrase(testPassphrase, hash);
    expect(isValid).toBe(true);
  });

  it('rejects incorrect passphrase against Argon2id hash', async () => {
    const hash = await hashPassphrase(testPassphrase);
    const isValid = await verifyPassphrase('wrong-passphrase', hash);
    expect(isValid).toBe(false);
  });

  it('creates and validates session tokens', () => {
    const session = createSessionToken('user-123', 24 * 60 * 60 * 1000); // 24 hours
    expect(session.rawToken).toHaveLength(64);
    expect(session.hashedToken).toHaveLength(64);
    expect(session.hashedToken).not.toBe(session.rawToken);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Valid token
    const isValid = validateSessionToken(session.hashedToken, session.expiresAt);
    expect(isValid).toBe(true);

    // Expired token
    const expiredAt = new Date(Date.now() - 1000);
    const isExpiredValid = validateSessionToken(session.hashedToken, expiredAt);
    expect(isExpiredValid).toBe(false);
  });

  it('supports dummy hash to prevent timing attack enumeration', async () => {
    const dummyHash = await generateDummyHash();
    expect(dummyHash).toMatch(/^\$argon2id\$/);

    const start = Date.now();
    const result = await verifyPassphrase('any-password', dummyHash);
    const duration = Date.now() - start;

    expect(result).toBe(false);
    expect(duration).toBeGreaterThan(10); // Work factor consumed
  });
});

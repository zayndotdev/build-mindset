import { describe, it, expect } from 'vitest';
import {
  encryptApiKey,
  decryptApiKey,
  generateSecureToken,
  hashToken,
  timingSafeEqualStrings,
} from '../src/crypto/encryption';

describe('AES-256-GCM Key Encryption and Decryption', () => {
  // 32-byte key in hex (64 hex characters)
  const validHexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const plainApiKey = 'sk-ant-api03-abcdef1234567890_test_key_sample';

  it('encrypts and decrypts an API key successfully with valid 32-byte key', () => {
    const encrypted = encryptApiKey(plainApiKey, validHexKey);
    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toBe(plainApiKey);

    // Format should be iv:authTag:ciphertext
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);

    const decrypted = decryptApiKey(encrypted, validHexKey);
    expect(decrypted).toBe(plainApiKey);
  });

  it('produces different ciphertexts on multiple encryptions of the same plaintext (random IV)', () => {
    const enc1 = encryptApiKey(plainApiKey, validHexKey);
    const enc2 = encryptApiKey(plainApiKey, validHexKey);

    expect(enc1).not.toBe(enc2);
    expect(decryptApiKey(enc1, validHexKey)).toBe(plainApiKey);
    expect(decryptApiKey(enc2, validHexKey)).toBe(plainApiKey);
  });

  it('rejects an invalid encryption key length', () => {
    const invalidShortKey = 'abcdef123456';
    expect(() => encryptApiKey(plainApiKey, invalidShortKey)).toThrow(/32 bytes/i);
    expect(() => decryptApiKey('iv:tag:data', invalidShortKey)).toThrow(/32 bytes/i);
  });

  it('throws an authentication error if ciphertext has been tampered with', () => {
    const encrypted = encryptApiKey(plainApiKey, validHexKey);
    const [iv, authTag, ciphertext] = encrypted.split(':');

    // Tamper with ciphertext by altering last character
    const lastChar = ciphertext!.slice(-1);
    const tamperedChar = lastChar === 'a' ? 'b' : 'a';
    const tamperedCiphertext = ciphertext!.slice(0, -1) + tamperedChar;
    const tamperedPayload = `${iv}:${authTag}:${tamperedCiphertext}`;

    expect(() => decryptApiKey(tamperedPayload, validHexKey)).toThrow();
  });

  it('throws an authentication error if auth tag has been tampered with', () => {
    const encrypted = encryptApiKey(plainApiKey, validHexKey);
    const [iv, authTag, ciphertext] = encrypted.split(':');

    const tamperedTag = authTag!.slice(0, -2) + 'ff';
    const tamperedPayload = `${iv}:${tamperedTag}:${ciphertext}`;

    expect(() => decryptApiKey(tamperedPayload, validHexKey)).toThrow();
  });

  it('throws an error for invalid payload format', () => {
    expect(() => decryptApiKey('not-a-valid-payload', validHexKey)).toThrow(/format/i);
    expect(() => decryptApiKey('only:two_parts', validHexKey)).toThrow(/format/i);
  });
});

describe('Secure Token and Hashing Utilities', () => {
  it('generates random hex tokens of correct length', () => {
    const token32 = generateSecureToken(32);
    expect(token32).toHaveLength(64); // 32 bytes = 64 hex characters

    const token16 = generateSecureToken(16);
    expect(token16).toHaveLength(32);

    expect(token32).not.toBe(generateSecureToken(32));
  });

  it('hashes tokens deterministically with SHA-256', () => {
    const token = 'random_session_token_123';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // sha256 hex length
    expect(hash1).not.toBe(token);
  });

  it('performs timing-safe string comparison correctly', () => {
    expect(timingSafeEqualStrings('password123', 'password123')).toBe(true);
    expect(timingSafeEqualStrings('password123', 'password124')).toBe(false);
    expect(timingSafeEqualStrings('short', 'longer_string_here')).toBe(false);
    expect(timingSafeEqualStrings('', '')).toBe(true);
  });
});

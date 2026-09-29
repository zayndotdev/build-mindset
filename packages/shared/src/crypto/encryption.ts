import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  timingSafeEqual,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // Standard 128 bits for GCM

/**
 * Validates that a hex encryption key represents exactly 32 bytes (64 hex characters).
 */
function parseKey(hexKey: string): Buffer {
  if (!hexKey || typeof hexKey !== 'string') {
    throw new Error('Encryption key must be a non-empty hex string of 32 bytes (64 hex characters).');
  }

  const trimmed = hexKey.trim();
  if (trimmed.length !== 64) {
    throw new Error(`Encryption key must be exactly 32 bytes (64 hex characters). Received ${trimmed.length} characters.`);
  }

  const keyBuffer = Buffer.from(trimmed, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes in binary.');
  }

  return keyBuffer;
}

/**
 * Encrypts a plaintext string (e.g. API key) using AES-256-GCM.
 * Output format: `ivHex:authTagHex:ciphertextHex`
 */
export function encryptApiKey(plaintext: string, hexKey: string): string {
  const key = parseKey(hexKey);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted payload (`ivHex:authTagHex:ciphertextHex`).
 */
export function decryptApiKey(encryptedPayload: string, hexKey: string): string {
  const key = parseKey(hexKey);

  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    throw new Error('Invalid encrypted payload format. Expected "iv:authTag:ciphertext".');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format. Expected "iv:authTag:ciphertext".');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];

  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Invalid encrypted payload format: components cannot be empty.');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length. Expected ${IV_LENGTH} bytes.`);
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid authentication tag length. Expected ${AUTH_TAG_LENGTH} bytes.`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Generates a cryptographically strong random token of specified byte length.
 */
export function generateSecureToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('hex');
}

/**
 * Produces a deterministic SHA-256 hash of a string (e.g. for hashing session tokens before storage).
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Compares two strings in constant time to prevent timing attacks.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  if (bufA.length !== bufB.length) {
    // Perform dummy comparison to avoid length leakage
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

/**
 * Encrypts a binary buffer (e.g. SQLite database snapshot) using AES-256-GCM.
 * Output format: [MAGIC 4B 'MBKP'][VERSION 1B 0x01][IV 12B][AUTH_TAG 16B][CIPHERTEXT NB]
 */
export function encryptBuffer(data: Buffer, hexKey: string): Buffer {
  const key = parseKey(hexKey);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const magic = Buffer.from('MBKP', 'utf8');
  const version = Buffer.from([0x01]);

  return Buffer.concat([magic, version, iv, authTag, ciphertext]);
}

/**
 * Decrypts an AES-256-GCM encrypted backup buffer.
 * Validates magic header ('MBKP'), version (0x01), and cryptographic authentication tag.
 */
export function decryptBuffer(data: Buffer, hexKey: string): Buffer {
  const key = parseKey(hexKey);

  if (data.length < 33) {
    throw new Error('Encrypted backup data too short to contain valid header');
  }

  const magic = data.subarray(0, 4).toString('utf8');
  if (magic !== 'MBKP') {
    throw new Error(`Invalid backup magic header. Expected 'MBKP', received '${magic}'.`);
  }

  const version = data[4];
  if (version !== 0x01) {
    throw new Error(`Unsupported backup format version: ${version}`);
  }

  const iv = data.subarray(5, 5 + IV_LENGTH);
  const authTag = data.subarray(5 + IV_LENGTH, 5 + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(5 + IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}


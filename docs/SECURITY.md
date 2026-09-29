# Security Architecture & Threat Model — Mindset

> Master security specification, threat model, cryptographic standards, and incident response procedures for the Mindset AI Socratic Coach.

---

## 1. System Threat Model

Mindset is designed as a **strictly private, single-user engineering coach**. It is hosted on a dedicated Oracle Cloud Always Free ARM VM accessible exclusively through a private Tailscale tailnet via **Tailscale Serve** (HTTPS with `.ts.net` auto-TLS).

### Assets & Sensitivity
1. **Passphrase Credential**: The master authentication secret guarding access to the single-user coach.
2. **AI Provider API Keys**: Third-party API credentials (Gemini, Groq, Mistral, Cohere). Unauthorized access could exhaust free-tier quotas or incur costs.
3. **Coaching History & Voice Transcripts**: Private engineering deliberations, spoken speech transcripts, and competency progress logs.
4. **SQLite Database & Backups**: Persistent state containing all session history, encrypted keys, and SM-2 schedules.

### Adversary Capabilities & Attack Vectors
- **Network Eavesdropping / Public Internet Scanners**: Mitigated by Tailscale private overlay network (no public IP listener; Tailscale Serve terminates TLS).
- **Brute-Force Authentication Attacks**: Mitigated by Argon2id memory-hard hashing, strict rate-limiting (5 failures per 15m lockout), and constant-time dummy hash verification.
- **Database Theft / Storage Exposure**: Mitigated by AES-256-GCM authenticated encryption on API keys and backup archives (`.mbkp`).
- **Prompt Injection & Jailbreaking**: Mitigated by role-based prompt boundaries (user input restricted to the `USER` role; never embedded into `SYSTEM` instructions).

---

## 2. Authentication & Passphrase Hardening

### Argon2id WebAssembly Configuration
- **Algorithm**: Argon2id (hybrid data-dependent and data-independent memory-hard function) implemented via WebAssembly (`hash-wasm`).
- **Parameters**:
  - Memory cost: `m = 65536` KiB (64 MiB)
  - Time cost: `t = 3` iterations
  - Parallelism: `p = 4` threads
  - Salt length: 16 cryptographically random bytes generated via `crypto.getRandomValues()`.
- **Output Format**: Standard Modular Crypt Format (PHC string format):  
  `$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>`

### Timing-Attack Defense (Dummy Hash)
When an unauthenticated request attempts authentication against a system where setup has not occurred or user credentials fail early, the system executes a pre-computed or on-the-fly dummy Argon2id hash verification (`verifyArgon2id("dummy-passphrase", DUMMY_HASH)`). This ensures uniform execution latency (~1.5–2.0s) regardless of whether a record exists, eliminating timing-based username or setup enumeration.

### Rate Limiting & Lockout
- Managed via `@fastify/rate-limit`.
- Threshold: **Max 5 failed login attempts per 15-minute sliding window**.
- Response on lockout: HTTP 429 `RATE_LIMIT_EXCEEDED` with standard `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers.

---

## 3. Session Management & Transport Security

### Session Token Security
- **Token Format**: 32-byte cryptographically secure random hexadecimal string (256 bits of entropy) generated using Node `crypto.randomBytes(32)`.
- **Storage**:
  - SHA-256 hash stored in SQLite `sessions_auth` table with `expires_at` and `revoked` columns.
  - Plaintext token sent exclusively via the `mindset_session` cookie.
- **Cookie Security Attributes**:
  - `HttpOnly`: Prevents client-side JavaScript access (mitigating XSS extraction).
  - `SameSite=Lax`: Mitigates Cross-Site Request Forgery (CSRF).
  - `Path=/`: Bounded strictly to root application endpoints.
  - `Secure`: Set to `true` in production environments (enforced over Tailscale HTTPS).
- **Session Revocation**:
  - `POST /api/v1/auth/logout`: Immediately revokes the current session token in SQLite.
  - `POST /api/v1/auth/logout-all`: Revokes all active session tokens for the single user.

---

## 4. Cryptographic Key Management (Zero Plaintext Policy)

### Provider API Key Encryption
- **Algorithm**: AES-256-GCM (Galois/Counter Mode) authenticated encryption.
- **Key Derivation**: 32-byte master encryption key supplied via `ENCRYPTION_KEY` environment variable.
- **Per-Key IV**: Unique 12-byte initialization vector generated per encryption operation via `crypto.randomBytes(12)`.
- **Payload Format**: `hex(iv):hex(authTag):hex(ciphertext)`
- **In-Memory Lifecycle**: Decrypted strictly within the ephemeral request scope when dispatching LLM calls; never persisted to disk unencrypted, never logged in Fastify/Pino structured logs, and never returned in API payloads (`GET /api/v1/providers` returns `hasKey: boolean`, never the key itself).

---

## 5. Database & Backup Durability

### Atomic SQLite Snapshots
- In SQLite WAL mode, reading the `.db` file directly leaves committed transactions in `.db-wal`.
- Mindset executes `DatabaseSync.exec("VACUUM INTO 'temp-snapshot.db'")`, creating an atomic, standalone, fully checkpointed snapshot with zero pending WAL pages.

### Encrypted Backup Format (`.mbkp`)
Backups are encrypted using AES-256-GCM with a tamper-evident binary header:
```
Offset   Size      Field               Description
0        4 bytes   Magic Bytes         ASCII "MBKP" (0x4D 0x42 0x4B 0x50)
4        1 byte    Format Version      0x01
5        12 bytes  IV                  Cryptographic Initialization Vector
17       16 bytes  Auth Tag            AES-256-GCM Authentication Tag
33       N bytes   Ciphertext          Encrypted SQLite snapshot bytes
```
- Any unauthorized modification to the archive triggers an authenticated decryption failure (`GCM authentication tag mismatch`), preventing corrupted or tampered database restoration.

---

## 6. Prompt Injection & Boundary Controls

### Role-Based Isolation (Decision D-015)
- User-provided text (candidate answers, voice transcripts, customized topic requests) is strictly isolated to the LLM `USER` role.
- System prompts (`SYSTEM` role) contain only immutable instructions, reference key points, model answers, and rubric criteria.
- User input is never concatenated or interpolated directly into system instructions, preventing prompt injection attacks from hijacking grading or coaching behavior.

---

## 7. Incident Response & Key Rotation Runbook

### Scenario A: Master Encryption Key Rotation
1. Export unencrypted database snapshot to a local secure RAM disk using the current key.
2. Generate a new 32-byte hex key: `openssl rand -hex 32`.
3. Update `ENCRYPTION_KEY` in `.env`.
4. Re-encrypt all provider keys in SQLite using the migration utility.

### Scenario B: Suspected Credential Compromise
1. Execute `POST /api/v1/auth/logout-all` to invalidate all active session tokens immediately.
2. Invalidate the user passphrase by running `pnpm tsx scripts/reset-passphrase.ts`.
3. Restart the service and perform the first-run passphrase setup.

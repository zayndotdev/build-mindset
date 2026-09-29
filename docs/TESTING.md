# Testing Strategy & Verification Guide — Mindset

> Comprehensive testing guide, test suite directory, commands, and verification protocols for the Mindset monorepo.

---

## 1. Testing Philosophy & Strategy

Mindset follows a strict pyramid of automated testing:
1. **Unit Tests (Vitest)**: Fast, deterministic testing of pure functions:
   - Socratic state machine transitions (`@mindset/learning`)
   - SM-2 spaced repetition calculations (`@mindset/learning`)
   - Prompt context builders and token budget estimators (`@mindset/learning`)
   - AI router priority chains, circuit breakers, and resting windows (`@mindset/ai`)
   - Cryptographic primitives: Argon2id hashing, AES-256-GCM encryption (`@mindset/shared`)
2. **Integration Tests (Vitest + Fastify Inject)**:
   - Complete HTTP request/response lifecycles without opening network ports.
   - SQLite WAL database persistence, transactions, and rollback verification.
   - Server-Sent Events (SSE) chat streaming lifecycles.
   - Auth lockout, session token rotation, and CORS origin filtering.
   - Encrypted backup creation and full database restoration (`packages/shared/src/crypto/backup.ts`).
3. **Curriculum Evaluation Harness (`EvalHarness`)**:
   - Automated simulation of 4 scripted engineering personas (*Senior*, *Mid-Level*, *Rambler*, *Novice*).
   - Validates grading consistency against reference key points and model answers.
4. **Autonomous & Manual Release Gates (Decision D-020)**:
   - Full monorepo Vitest suite (16 suites, 92 tests passing).
   - Production PWA build verification (`tsc -b && vite build`).
   - Native server health verification script (`scripts/verify-health.ts`).
   - Morning mobile hardware verification checklist (`docs/MORNING_CHECKLIST.md`).

---

## 2. Running Tests

### Run Full Monorepo Test Suite
```bash
# Run all 16 test files across all packages and apps
pnpm test
```

### Run Tests by Package
```bash
# Run AI Provider layer tests
pnpm --filter ai test

# Run Learning Engine & State Machine tests
pnpm --filter learning test

# Run Shared Cryptography tests
pnpm --filter shared test

# Run Fastify API & Integration tests
pnpm --filter api test
```

### Run Specific Test Files
```bash
# Run backup and disaster recovery tests
pnpm --filter api test -- tests/backup-restore.test.ts

# Run SSE streaming and session tests
pnpm --filter api test -- tests/session-routes.test.ts

# Run voice pipeline and audio transcription tests
pnpm --filter api test -- tests/voice.test.ts

# Run progress analytics and SM-2 review tests
pnpm --filter api test -- tests/progress-and-review.test.ts
```

### Run Health & Backup CLI Verifications
```bash
# Verify native server health (/healthz and /readyz)
pnpm tsx scripts/verify-health.ts

# Create an encrypted backup snapshot
pnpm tsx scripts/backup.ts backups/manual-test.mbkp

# Test restoring the backup to a verification database
pnpm tsx scripts/restore.ts backups/manual-test.mbkp data/mindset-verify.db
```

---

## 3. Monorepo Test Suite Inventory

| Test File | Package / App | Tests | Key Behaviors Verified |
|---|---|---|---|
| `packages/learning/tests/state-machine.test.ts` | `@mindset/learning` | 6 | Socratic step progression (4 steps standard, Quick mode), hint ladder (caps at 2), recap & transfer transitions. |
| `packages/ai/tests/router.test.ts` | `@mindset/ai` | 8 | Priority-based routing, automatic fallback on 429/500, circuit breaker state transitions, quota-aware resting. |
| `packages/learning/tests/eval-harness.test.ts` | `@mindset/learning` | 3 | Scripted persona grading (Senior vs Novice differentiation), quality score bounding (0–4). |
| `apps/api/tests/backup-restore.test.ts` | `@mindset/api` | 4 | `VACUUM INTO` atomic snapshot, AES-256-GCM encryption, tamper rejection, full restore with data fidelity. |
| `packages/shared/tests/crypto.test.ts` | `@mindset/shared` | 9 | Argon2id random 16-byte salts, PHC format, AES-256-GCM encrypt/decrypt, corrupted tag detection. |
| `apps/api/tests/db.test.ts` | `@mindset/api` | 4 | Drizzle + `node:sqlite` transaction commit, rollback verification on error, unique constraints. |
| `packages/ai/tests/structured.test.ts` | `@mindset/ai` | 4 | Structured JSON extraction from LLM outputs, repair of markdown code fences, Zod schema validation. |
| `packages/ai/tests/circuit-breaker.test.ts` | `@mindset/ai` | 5 | Consecutive failure trips (CLOSED -> OPEN), cooldown timer, test probe recovery (OPEN -> HALF_OPEN -> CLOSED). |
| `packages/ai/tests/providers.test.ts` | `@mindset/ai` | 6 | Mock adapter generation, streaming chunk emissions, error propagation. |
| `packages/learning/tests/sm2.test.ts` | `@mindset/learning` | 4 | SuperMemo-2 interval growth, ease factor decay on low ratings, reset on failed recall. |
| `apps/api/tests/provider-routes.test.ts` | `@mindset/api` | 5 | `GET /providers` (masks keys), `POST /providers/:id` (AES-256-GCM encryption), test connection, delete key. |
| `apps/api/tests/progress-and-review.test.ts` | `@mindset/api` | 9 | Readiness calculation, 5-axis Quality radar, independence trend, due review queue, recall ratings. |
| `apps/api/tests/auth.test.ts` | `@mindset/api` | 6 | Passphrase hash creation, random salts, correct verification, invalid rejection, constant-time dummy hash. |
| `apps/api/tests/session-routes.test.ts` | `@mindset/api` | 5 | Session start, unauthored topic rejection, SSE streaming answer submission, hint caps, step skipping. |
| `apps/api/tests/voice.test.ts` | `@mindset/api` | 6 | `POST /voice/transcribe` base64 and binary payloads, original transcript preservation, 429 handling. |
| `apps/api/tests/routes.test.ts` | `@mindset/api` | 9 | `/healthz`, `/readyz`, cookie auth lifecycle, CORS allow-list, rate-limit lockout after 5 failed logins. |

**Total Count**: 16 Test Files, 92 Tests, 100% Passing.

---

## 4. Zero Live API Key Policy

All automated test suites operate with **zero external network requests**:
- AI adapters are replaced with `MockProviderAdapter` or in-memory responses.
- Voice transcription routes utilize `MockAudioAdapter`.
- SQLite databases are created in ephemeral test instances or temporary files that are cleaned up after suite completion.
- Tests will never fail due to expired third-party API keys or external network outages.

# API Outline — Mindset

> **Phase 0 — Design** · v0.2 · 2026-09-29
>
> Full OpenAPI spec will be generated in Phase 1. This is the design outline.
>
> **v0.2 changes:** Fixed SSE event flow to match split grade/coach
> architecture. Fixed idempotency table. Sessions use `sessionMode`.

---

## Base URL

```
/api/v1
```

## Common Response Format

```typescript
// Success
{ data: T }

// Error
{ error: { code: string, message: string, details?: unknown } }

// Paginated
{ data: T[], cursor?: string, hasMore: boolean }
```

## Headers

| Header | Description |
|--------|-------------|
| `X-Request-Id` | UUID, generated per request, propagated to logs |
| `Content-Type` | `application/json` (except SSE and audio) |

---

## Endpoints

### Auth

| Method | Path | Description | Rate Limit | Auth |
|--------|------|-------------|------------|------|
| `GET` | `/auth/status` | Check if initial setup is required (`setupRequired: boolean`) | 60/min | No |
| `POST` | `/auth/setup` | First-run passphrase setup (one-time initialization) | 5/min | No |
| `POST` | `/auth/login` | Login with passphrase | 5/min | No |
| `POST` | `/auth/logout` | Invalidate current session | — | Yes |
| `POST` | `/auth/logout-all` | Invalidate all sessions across all devices | — | Yes |
| `GET` | `/auth/session` | Get current authenticated session info | 60/min | Yes |

### Providers

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/providers` | List all providers with status (keys masked) |
| `PUT` | `/providers/:id/key` | Save/update encrypted API key |
| `DELETE` | `/providers/:id/key` | Remove API key |
| `POST` | `/providers/:id/test` | Test connection (returns model list) |
| `GET` | `/providers/:id/status` | Health + usage stats |
| `PUT` | `/providers/:id/config` | Update model, priority, routing |

### Topics

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/topics` | List all topics (filterable by category, difficulty) |
| `GET` | `/topics/:id` | Get topic details |
| `POST` | `/topics/generate` | Generate custom topic from user input |
| `GET` | `/topics/suggestions` | Get 3 suggested topics for today |

### Sessions

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sessions` | Create new session (topic, level, sessionMode) |
| `GET` | `/sessions/:id` | Get session state + history |
| `GET` | `/sessions/current` | Get active (non-complete) session |
| `POST` | `/sessions/:id/answer` | Submit answer for current step |
| `POST` | `/sessions/:id/hint` | Request next hint for current step |
| `POST` | `/sessions/:id/skip` | Skip current step (score=0) |
| `POST` | `/sessions/:id/recap` | Submit own-words recap |
| `POST` | `/sessions/:id/transfer-answer` | Submit transfer challenge answer |
| `POST` | `/sessions/:id/complete` | Mark session complete |

### Voice

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/voice/transcribe` | Upload audio blob → text (Groq Whisper) |

### Progress

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/progress/overview` | Skill radar, streak, stats |
| `GET` | `/progress/dimensions` | Skill scores over time |
| `GET` | `/progress/streak` | Streak calendar data |
| `GET` | `/progress/history` | Past sessions (paginated, searchable) |

### Reviews (Spaced Repetition)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/reviews/due` | Get due review items |
| `POST` | `/reviews/:id/answer` | Submit review answer |
| `GET` | `/reviews/stats` | Review stats and next due |

### English

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/english/reports` | Past English reports (paginated) |
| `GET` | `/english/reports/:sessionId` | English report for session |
| `GET` | `/english/mistakes` | Recurring mistake patterns |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings` | Get all settings |
| `PUT` | `/settings` | Update settings |

### Data Management

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/data/export` | Export all user data (encrypted JSON) |
| `POST` | `/data/import` | Import user data |
| `DELETE` | `/data/delete-all` | Delete everything (irreversible) |

### Health

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/healthz` | Liveness check | No |
| `GET` | `/readyz` | Readiness check (DB, providers) | No |

---

## SSE Stream Format

`POST /api/v1/sessions/:id/answer` returns `Content-Type: text/event-stream`.

The server performs two LLM calls sequentially and streams the combined
result as SSE events:

```
// Phase 1: Grade result (non-streaming LLM call, sent as a single event)
event: grade
data: {"qualityScore": 3, "independenceScore": 4, "compositeScore": 3,
       "covered": ["hashing", "unique constraint"],
       "missed": ["timing attacks"],
       "graderId": "gemini:gemini-3.8-flash",
       "isFallbackGrade": false}

// Phase 2: Coach teaching response (streamed token by token)
event: token
data: {"content": "✅ You"}

event: token
data: {"content": " correctly identified"}

... (more tokens)

// Final event: step complete
event: done
data: {"nextStep": 8, "stepIndex": 3, "totalSteps": 4,
       "sessionState": "STEP_8"}

// Error (replaces above if something fails)
event: error
data: {"code": "PROVIDER_ERROR", "message": "...", "retryable": true}
```

**Design notes:**
- The `grade` event arrives first (after the grading LLM call completes).
- Then `token` events stream the coaching response.
- The client shows a brief "Evaluating..." state until `grade` arrives,
  then streams the coaching text.
- `done` includes `stepIndex`/`totalSteps` so the client can show "Step 3/4".

---

## Idempotency

Mutating endpoints that trigger LLM calls or create resources accept an
`Idempotency-Key` header. The server stores the key + response for 24h and
returns the cached response on duplicate requests.

| Method | Path | Why Idempotent |
|--------|------|----------------|
| `POST` | `/sessions` | Prevent duplicate session creation on retry |
| `POST` | `/sessions/:id/answer` | Prevent double-grading same answer |
| `POST` | `/sessions/:id/hint` | Prevent skipping hint levels |
| `POST` | `/sessions/:id/recap` | Prevent double-grading recap |
| `POST` | `/sessions/:id/transfer-answer` | Prevent double-grading transfer |
| `POST` | `/voice/transcribe` | Prevent re-transcribing same audio |
| `POST` | `/topics/generate` | Prevent duplicate LLM topic generation |

---

## Authentication Flow

### 1. First-Run Passphrase Setup Flow

On initial installation or after database purge:

```
1. Client requests GET /auth/status
   → If no credentials exist in database:
     Response: 200 OK { data: { setupRequired: true } }
   → If credentials already exist:
     Response: 200 OK { data: { setupRequired: false } }

2. If setupRequired is true, client shows Setup Screen (minimum 8 characters):
   POST /auth/setup { "passphrase": "<user_chosen_passphrase>" }
   → Server hashes passphrase using Argon2id (RFC 9106, 64 MB RAM, 3 iterations, 4 threads, 16-byte random salt)
   → Server creates single user (`usr_single_user`) and persists credential
   → Server creates session, sets HttpOnly cookie:
     Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/
   → Response: 201 Created { data: { user: { id: "usr_single_user" } } }

3. Any subsequent POST /auth/setup calls:
   → Response: 409 Conflict { error: { code: "SETUP_ALREADY_COMPLETED", message: "Passphrase has already been configured" } }

Note: If APP_PASSPHRASE is defined in .env, db:seed automatically initializes the credential during server startup.
```

### 2. Login Flow & Rate-Limit Lockout

```
1. POST /auth/login { "passphrase": "<passphrase>" }
   → Server retrieves stored credential
   → If user not found (or in timing attack simulation), runs dummy Argon2id hash to prevent response-time enumeration
   → Server verifies hash using constant-time comparison
   → If invalid:
     - 401 Unauthorized { error: { code: "INVALID_CREDENTIALS" } }
     - Rate limited: 5 failed attempts per 1-minute window per IP
     - 6th attempt returns: 429 Too Many Requests { error: { code: "RATE_LIMIT_EXCEEDED" } }
   → If valid:
     - Issues 256-bit CSPRNG session token
     - Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000
     - Response: 200 OK { data: { user: { id: "usr_single_user" }, expiresAt: "<ISO8601>" } }

2. Authenticated Requests:
   → Browser sends HttpOnly session cookie
   → Pre-handler verifies session token in SQLite and checks expiry (30-day lifetime)
   → 401 Unauthorized if missing, invalid, or expired

3. Logout:
   → POST /auth/logout: deletes current session token row and clears cookie
   → POST /auth/logout-all: revokes all active session tokens across all devices
```

---

## Rate Limiting Headers

All API endpoints return standard IETF draft rate limit headers (alongside legacy `X-RateLimit-*` aliases):

| Header | Description | Example |
|--------|-------------|---------|
| `RateLimit-Limit` | Request quota allowed within time window | `60` |
| `RateLimit-Remaining` | Available requests remaining in current window | `58` |
| `RateLimit-Reset` | Window reset interval (seconds remaining or UNIX epoch) | `42` |
| `Retry-After` | Returned on HTTP 429 Too Many Requests responses | `42` |


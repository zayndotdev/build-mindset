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

| Method | Path | Description | Rate Limit |
|--------|------|-------------|------------|
| `POST` | `/auth/login` | Login with passphrase | 5/min |
| `POST` | `/auth/logout` | Invalidate current session | — |
| `POST` | `/auth/logout-all` | Invalidate all sessions | — |
| `GET` | `/auth/session` | Get current session info | — |
| `POST` | `/auth/setup` | First-run passphrase setup | Once only |

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
| `GET` | `/sessions/:id/stream` | SSE — stream coach response |

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
       "graderId": "gemini:gemini-2.0-flash",
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

```
1. POST /auth/login { passphrase }
   → Server: argon2id verify
   → Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/
   → 200 { data: { expiresAt } }

2. All subsequent requests include the cookie automatically
   → Server validates session token on every request
   → 401 if invalid/expired

3. POST /auth/logout
   → Server deletes session row
   → Clear-Cookie
```

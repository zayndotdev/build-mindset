# API Outline — Mindset

> **Phase 0 — Design** · v0.1 · 2026-09-29
>
> Full OpenAPI spec will be generated in Phase 1. This is the design outline.

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
| `POST` | `/sessions` | Create new session (topic, level, quickMode) |
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

`GET /api/v1/sessions/:id/stream`

```
event: token
data: {"content": "Let", "role": "coach"}

event: token
data: {"content": "'s", "role": "coach"}

event: grade
data: {"score": 3, "covered": [...], "missed": [...]}

event: teaching
data: {"modelAnswer": "...", "reasoning": "..."}

event: done
data: {"nextStep": 6, "sessionState": "STEP_6"}

event: error
data: {"code": "PROVIDER_ERROR", "message": "..."}
```

---

## Idempotency

Mutating endpoints that should be idempotent accept an `Idempotency-Key`
header. The server stores the key + response for 24h and returns the cached
response on duplicate requests.

Endpoints with idempotency support:
- `POST /sessions` (create)
- `POST /sessions/:id/answer`
- `POST /sessions/:id/hint`
- `POST /voice/transcribe`

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

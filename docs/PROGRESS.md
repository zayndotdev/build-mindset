# Mindset Autonomous Build Progress

> Real-time tracker for the overnight autonomous build run.
> Updated after every task.

**Current Phase**: Phase 4: Learning Engine & Topic Curriculum  
**Last Commit**: `2d29054`  
**Next Action**: Author remaining curriculum topics with metadata (marked referenceStatus: unauthored and blocked from graded selection), verify persona eval harness against all 4 levels, and connect review queue.  
**Known Issues**: Docker not installed locally on Windows host (runs natively; Docker verified in CI).

---

## Phase Checklist

### Phase 1.1: Foundation & Security Hardening
- [x] ADR-008 for `node:sqlite` + `hash-wasm`
- [x] Transaction rollback test in `apps/api/tests/db.test.ts`
- [x] Node 24 pinned in `.nvmrc`, `package.json` engines, CI
- [x] Proof of random 16-byte Argon2id salts in `apps/api/tests/auth.test.ts`
- [x] CORS allow-list test in `apps/api/tests/routes.test.ts`
- [x] Rate-limiting login lockout test in `apps/api/tests/routes.test.ts`
- [x] First-run passphrase setup endpoint (`POST /auth/setup`, `GET /auth/status`) & `docs/API.md` alignment
- [x] First-run setup UI integration in `LoginView.tsx` & `AuthContext.tsx`
- [x] Label mock UI with visible `[Placeholder UI / Demo Stats]` badges
- [x] Production `README.md` quick start with native commands
- [x] CI and Secret Scanning green on GitHub
- [x] Mark Docker files as UNVERIFIED (host has no Docker)
- [x] Add GitHub Actions CI job to build Docker image & curl `/healthz`
- [x] Local `.env` generated from `.env.example` (gitignored)
- [x] `docs/reports/phase1-report.md`

### Phase 2: AI Provider Layer
- [x] Provider Adapter interface & Mock Adapter
- [x] Google Gemini, Groq, Mistral, Cohere adapters
- [x] AI Router with priority ordering & automatic fallback
- [x] Circuit Breaker (CLOSED / OPEN / HALF_OPEN)
- [x] Quota-aware resting (backoff window on 429s)
- [x] Live `list-models` discovery
- [x] Pinned Grader with provenance tracking (`graderId`, `rubricVersion`, `isFallbackGrade`)
- [x] Encrypted provider keys (AES-256-GCM) with zero plaintext logging
- [x] Settings > Providers UI (live list, key update/delete, test connection, priority ordering)
- [x] Unit & integration tests (simulate 429s, timeouts, malformed JSON, circuit breaker recovery)
- [x] `docs/reports/phase2-report.md`

### Phase 3: Chat Core with Streaming & Persistence
- [x] Session message database persistence (SQLite)
- [x] SSE streaming endpoint (`POST /sessions/:id/answer` -> `grade`, `token`, `done`, `error`)
- [x] Client SSE stream consumer with graceful disconnection handling
- [x] Integration tests for SSE streaming lifecycle
- [x] `docs/reports/phase3-report.md`

### Phase 4: Learning Engine (Socratic Core)
- [ ] Socratic state machine (4 steps standard, Quick mode with mini-transfer)
- [ ] Hint ladder with hard caps (max 2 hints per step)
- [ ] Separate Answer Quality (1-4) vs. Independence Score (4 -> 3 -> 2 -> 0 on skip)
- [ ] Grader engine evaluated against reference key points and model answers
- [ ] 4 fully authored curriculum topics
- [ ] Remaining topics authored as `referenceStatus: "unauthored"` (blocked from graded selection)
- [ ] Recap step & transfer challenge
- [ ] English feedback report generation (grammar, fluency, conciseness)
- [ ] SM-2 spaced repetition scheduling algorithm & queue
- [ ] Evaluation harness with 4 scripted personas (Senior, Mid, Rambler, Novice)
- [ ] Tests for grading accuracy, state machine transitions, and SM-2 calculations
- [ ] `docs/reports/phase4-report.md`

### Phase 5: Voice Pipeline
- [ ] Voice audio upload & transcription endpoint (`POST /voice/transcribe` via Groq Whisper with mock fallback)
- [ ] TTS audio player states and controls in UI
- [ ] Original audio transcript used for grading
- [ ] Mocked media audio tests
- [ ] `docs/reports/phase5-report.md`

### Phase 6: Progress, Review, History, Accessibility & Performance
- [ ] Skill radar chart (quality scores only)
- [ ] Independence score trend line
- [ ] SM-2 Spaced review due queue UI & interaction
- [ ] Past session history list & search
- [ ] a11y audit pass (ARIA, focus management, semantic HTML)
- [ ] Mobile responsive layout pass (tested at 390x844 viewport)
- [ ] `docs/reports/phase6-report.md`

### Phase 7: Audit, Backup/Restore, Verification & Wrap-up
- [ ] Security self-audit (auth, headers, tokens, encryption)
- [ ] Automated backup & restore scripts with live restore test
- [ ] Playwright E2E tests at 390x844 (setup, login, standard session, hints, fallback, offline)
- [ ] Screenshots captured in `docs/screenshots`
- [ ] `docs/MORNING_CHECKLIST.md` (manual steps for human: real keys, Tailscale/Oracle, Android voice)
- [ ] `docs/MORNING_REPORT.md` (executive summary, test counts, evidence, status)

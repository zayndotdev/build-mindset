# Decisions Log — Mindset

> Running record of decisions made. Major technical choices get a full ADR in
> `docs/adr/`. This file is the quick-reference index.

---

## Phase 0 Decisions

### D-001: Fourth Provider — Groq (OpenAI-Compatible)
- **Date:** 2026-09-29
- **Context:** User has free-tier keys for Gemini, Mistral, Cohere, and Groq.
- **Decision:** Build a generic OpenAI-compatible adapter with configurable base
  URL. Default to Groq (`https://api.groq.com/openai/v1`). The adapter is
  generic enough that xAI Grok or any other OpenAI-compatible provider can be
  added by changing config.
- **ADR:** [ADR-003](adr/003-groq-fourth-provider.md)

### D-002: Hosting — Oracle Cloud Always Free + Tailscale Serve
- **Date:** 2026-09-29 (revised)
- **Context:** User needs free hosting on the internet. Render/Railway/Fly.io
  free tiers spin down or have been discontinued. Cloudflare Tunnel URLs are
  publicly reachable (v0.1 incorrectly called them "private").
- **Decision:** Oracle Cloud Always Free ARM tier (2 OCPU, 12 GB RAM, 200 GB
  storage) with Tailscale Serve for HTTPS. Genuinely private (Tailnet only),
  no domain needed, auto-TLS via `.ts.net` subdomain. Credit card required
  for Oracle signup. Idle instance reclaim risk on Always Free accounts is
  eliminated by upgrading to Pay As You Go (PAYG) and mitigated by OCI metric
  alarms plus nightly off-VM encrypted backups.
- **ADR:** [ADR-004](adr/004-hosting-oracle-cloud.md)

### D-003: Primary Phone — Android Chrome
- **Date:** 2026-09-29
- **Context:** User confirmed Android Chrome as primary device.
- **Decision:** Design and test primarily for Android Chrome. iOS Safari support
  is secondary but we will document known limitations (especially voice).

### D-004: Priority Topic Categories
- **Date:** 2026-09-29
- **Context:** User wants: authentication, APIs, database design, AI/LLM features.
- **Decision:** Seed the first 50 topics with heavy weighting toward these four
  categories. Other categories (caching, search, payments, etc.) included for
  coverage but lower priority.

### D-005: Server Framework — Fastify
- **Date:** 2026-09-29
- **Decision:** Fastify over Hono. Both excellent; Fastify chosen for its mature
  plugin ecosystem (helmet, rate-limit, cookie, SSE), built-in schema validation
  (pairs with Zod), and better Node.js-specific tooling for our use case
  (SQLite, pino, streaming). Hono's edge-first design isn't needed since we're
  deploying to a dedicated VM.
- **ADR:** [ADR-001](adr/001-server-framework-fastify.md)

### D-006: Database — SQLite (WAL) + Drizzle ORM
- **Date:** 2026-09-29
- **Decision:** SQLite in WAL mode. Zero ops overhead for a single-user app.
  Drizzle ORM for type-safe queries with migrations. Repository pattern so
  PostgreSQL migration is a config change.
- **ADR:** [ADR-002](adr/002-database-sqlite-drizzle.md)

### D-007: Spaced Repetition — SM-2 Algorithm
- **Date:** 2026-09-29
- **Decision:** SM-2 (SuperMemo 2) for spaced repetition scheduling. Simple,
  well-documented, battle-tested in Anki. Stored per review-item with
  `next_due`, `interval`, `ease_factor`, `repetitions`.
- **ADR:** [ADR-005](adr/005-spaced-repetition-sm2.md)

### D-008: Voice — Browser Web Speech Primary, Groq Whisper Fallback
- **Date:** 2026-09-29
- **Decision:** Use browser `webkitSpeechRecognition` for STT (free, no quota
  cost). Fallback to Groq Whisper for transcription when browser API unavailable.
  Browser `speechSynthesis` for TTS (free). No provider TTS in v1 to conserve
  quota.
- **ADR:** [ADR-006](adr/006-voice-architecture.md)

### D-009: Monorepo Tooling — pnpm + Turborepo
- **Date:** 2026-09-29
- **Decision:** pnpm workspaces for package management, Turborepo for task
  orchestration (build, test, lint). Fast, well-supported, simpler than Nx.
- **ADR:** [ADR-007](adr/007-monorepo-tooling.md)

### D-010: Free-Tier Data Privacy
- **Date:** 2026-09-29
- **Context:** Both Gemini and Mistral free tiers may use prompts/responses to
  improve their models. Cohere trial keys are evaluation-only.
- **Decision:** Accept this trade-off for a private, personal-use app. Document
  the risk. The app never sends personally identifiable information — only
  engineering discussion content. User is aware and can switch to paid tiers
  for privacy.

### D-011: Universal Dynamic Model Discovery Across All Providers
- **Date:** 2026-09-29
- **Context:** Free-tier AI model lifecycles are volatile (e.g. `gemini-2.0-flash` shut down June 1, 2026). Hardcoding static model names across providers causes silent runtime failures when models are retired.
- **Decision:** Dynamic model discovery applies to all four providers (Gemini `ai.models.list()`, Groq `models.list()`, Mistral `models.list()`, Cohere `models.list()`). Discovered models are verified against capabilities and cached, with verified fallbacks (`gemini-3.8-flash`, `llama-3.3-70b-versatile`, `mistral-small-latest`, `command-r`). Users can override models in Settings.

---

## Phase 0.2 Decisions (Revisions)

### D-012: Default 4-Step Sessions with Topic-Specific Step Selection
- **Date:** 2026-09-29
- **Context:** Running all 10 framework steps makes sessions too long (~30 min),
  causes fatigue, and wastes free-tier quota. Most topics have ~4 steps where
  real learning happens.
- **Decision:** Standard session = 4 steps, selected per-topic in the topic
  definition (`standardSteps: [1, 5, 8, 9]`). Quick Mode = 2 steps + mini
  transfer challenge. **Deep Dive (all 10 steps) is deferred to v2** (low confidence
  for v1, high authoring overhead, tighter token budgets).

### D-013: Split Quality and Independence Scoring
- **Date:** 2026-09-29
- **Context:** v0.1 had a single score with hint caps enforced in the LLM
  grading prompt. This conflates "how good was the answer" with "how much
  help was needed" and adds a non-deterministic dependency to hint enforcement.
- **Decision:** Two separate scores per step:
  - **Quality (0–4):** Graded by the LLM purely on answer content against key points.
    Used for the **skill radar chart** and dimension averages.
  - **Independence (0–4):** Computed deterministically in server code from
    hint count (`0 hints = 4, 1 = 3, 2 = 2, 3 = 1, 4+ = 0`). Displayed as a
    **separate trend line** on progress charts.
  - **Composite:** `min(quality, independence)` — used **only for SM-2 spaced repetition**
    scheduling (so assisted answers are reviewed sooner).
  Hint info is NOT sent to the grading prompt.

### D-014: Grader Provenance and Pinning
- **Date:** 2026-09-29
- **Context:** Different LLMs grade inconsistently. A score of 3 from Gemini
  may be 2 from Groq. This makes progress trends meaningless.
- **Decision:** Pin grading to one provider (Gemini by default, configurable
  via `is_grading_primary` flag). Store `grader_id` (provider:model),
  `rubric_version`, and `is_fallback_grade` on every `SESSION_STEP`. If the
  primary grader is unavailable, the fallback grades with a flag so the user
  knows scores may not be directly comparable.

### D-015: User Text in USER Role, Not SYSTEM
- **Date:** 2026-09-29
- **Context:** v0.1 stuffed the user's answer into the SYSTEM prompt alongside
  the grading instructions. This is prompt injection surface and is semantically
  wrong — user-provided text should be in the USER role.
- **Decision:** All user-provided text (answers, recaps, custom topic requests)
  is sent in the USER message role. SYSTEM contains only instructions, rubric,
  and reference key points. This is both more secure and more natural for LLMs.

### D-016: English Feedback on Original Voice Transcripts (Grading Submitted Text)
- **Date:** 2026-09-29
- **Context:** Voice answers are transcribed by browser STT or Groq Whisper.
  v0.1 allowed the user to edit the transcript before submission (for grading)
  but then graded the edited version, losing the raw speech data.
- **Decision:** Store the original voice transcript separately
  (`voice_transcript_original` column on `MESSAGE`). Grade the submitted text
  (which may be edited) for engineering quality. Send the original transcript to the English coach
  with `[VOICE]` markers so it can provide speech-specific feedback (filler
  words, run-on sentences, pronunciation-related errors).

### D-017: Quick Mode Gets Mini Transfer Challenge
- **Date:** 2026-09-29
- **Context:** v0.1 Quick Mode had no transfer challenge, meaning users who
  only do Quick Mode never practice applying knowledge to new problems.
- **Decision:** Quick Mode (2 steps) ends with a **mini transfer challenge**:
  a single focused question applying the same thinking to a related scenario.
  No full recap or English report in Quick Mode (keep it fast).

### D-018: Direct REST Adapters for AI Providers (Zero Vendor SDK Bloat)
- **Date:** 2026-09-30
- **Context:** v0.1 referenced `@google/generative-ai` and considered `@google/genai`. However, multi-provider integration across Gemini, Groq, Mistral, and Cohere benefited from a unified, zero-dependency HTTP client.
- **Decision:** Use lightweight direct REST/SSE adapters using Node 24 native `fetch` across all providers, with `gemini-3.8-flash` as the default Gemini model.
- **ADR:** [ADR-009](adr/009-rest-adapters-vs-provider-sdks.md)

### D-019: Native node:sqlite Driver & WebAssembly Argon2id
- **Date:** 2026-09-29
- **Context:** `better-sqlite3` and `@node-rs/argon2` native addons caused compilation
  and MSVC DLL dependencies on Windows and dev machines.
- **Decision:** Use Node 24 native built-in `node:sqlite` (`DatabaseSync` + `drizzle-orm/sqlite-proxy`)
  and WebAssembly `hash-wasm` for Argon2id. Pin Node to `^24.0.0`.
- **ADR:** [ADR-008](adr/008-sqlite-driver-and-argon2-wasm.md)

### D-020: Autonomous Verification & E2E Testing via Native HTTP/PWA and Mobile Release Gates
- **Date:** 2026-09-30
- **Context:** During overnight autonomous Phase 7 execution on Windows x64, the automated browser subagent driver could not fetch browser binaries because Microsoft Azure CDN returned HTTP 404 for `playwright-1.57.0-win32_x64.zip`.
- **Decision:** Do not block execution or abort the overnight run. Verify all system and client behaviors through a multi-tier testing pipeline:
  1. Full Vitest integration test suite (16 test files, 92 tests passing) covering all API routes, SSE streaming, SQLite transactions, Argon2id auth, rate limiting, and encrypted backup/restore.
  2. Native production server health verification script (`scripts/verify-health.ts`) validating `/healthz` and `/readyz` against active SQLite WAL storage.
  3. Production web app compilation (`tsc -b && vite build`) validating the complete PWA bundle and service worker.
  4. Explicit manual verification checklist (`docs/MORNING_CHECKLIST.md`) for real device testing (Android Chrome / iOS Safari) with microphone and PWA installation permissions when the user wakes up.

### D-021: Reconciliation of 2-Hint Cap, 0-4 Quality/Independence Scale, and SM-2 Composite
- **Date:** 2026-09-30
- **Context:** D-013 originally described a 4-level hint ladder (`0 hints = 4, 1 = 3, 2 = 2, 3 = 1, 4+ = 0`), while Section 6.3 of the Master Build Prompt mandated a hard cap of 2 hints per step (`MAX_HINTS_PER_STEP = 2`). Additionally, the LLM grading rubric initially spanned 1–4, while D-013 specified a 0–4 scale.
- **Decision:** Fully reconcile the scoring systems:
  1. **Quality Scale (0–4)**:
     - `4` (Mastery): Core points covered with trade-offs and edge cases.
     - `3` (Proficient): Core points covered correctly. Passing threshold.
     - `2` (Developing): Partial understanding; misses critical requirements.
     - `1` (Incomplete): Vague, off-topic, or major technical misconceptions.
     - `0` (Non-responsive/Skipped): Completely irrelevant, contradictory, or step skipped by learner.
  2. **Independence Scale (0–4) with 2-Hint Hard Cap**:
     - `0 hints used` = `4` (Unassisted mastery).
     - `1 hint used` = `3` (Minor assistance / conceptual framing nudge).
     - `2 hints used` = `2` (Substantial assistance / architectural breakdown).
     - `Step skipped` = `0` (Zero independence).
     - Hint requests $> 2$ are blocked in code with `MAX_HINTS_REACHED` (400).
  3. **Composite for SM-2 Scheduling**:
     - Calculated as `min(quality, independence)` per D-013, ensuring assisted or low-quality answers decay the review interval and are revisited promptly.

---

## Unanswered Questions (recorded for future phases)

| # | Question | Status |
|---|----------|--------|
| 1 | Exact Gemini free-tier RPM/RPD — dynamic per project | Check at key setup time |
| 2 | Oracle Cloud region availability for user's signup | Verify during Phase 7 deploy |
| 3 | Cohere trial key monthly call cap (1000/mo) — may be too low | Monitor; may deprioritize |
| 4 | Tailscale Serve TLS cert renewal — is it fully automatic? | Test during deployment |

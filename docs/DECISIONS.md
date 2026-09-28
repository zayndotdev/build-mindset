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

### D-002: Hosting — Oracle Cloud Always Free (Recommended)
- **Date:** 2026-09-29
- **Context:** User needs free hosting on the internet. Render/Railway/Fly.io
  free tiers spin down or have been discontinued. Home PC + Tailscale requires
  24/7 uptime of a personal machine.
- **Decision:** Recommend Oracle Cloud Always Free ARM tier (2 OCPU, 12 GB RAM,
  200 GB storage) with Cloudflare Tunnel for HTTPS. Truly free, always-on,
  persistent storage for SQLite. Document home PC + Tailscale as a secondary
  option.
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

### D-011: Gemini Model Selection
- **Date:** 2026-09-29
- **Context:** Gemini 2.5 Flash retiring Oct 20, 2026. Newer models available.
- **Decision:** Default to `gemini-2.0-flash` as the stable free-tier option.
  Make model IDs configurable in settings. Document that user should check
  AI Studio for latest available models and update config accordingly.

---

## Unanswered Questions (recorded for future phases)

| # | Question | Status |
|---|----------|--------|
| 1 | Exact Gemini free-tier RPM/RPD — dynamic per project | Check at key setup time |
| 2 | Oracle Cloud region availability for user's signup | Verify during Phase 7 deploy |
| 3 | Cohere trial key monthly call cap (1000/mo) — may be too low for daily use | Monitor; may need paid key or deprioritize Cohere |

# MASTER BUILD PROMPT: "Mindset" – A Private AI Engineering-Mindset Coach

> **How to use (for Zayn, not part of the prompt):** Save this file as `PROMPT.md` in an empty repo. In Antigravity's Agent Manager, start **Opus 4.6** first with: *"Read PROMPT.md fully. Execute Phase 0 only, then stop and wait for my approval."* After approving, run Sonnet 4.6 for implementation phases and Gemini Flash for tests, docs drafts and UI polish (see Section 15). Never let an agent skip a phase gate.

---

## 0. Your Role and Ground Rules

You are a team of senior engineers (staff level) building a **production-grade** application from scratch. Quality matters more than speed. Follow these rules for the entire project:

1. **Plan before code.** For every phase, first produce an implementation plan (goal, tasks, risks, files to touch). Wait for approval at each phase gate marked **[GATE]**.
2. **Ask, don't assume.** If something in this prompt is ambiguous or missing, list your questions in one batch and wait. Where I don't answer, choose the safest reasonable default and record it in `docs/DECISIONS.md`.
3. **Document as you build.** Documentation is part of "done" (Section 13). A feature without docs and tests is not finished.
4. **Record decisions.** Every significant technical choice gets an ADR in `docs/adr/` (context, options, decision, consequences).
5. **Verify, don't guess.** Free-tier limits, model IDs, SDK APIs, and browser API support change often. Check the official current documentation before using them. Never hardcode a model name; make it configuration.
6. **Small, reviewable commits** using Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
7. **Honesty.** If something doesn't work, is untested, or is a shortcut, say so in the phase report. No silent hacks, no fake data presented as real.

---

## 1. Product Vision

**Problem.** Tutorials, courses, and YouTube videos teach syntax and "type along" solutions. Learners finish them still unable to build a feature alone, because nobody taught them *how to think before typing*. It is the difference between following a recipe and being a chef.

**Solution.** "Mindset" is a private, personal AI mentor that trains **engineering thinking**. Each day (whenever the user has free time) the AI agent suggests one real-world feature (authentication, file upload, notifications, search, payments, rate limiting…), and coaches the user through **how an engineer approaches it**: it asks first, the user thinks and answers in their own words, then the AI evaluates, teaches the gaps, and shows the engineer's approach.

**Secondary goal.** All conversation happens in **English** (text and voice), so the app also builds the user's spoken and written English for technical communication.

**The user.** A single user: a working software/AI engineer with about one year of professional experience who wants to grow into a strong senior engineer and improve English. The app is **private, single-user, installed on their own phone**. It is never published to an app store and has no public sign-up.

**Success looks like:** after 30 days of use, the user can take a feature request they've never seen and independently produce a structured, professional engineering approach (clarifying questions, data model, flow, failure cases, trade-offs, build order), and explain it clearly in English.

### Non-goals (do NOT build)
- Multi-user accounts, teams, billing, public sign-up, social features
- Code-editor or code-execution features (this app teaches thinking, not typing)
- Native app-store builds
- Any tracking or third-party analytics

---

## 2. Platform and Architecture Requirements

### 2.1 Client
- **Installable PWA**, mobile-first (design for a ~390px-wide phone first, then tablet/desktop), works well in Chrome on Android and Safari on iOS.
- Stack (change only via ADR with justification): **React + TypeScript (strict) + Vite + Tailwind CSS**, with `vite-plugin-pwa`. State: TanStack Query for server state plus a small store (Zustand) for UI state.
- Offline: app shell and past lessons/history readable offline; chat requires connectivity and must show a clear offline state, never fail silently.
- Dark and light theme, respecting system preference. Accessible (WCAG 2.1 AA: contrast, focus states, screen-reader labels, reduced-motion support).

### 2.2 Server
- **Node.js + TypeScript (strict)** with **Fastify** (or Hono, decide via ADR), schema validation with **Zod** shared between client and server.
- **Streaming responses via Server-Sent Events (SSE)** for chat.
- **Database:** SQLite (WAL mode) via **Drizzle ORM** with migrations, hidden behind a repository interface so a PostgreSQL swap is a config change (document the migration path). Justify in an ADR.
- Structured logging (pino), request IDs, centralized error handling, graceful shutdown, health endpoints (`/healthz`, `/readyz`).

### 2.3 Repo layout (monorepo, pnpm workspaces)
```
apps/web            React PWA
apps/api            Fastify server
packages/shared     Zod schemas, types, constants
packages/ai         Provider adapters, router, fallback, usage tracking
packages/learning   Learning engine: prompts, rubrics, session state machine, spaced repetition
docs/               All documentation (Section 13)
scripts/            Dev/ops scripts (seed, backup, key rotation)
```

### 2.4 Deployment and privacy
- Private by design: **single-user, passphrase login**, no public registration route exists at all.
- Must be served over **HTTPS** (required for microphone access and PWA install).
- Provide in `docs/DEPLOYMENT.md` two documented, tested options: (a) Docker Compose on a small VPS or home machine reached privately via Tailscale or Cloudflare Tunnel, and (b) a managed host with a persistent volume. Recommend one and explain why.
- Backups: scripted, encrypted, restorable export and import of all user data. Test the restore.

---

## 3. Security Requirements (treat as first-class)

- **Login:** single user, passphrase hashed with **argon2id**. HttpOnly, Secure, SameSite=Strict session cookie. Rate limit and lock out repeated failures. Session expiry and logout-everywhere. (Optional later: TOTP.)
- **API keys** (Gemini, Mistral, Cohere, and the fourth provider): entered by the user in Settings, stored **encrypted at rest on the server** (AES-256-GCM, master key from an environment variable, never in the repo). Keys are **never returned to the client in full** (show only masked last-4). Never log keys, prompts containing secrets, or full user content at info level. Support key rotation.
- Standard hardening: strict CORS, CSP, security headers (helmet), input validation on every endpoint, output escaping, request size limits, per-route rate limits, dependency audit in CI, secrets scanning.
- **Prompt-injection awareness:** treat all model output and user text as untrusted. The AI must never be able to trigger privileged actions; tool/action surface is minimal and validated server-side.
- Write `docs/SECURITY.md` with a threat model (assets, actors, attack surfaces, mitigations).

---

## 4. AI Provider Layer (`packages/ai`)

The user has free-tier API keys. Providers: **Google Gemini, Mistral, Cohere, and a fourth OpenAI-compatible provider that is either xAI Grok or Groq** (the user will confirm which; build the adapter as generic "OpenAI-compatible" with configurable base URL, key, and model so either works or both can be added).

Requirements:
1. **Common interface** `LLMProvider` with: `streamChat()`, `generateStructured<T>(schema)`, `transcribe()` (optional capability), `speak()` (optional capability), `healthCheck()`, and a capabilities descriptor (streaming, JSON mode, audio in, context size, etc.).
2. **Normalize** streaming events, errors, token usage, and finish reasons across providers.
3. **Router with fallback.** Routes per task type (e.g., `coach_chat`, `grade_answer`, `generate_topic`, `english_feedback`, `transcribe`). Each task has a configurable provider priority list. On failure (429, quota exhausted, 5xx, timeout), fall back to the next provider automatically and transparently.
4. **Resilience:** exponential backoff with jitter, per-provider circuit breaker with cooldown, quota-exhausted detection (mark provider "resting" until reset), request timeouts, cancellation when the user stops generation.
5. **Structured output reliability.** Providers differ. All structured calls (grading, topic generation) must be validated with Zod; on invalid output, retry with a repair prompt, then fall back to another provider. Never trust raw JSON.
6. **Config, not code, for models.** Model IDs and limits live in a config file and are editable in Settings. Before implementing, check each provider's current official docs for model names, free-tier limits, and SDK usage, and record findings in `docs/AI_PROVIDERS.md`.
7. **Usage tracking:** per-provider request and token counts, error rates, last-success time, shown on a Settings > Providers dashboard (green/amber/red status, "test connection" button).
8. **Graceful degradation:** if all providers are down, show a clear message and let the user keep their draft answer; never lose typed input.
9. Provider-agnostic prompts: the same prompt should work across providers. Document known behavioral differences and mitigations.

---

## 5. Voice (Text + Voice in One Conversation)

The same conversation can mix typed and spoken turns. Requirements:

- **Speech-to-text:** primary is the browser's built-in recognition where available; fallback is server-side transcription (a provider Whisper-style or audio-input model, whichever the user's keys support: verify in docs). Auto-select the best available option and expose the choice in Settings.
- **Text-to-speech:** browser `speechSynthesis` by default (free, offline); optional provider TTS if available on the user's keys. Voice, speed, and language accent selectable (e.g., en-US, en-GB).
- **Modes:** (a) push-to-talk, (b) hands-free conversation mode with voice-activity detection and turn-taking. Support **barge-in** (user starts speaking, the AI stops talking).
- **The transcript is always visible and editable before sending** (so speech-recognition errors don't corrupt the lesson).
- Show clear states: idle, listening, transcribing, thinking, speaking. Handle mic permission denied, no mic, background/lock-screen interruptions, and flaky networks.
- Keep turn latency low: stream the LLM response and start speaking sentence-by-sentence rather than waiting for the full reply.
- Voice answers to "think" questions may be long and rambling. The engine must handle a long transcript gracefully (see Section 6.5).
- Write `docs/VOICE.md` describing the pipeline, browser support matrix, known limitations (especially iOS Safari), and fallbacks.

---

## 6. THE CORE: Learning Engine (`packages/learning`)

**This is the most important part of the product. Spend the most design effort here. It must feel like a world-class senior engineer mentoring the user one-on-one, not a chatbot dumping information.**

### 6.1 The Engineering Thinking Framework (the 10 steps)
Every topic is taught through this flow. The agent moves through the steps in order, and each step is a mini-exchange:

1. **Clarify the problem:** who is it for, why, what scale, what constraints? (Engineers ask questions before designing.)
2. **Scope:** what's in the first version (MVP) and what's explicitly out.
3. **Actors and use cases:** who does what (user, admin, system, third parties)?
4. **Inputs, outputs, validation:** what enters, what leaves, what makes input invalid?
5. **Data model:** entities, relationships, constraints, indexes, and what must *not* be stored (e.g., plain-text passwords, raw OTPs).
6. **Flow and states:** happy path as a state machine (e.g., unverified → verified), not just a list of steps.
7. **API contract:** endpoints, request/response shapes, status codes, idempotency.
8. **Failure and abuse:** wrong/expired OTP, duplicates, brute force, race conditions, retries, rate limits, security, data loss.
9. **Trade-offs:** at least two viable options and a reasoned choice (OTP vs magic link, sessions vs JWT, polling vs websockets).
10. **Build and ship:** the smallest working slice first, build order, testing strategy, logging/monitoring, rollout, rollback, and how it scales later.

The framework must be data-driven (stored as versioned config), so steps can be reordered, shortened for beginner level, or extended for senior level without code changes.

### 6.2 Teaching Protocol (non-negotiable behavior)
- **Ask first.** For each step, the AI asks one focused question and the user answers in their own words *before* seeing anything. **The AI must never reveal the model answer before the user has made a genuine attempt.** (If the user says "I don't know," that counts as a valid start: go to the hint ladder.)
- **One question at a time.** Never a wall of questions.
- **Hint ladder:** Level 1 nudge (a guiding question), Level 2 stronger hint (narrow the space), Level 3 partial reveal, Level 4 full engineer's answer with reasoning. The user can request the next hint; track hints used per step.
- **Evaluate, then teach.** After the user's attempt: (1) acknowledge what they got right specifically, (2) point out what's missing or risky, (3) show the engineer's version, (4) explain *why* an engineer thinks that way. Encourage, but stay honest. No empty praise. If an answer is wrong, say so kindly and clearly.
- **Use real-world analogies** for abstract concepts (e.g., a bank locker, a restaurant kitchen, traffic lights) next to the technical example.
- **Concise by default.** Short, clear turns. Expand only when the user asks or the concept demands it. Never lecture for pages.
- **Adaptive difficulty:** levels Junior / Mid / Senior per topic. Start from the profile, adjust based on performance. Senior level adds scale, consistency, observability, cost, and team/operational concerns.
- **Keep the user thinking:** end steps with a reflective prompt where useful ("What would you check first if this failed in production?").
- **Optional bridge language:** a Settings toggle (off by default) lets the AI add a short Roman Urdu clarification when the user is stuck. English remains the default and the goal.

### 6.3 Evaluation Rubric (scored, structured)
For each step, the grader returns validated structured output containing: `score` (0–4), `covered[]`, `missed[]`, `misconceptions[]`, `strengths[]`, `next_hint`, and a `confidence` value. Score each dimension of the session (Problem framing, Data, Flow, Failure thinking, Trade-offs, Communication) so the app can show a **skill radar** and trends over time. Rubrics live in versioned files (`packages/learning/rubrics/`), with clear anchor descriptions for each score so grading is consistent across providers. Build a **calibration test set** of sample answers with expected score ranges.

### 6.4 Session Lifecycle
State machine (implement explicitly, persist every transition, resumable after app close):
`SUGGESTED → TOPIC_SELECTED → WARMUP (quick recall of a previous weak spot) → STEP_n (ask → attempt → hint? → evaluate → teach) → REVIEW (summary + own-words recap) → TRANSFER_CHALLENGE → ENGLISH_FEEDBACK → COMPLETE`

- **Warm-up:** 1 quick question resurfacing a previously weak step (spaced repetition).
- **Transfer challenge:** a *new, related* feature (learned auth → now design password reset or a rate limiter). The user applies the framework with less scaffolding. This is what builds the transferable mindset, so it is mandatory.
- **Recap in own words:** the user summarizes the mental model in 3–5 sentences; the AI grades it.
- Sessions are short by design (5–15 min), pausable, and resumable. Support a "quick mode" (fewer steps) for very short free time.

### 6.5 Handling messy real input
Long or rambling voice transcripts, mixed good/bad points in one answer, off-topic replies, requests to skip, frustration, and "just give me the answer" must all be handled gracefully and in a pedagogically sound way (gently redirect; offer the hint ladder; never simply comply and destroy the learning value, but never be rigid either: after honest attempts the user always gets the answer).

### 6.6 Topic System
- **Seed catalog** of at least **50 topics** across categories: authentication and authorization, data and storage, APIs, async/background jobs, notifications, search, payments, file handling, real-time features, caching, rate limiting, observability, reliability and failure handling, scalability, security, deployment, and AI/LLM features (RAG, chat memory, agents). Each topic has: title, category, difficulty, prerequisites, learning objectives, key trade-offs, common pitfalls, and a "transfer" topic.
- **Agent suggestion logic** for the home screen: choose 3 suggestions per day based on weak areas, spaced-repetition due items, coverage gaps, and variety, with a one-line reason for each ("You missed failure cases last time, this topic drills that"). The user can also type any custom topic; the AI generates a structured topic definition (validated) on the fly.
- Avoid repeating the same topic too soon; track history.

### 6.7 Spaced Repetition and Weak-Spot Memory
Track per-step and per-skill mastery. Schedule reviews with a simple, documented algorithm (SM-2 style or Leitner; justify in an ADR). Surface "weak spot" drills. Persist everything in the database.

### 6.8 English Coaching (kept separate from thinking)
Do **not** interrupt the engineering flow with grammar corrections. After the session, provide a short English report: 3–5 most important corrections (original → better version with a one-line reason), useful technical vocabulary/phrases from the session, a pronunciation/clarity note for voice sessions if possible, and one "say it like a senior engineer" rewrite of the user's best answer. Track recurring mistakes over time. Add an optional "explain it out loud" exercise (user explains the design as if in a meeting).

### 6.9 Prompt Engineering Standards
- All system prompts live in `packages/learning/prompts/` as versioned, reviewable files, with variables and documented intent, never inline strings scattered in code.
- Separate prompts by role: Coach, Grader, Topic Generator, Suggester, English Coach, Summarizer.
- Include guardrails: stay in role, never reveal the answer early, never invent facts, admit uncertainty, and mark opinions vs best practice.
- Context management: send the framework state, the current step, the user's level, and a compact rolling summary rather than the full history. Define the summarization strategy and token budgets so it works within free-tier context limits.
- **Prompt evaluation harness:** a script that runs scripted learner personas (strong, weak, rambling, frustrated, off-topic, "just tell me") through the engine against multiple providers and checks: no early answer leaks, correct step progression, valid structured output, sensible scoring. Run it in CI on prompt changes. Document in `docs/LEARNING_ENGINE.md`.

---

## 7. Screens and UX

Mobile-first, calm, focused, fast. No clutter.

1. **Onboarding / first run:** passphrase setup, add API keys (with test buttons), pick level and voice preferences.
2. **Home ("Today"):** today's 3 suggested topics with reasons, streak, one-tap "continue last session," due reviews.
3. **Chat / Session view:** streaming messages, step progress indicator (which of the 10 steps), hint button, "I don't know" button, mic button, text input, stop-generation, and the ability to edit the last answer. Clear visual difference between the coach's questions and the engineer's model answer (the "Engineer's approach" as a collapsible card).
4. **Topic picker:** browse the catalog by category or search, or type a custom topic.
5. **Session summary:** scores per skill, what you got right, what to improve, the recap, English report.
6. **Progress:** skill radar, streak calendar, history of sessions, weak spots, English mistake trends.
7. **Review:** spaced-repetition drills.
8. **History:** all past sessions, searchable, re-readable offline.
9. **Settings:** providers and keys, routing priority, models, voice, level, bridge-language toggle, theme, data export/import/delete, session security.

UX details: skeleton loaders, optimistic UI, friendly error messages, no dead ends, haptics/subtle motion where useful (respect reduced motion), and an install prompt for the PWA.

---

## 8. Data Model (starting point; refine via ADR)

`user` (single row), `credentials`, `sessions_auth`, `provider_configs` (encrypted keys, model, priority, status), `usage_stats`, `topics`, `topic_prerequisites`, `learning_sessions` (state, level, topic, timestamps), `session_steps` (step, attempts, hints_used, score, feedback JSON), `messages` (role, content, modality: text or voice, tokens, provider used), `skill_scores` (time series), `review_items` (next_due, interval, ease), `english_reports`, `english_mistakes`, `settings`, `audit_log`. Define constraints, indexes, and retention. Include migrations and a seed script. Document with an ER diagram in `docs/DATA_MODEL.md`.

---

## 9. API Surface (design first, then implement)

Publish an OpenAPI spec in `docs/API.md`. At minimum: auth (login, logout, session), providers (list, save key, test, status), topics (list, get, generate), sessions (create, get, resume, answer, hint, skip-step, complete), chat streaming (SSE), voice (transcribe), progress, reviews, english reports, settings, export/import. Consistent error format, pagination, idempotency for mutating calls where sensible, and versioned under `/api/v1`.

---

## 10. Non-Functional Requirements

- **Performance:** first token under ~2s on typical mobile network when a provider is healthy; interactive under 3s on a mid-range phone; bundle-size budget documented and enforced.
- **Reliability:** no lost user input; autosave drafts; resumable sessions; idempotent retries.
- **Observability:** structured logs, request tracing IDs, provider metrics, an in-app diagnostics page (last errors, provider health). No third-party telemetry.
- **Cost control:** because keys are free-tier, implement request budgeting and caching where safe (e.g., cache topic definitions), and warn before limits are reached.
- **Maintainability:** strict TypeScript, ESLint + Prettier, no `any` without justification, dependency-injection at boundaries, clear module boundaries, and no dead code.
- **Privacy:** all data stays on the user's own server. A "delete everything" option must truly delete.

---

## 11. Testing Strategy

- **Unit tests** (Vitest) for the state machine, spaced repetition, router/fallback/circuit breaker, prompt builders, and validators. Target ≥80% coverage on `packages/*`.
- **Integration tests** for API routes with a test DB and mocked providers (simulate 429s, timeouts, malformed JSON, mid-stream failures).
- **E2E tests** (Playwright, mobile viewport) for: onboarding, a full session end to end, hint ladder, offline behavior, voice UI states (mocked media), settings and key management.
- **Learning-engine evals** (Section 6.9) run against real providers on demand, mocked in CI.
- **Security tests:** auth brute force, cookie flags, key never leaking in responses/logs, CORS.
- **CI (GitHub Actions):** lint, typecheck, test, build, audit, secrets scan on every push.
- Write `docs/TESTING.md` with the strategy and how to run everything.

---

## 12. Phased Delivery Plan (with gates)

Each phase ends with a short report: what was built, what was tested, what's risky, what's next. **Stop at each [GATE] and wait for approval.**

- **Phase 0 – Discovery and Design [GATE]:** read this whole prompt; list questions and risks; verify current provider docs, limits, and browser voice support; produce architecture, ADR list, data model, API outline, repo scaffold plan, and the detailed Learning Engine design (states, prompts outline, rubric draft).
- **Phase 1 – Foundation [GATE]:** monorepo, tooling, CI, Docker, config, logging, DB and migrations, auth and security basics, PWA shell, design system.
- **Phase 2 – AI Provider Layer [GATE]:** adapters, router, fallback, circuit breaker, usage tracking, Settings > Providers UI, key encryption, tests with simulated failures.
- **Phase 3 – Chat Core [GATE]:** streaming chat, message persistence, session model, mobile chat UI, stop/retry, offline states.
- **Phase 4 – Learning Engine [GATE]:** framework config, state machine, coach/grader prompts, hint ladder, scoring, topic catalog and generator, suggestion logic, spaced repetition, recap and transfer challenge, English coaching, evaluation harness. *Review this phase most strictly.*
- **Phase 5 – Voice [GATE]:** STT/TTS pipeline, push-to-talk, hands-free, barge-in, fallbacks, voice docs.
- **Phase 6 – Progress, Review, History, Polish [GATE]:** dashboards, radar, streak, drills, accessibility pass, performance pass.
- **Phase 7 – Hardening and Release [GATE]:** security review, backup/restore test, load and failure testing, deployment on the chosen host, PWA install verified on a real phone, final documentation pass, v1.0 tag.

---

## 13. Documentation Deliverables (all required, kept current)

```
README.md                  What it is, quick start, screenshots
docs/ARCHITECTURE.md       System overview, diagrams (Mermaid), data flow, module boundaries
docs/DECISIONS.md          Running decision log; docs/adr/*.md one file per major decision
docs/DATA_MODEL.md         ER diagram, table docs, retention
docs/API.md                OpenAPI spec + usage examples
docs/AI_PROVIDERS.md       Provider details, limits, quirks, routing config, fallback behavior
docs/LEARNING_ENGINE.md    Framework, state machine, rubric, prompts, spaced repetition, eval harness
docs/PROMPTS.md            Index and intent of every prompt with version history
docs/VOICE.md              Voice pipeline, browser support matrix, limitations
docs/SECURITY.md           Threat model, controls, key management, incident steps
docs/DEPLOYMENT.md         Step-by-step deploy, env vars, HTTPS, private access, backups
docs/RUNBOOK.md            Operations: monitoring, common failures, rotate keys, restore backup
docs/TESTING.md           Strategy and commands
docs/CONTRIBUTING.md       Conventions, branching, commit style, how to add a topic/provider
docs/ROADMAP.md            Future ideas (TOTP, more providers, richer analytics, etc.)
CHANGELOG.md               Keep a Changelog format
```
Every doc must be accurate to the code, written for a smart engineer new to the project, and include examples. Diagrams in Mermaid.

---

## 14. Definition of Done (per feature)

Code typed and linted, tests written and passing, error and empty and offline states handled, accessible, security considered, logs added, docs updated, ADR written if a decision was made, manually verified on a mobile viewport, and no TODOs left without a tracked entry in `docs/ROADMAP.md`.

---

## 15. Suggested Agent Split (Antigravity Agent Manager)

- **Claude Opus 4.6:** Phase 0 architecture and design, Learning Engine design and prompt/rubric authoring, security review, final review of every phase before its gate.
- **Claude Sonnet 4.6:** main implementation (server, provider layer, learning engine code, PWA).
- **Gemini Flash:** fast tasks: boilerplate, unit and E2E test writing, documentation drafts, UI polish, and running the eval harness.
- Agents must not edit the same files in parallel. Use separate branches per task and merge after review. Opus (or the human) reviews before merging into `main`.

---

## 16. Before You Start: Questions to Ask Me

After reading this, and before Phase 0's design is final, ask me (in one batch) about anything unclear, including at minimum:
1. Which is the fourth provider: xAI Grok or Groq (or both)?
2. Where will this be hosted (home machine + Tailscale, VPS, or managed host)?
3. Phone OS and browser I'll use (Android/Chrome or iPhone/Safari), since it affects voice support.
4. Any topics or skills I especially want prioritized in the first catalog.

**Begin with Phase 0 now. Do not write application code until I approve the Phase 0 report.**

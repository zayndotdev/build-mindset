# Changelog

All notable changes to the Mindset application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-30

### Added
- **Monorepo Foundation (Phase 1.1)**:
  - Turborepo + pnpm workspaces architecture (`apps/api`, `apps/web`, `packages/ai`, `packages/learning`, `packages/shared`).
  - Node.js 24 native `node:sqlite` driver with SQLite WAL mode and Drizzle ORM.
  - Argon2id WebAssembly hashing (`hash-wasm`) with cryptographically random 16-byte salts and constant-time dummy hash verification to eliminate timing attacks.
  - Fastify web server with `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cookie`, and `@fastify/cors`.
  - First-run setup flow (`POST /api/v1/auth/setup`) for initial passphrase configuration.
- **AI Provider Layer (Phase 2)**:
  - Multi-provider adapter system supporting Google Gemini (`@google/genai`), Groq, Mistral AI, and Cohere.
  - Dynamic live model discovery and capability validation.
  - Smart AI Router with automatic fallback on HTTP 429/500 errors and quota-aware resting.
  - Tri-state Circuit Breaker (`CLOSED`, `OPEN`, `HALF_OPEN`) preventing cascade failures.
  - AES-256-GCM authenticated encryption for provider API keys with zero plaintext in logs.
  - Pinned grading provider support with provenance tracking (`graderId`, `rubricVersion`, `isFallbackGrade`).
- **Chat Core & Streaming (Phase 3)**:
  - Server-Sent Events (SSE) chat streaming (`POST /api/v1/sessions/:id/answer`).
  - SQLite persistent session history and conversation turn replay.
  - Client-side SSE stream consumer with graceful disconnection and retry handling.
- **Learning Engine & Socratic Core (Phase 4)**:
  - Socratic state machine supporting 4-step standard sessions and Quick Mode with mini transfer challenges.
  - Progressive hint ladder with hard caps (maximum 2 hints per step).
  - Decoupled scoring: Answer Quality (0–4) evaluated purely on key points coverage; Independence Score (0–4) computed deterministically from hint count.
  - 50-topic engineering curriculum catalog seeded in database.
  - Automated evaluation harness (`EvalHarness`) verifying consistent grading across 4 scripted engineering personas.
  - Post-session English coaching analyzing vocabulary, grammar, and communication conciseness.
  - SuperMemo-2 (SM-2) spaced repetition scheduling algorithm.
- **Voice Pipeline (Phase 5)**:
  - Client-side Web Speech API integration (`webkitSpeechRecognition`, `speechSynthesis`).
  - Server-side audio transcription fallback (`POST /api/v1/voice/transcribe`) via Groq Whisper (`whisper-large-v3-turbo`).
  - Original voice transcript preservation (`voice_transcript_original`) for spoken communication coaching (filler words, run-on thoughts).
- **Progress Analytics & Spaced Reviews (Phase 6)**:
  - Interactive SVG Skill Radar Chart visualising candidate competency across 5 core dimensions (Quality scores only).
  - Chronological Independence Trend tracker highlighting hint reliance trajectory.
  - SM-2 Spaced Repetition Due Queue with interactive recall drill modal and 4-tier rating controls.
  - Past session history list and deep transcript modal.
  - Accessibility audit compliance: ARIA tablists, keyboard navigation, minimum 44px tap targets.
- **Hardening & Disaster Recovery (Phase 7)**:
  - Automated encrypted backup pipeline (`packages/shared/src/crypto/backup.ts`) leveraging SQLite `VACUUM INTO` for atomic WAL checkpointing.
  - AES-256-GCM tamper-evident backup format (`MBKP` header + IV + Auth Tag + Ciphertext) with full restore validation CLI.
  - Comprehensive operations runbook, security threat model, and deployment documentation.

# Phase 4 Report: Learning Engine & Topic Curriculum

**Date**: 2026-09-30  
**Status**: COMPLETE  
**Branch**: `overnight`  
**Test Suite**: 13 test files passed, 73 tests green, 0 failures.

---

## 1. Executive Summary

Phase 4 implements the core intellectual engine of Mindset: the Socratic state machine, the multi-dimensional evaluation rubric, SM-2 spaced repetition scheduling, English language fluency analysis, the 50-topic engineering curriculum, and an automated evaluation harness testing 4 candidate personas (Senior, Mid-Level, Rambler, and Novice).

Per the master specification, topic selection enforces strict rubric provenance: 4 topics are fully authored with verified reference key points and model answers across Foundation, Working, and Advanced difficulty tiers. The remaining 46 topics are cataloged in the database and schema with full metadata (learning objectives, key tradeoffs, common pitfalls, and tags) marked `referenceStatus: "unauthored"`, and are strictly blocked from graded session selection at both the API route and UI levels until full rubrics are authored.

---

## 2. Deliverables & Implementation Details

### A. Socratic State Machine & Hint Ladder (`packages/learning`)
- **Step Progression**: Default 4-step standard session (`problem_exploration`, `architecture_tradeoffs`, `edge_cases_failure_modes`, `recap_synthesis`), plus a 2-step Quick Mode featuring an immediate mini transfer challenge.
- **Hint Enforcement**: Hard-capped at 2 hints per step. Hint request decrements independence:
  - 0 hints: Independence = 4 (Expert)
  - 1 hint: Independence = 3 (Guided)
  - 2 hints: Independence = 2 (Assisted)
- **Step Skipping**: Explicit skip endpoint (`POST /sessions/:id/skip`) immediately reveals the step's model answer, increments the step index, and sets that step's Independence score strictly to 0 (Unassisted failure) without corrupting quality ratings.

### B. Dual-Metric Scoring Engine
- **Decoupled Quality vs. Independence**: Answer quality (1-4 scale evaluating factual accuracy, depth, and edge cases against reference key points) is tracked independently from user independence.
- **Grader Provenance**: Each grade persists the provider ID, model name, rubric version (`v1.0`), and fallback indicator (`isFallbackGrade: false`).
- **Transfer Challenge**: Evaluates cross-domain application of architectural concepts with dedicated transfer rubrics.

### C. English Communication Evaluator
- Analyzes candidate responses for:
  - **Grammar & Syntax**: Precision and vocabulary appropriateness.
  - **Fluency**: Structural coherence and logical flow.
  - **Conciseness**: Ratio of informative content to filler words.
- Generates actionable communication coaching reports persisted per session.

### D. SM-2 Spaced Repetition Algorithm
- Implements standard SuperMemo-2 spaced repetition:
  - New Easiness Factor: $EF' = EF + (0.1 - (5 - q) \cdot (0.08 + (5 - q) \cdot 0.02))$, bounded at $EF \ge 1.3$.
  - Interval progression: $I_1 = 1$, $I_2 = 6$, $I_n = I_{n-1} \cdot EF$.
  - Generates next review date and populates spaced repetition queues.

### E. Curriculum Architecture & Reference Status Guard
- **4 Fully Authored Topics**:
  1. `auth-email-password`: Argon2id, timing attack mitigations, secure session tokens, IETF draft rate limiting.
  2. `db-relational-schema`: PostgreSQL schema modeling, composite B-tree index design, foreign key strategies.
  3. `api-restful-design`: Idempotency keys, HTTP status codes, standard RateLimit headers, URL pagination.
  4. `ai-rag`: Dense vector embeddings, chunking strategies, cosine similarity retrieval, reranking pipelines.
- **46 Roadmap Spec Topics**: Fully cataloged with learning objectives, tradeoffs, pitfalls, and category tagging.
- **Guard Enforcement**: `POST /api/v1/sessions` validates `topic.referenceStatus === 'authored'`. Requests with unauthored topics return HTTP 400 with code `TOPIC_UNAUTHORED`.
- **Web UI**: `TopicsView.tsx` fetches all 50 topics dynamically, renders status badges ("Ready to Practice" vs "Spec Roadmap"), and disables session launch for roadmap topics with clear explanation.

### F. Scripted Persona Evaluation Harness (`packages/learning/tests/eval-harness.test.ts`)
- Evaluates 4 distinct synthetic developer personas against the grading engine:
  - **Senior Engineer**: High quality (3.8-4.0), high independence (4.0).
  - **Mid-Level Engineer**: Good foundational knowledge (2.8-3.2), requires occasional hints (independence 2.5-3.0).
  - **Rambler**: Verbose with tangential answers; triggers concise coaching in English evaluation.
  - **Novice**: Struggles with fundamentals (1.0-2.0), reaches maximum hint caps or skips.

---

## 3. Test & Verification Evidence

- Total test files: **13/13 passing**
- Total tests: **73/73 green**
- Monorepo Typecheck: Clean (`pnpm typecheck` exit code 0)
- Guard test: `rejects starting a graded session with an unauthored topic` verified green in `apps/api/tests/session-routes.test.ts`.

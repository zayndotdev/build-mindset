# Prompts Catalog & LLM Directives — Mindset

> Index, versioning, system instructions, schemas, and token budget specifications for all prompts in Mindset.

---

## 1. Prompt Architecture & Security Guardrails

All prompt generation in `@mindset/learning` follows two non-negotiable security principles:
1. **Decision D-015 (Role Segregation)**: System instructions, rubrics, and reference key points reside strictly in the `SYSTEM` role. User-generated text (candidate answers, transcripts) is placed exclusively in the `USER` role.
2. **Deterministic Grading Separation (Decision D-013)**: The grading prompt evaluates **Answer Quality only (0–4)** based on technical accuracy and coverage of key points. Hint counts and independence are computed deterministically in server code and are **never** passed into the grading prompt.

---

## 2. Prompt Index

### 1. Socratic Step Coach (`CoachPrompt`)
- **Intent**: Asks the candidate the framing question for the current step in the architectural workflow.
- **Role**: `SYSTEM`
- **Context Injected**: Topic title, description, level (1–3), current step name, step objective, and reference key points.
- **Estimated Tokens**: ~350 prompt tokens, ~150 completion tokens.
- **Directive**: "You are a staff-level systems architect mentoring a junior-to-mid engineer. Frame the problem concisely. Ask the candidate to articulate their approach before offering any solution."

### 2. Answer Evaluator (`GraderPrompt`)
- **Intent**: Objectively evaluates the candidate's answer against reference key points and model answers.
- **Role**: `SYSTEM`
- **Output Schema** (Structured JSON):
  ```json
  {
    "score": 3,
    "matchedKeyPoints": ["Identified bcrypt/Argon2id for hashing", "Recognized salt requirement"],
    "missingKeyPoints": ["Did not mention work factor/cost tuning"],
    "misconceptions": [],
    "feedback": "Strong foundational approach. Be sure to consider how work factors scale over time.",
    "teachingPoint": "Work factors should be tuned to match current hardware capabilities (e.g. ~500ms per verification)."
  }
  ```
- **Estimated Tokens**: ~600 prompt tokens, ~250 completion tokens.
- **Rubric**:
  - `4` (Staff/Senior): All core key points covered with trade-offs and edge cases.
  - `3` (Strong Mid-Level): Core points covered with solid understanding; minor omission.
  - `2` (Developing/Junior): Partial understanding; missed critical trade-offs.
  - `1` (Novice): Substantial gaps; flawed technical assumptions.
  - `0` (Off-topic/Incorrect): Incoherent or fundamentally incorrect.

### 3. Hint Ladder Generator (`HintPrompt`)
- **Intent**: Provides a progressive nudge without giving away the model answer.
- **Hint Levels**:
  - **Hint 1 (Conceptual Framing)**: Nudges the candidate toward the dimension they missed (e.g., *"What happens if two users attempt this operation simultaneously?"*).
  - **Hint 2 (Architectural Direction)**: Provides a concrete architectural clue or pattern name (e.g., *"Consider an idempotency key stored in Redis with an atomic SETNX check"*).
- **Hard Cap**: Maximum 2 hints per step. Further hint requests are blocked in code.

### 4. Transfer Challenge Generator (`TransferPrompt`)
- **Intent**: Tests whether the candidate can transfer the architectural principle learned in this session to a completely different domain or scenario.
- **Quick Mode**: Generates a single focused mini-transfer question.
- **Standard Mode**: Generates a comprehensive transfer scenario with a prompt for key trade-offs.

### 5. English Communication Coach (`EnglishCoachPrompt`)
- **Intent**: Evaluates the candidate's technical communication, grammar, and spoken delivery.
- **Input**: User answers from all steps, including raw voice transcripts marked with `[VOICE]`.
- **Output**:
  - Technical vocabulary usage (accurate systems terminology).
  - Grammar and sentence structure corrections.
  - Spoken feedback: filler words (*"like"*, *"um"*), run-on sentences, conciseness tips.

# ADR-009: Direct REST Adapters vs. Vendor SDKs for AI Providers

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Engineering Team
- **Consulted:** [D-018](../DECISIONS.md#d-018-gemini-sdk--use-googlegenai), [ADR-003](003-groq-fourth-provider.md)

---

## Context

In Decision D-018, using Google's unified `@google/genai` SDK was initially recommended to replace the legacy `@google/generative-ai` package. Mindset integrates four distinct AI providers:
1. Google Gemini
2. Groq (OpenAI-compatible)
3. Mistral AI
4. Cohere

During Phase 2 implementation of `@mindset/ai`, we evaluated two architectural patterns:
1. **Vendor SDK Pattern**: Install `@google/genai`, `groq-sdk`, `@mistralai/mistralai`, and `cohere-ai`.
2. **Direct REST Adapter Pattern**: Implement lightweight adapters using Node.js 24 native built-in `fetch` against the providers' official REST/SSE endpoints.

---

## Decision

We chose the **Direct REST Adapter Pattern** using Node.js 24 native `fetch` across all four providers, including Gemini (`https://generativelanguage.googleapis.com/v1beta`).

---

## Rationale

1. **Zero External SDK Bloat & Cross-Platform Stability**:
   - Vendor SDKs frequently pull heavy dependency trees, platform-specific binaries, or Node-incompatible browser shims.
   - Using native `fetch` ensures `@mindset/ai` has **zero external SDK dependencies** (only `zod` for validation). It compiles cleanly with `tsup` to both ESM and CJS and runs identically on Windows x64, Linux ARM64 (Oracle VM), and inside container environments.
2. **Unified Streaming & Error Handling**:
   - All 4 adapters share a standard `BaseAdapter` interface.
   - Server-Sent Events (SSE) streaming (`streamGenerateContent`, `/chat/completions`) is consumed via standard web streams (`ReadableStreamDefaultReader<Uint8Array>`), allowing identical chunk normalization and timeout handling across all providers.
3. **Model Configuration & Deprecation Agility**:
   - Google's official REST endpoint (`v1beta/models/${model}:generateContent`) provides full capability support:
     - `systemInstruction` support
     - `responseMimeType: "application/json"` for deterministic structured outputs
     - Temperature, maxOutputTokens, and safety settings
     - Dynamic model listing (`v1beta/models`) to discover models like `gemini-3.8-flash` dynamically.
4. **Maintenance & Longevity**:
   - Vendor client libraries often undergo frequent breaking interface changes across minor versions. REST endpoints adhere to strict API stability guarantees.

---

## Consequences

- **Positive:**
  - Fast install times (`pnpm install` is fast and small).
  - No C++ compilation or node-gyp dependencies.
  - Consistent circuit breaking, quota tracking, and error mapping across all 4 providers.
- **Negative:**
  - We maintain the HTTP request and response payload types in TypeScript rather than importing them from vendor SDKs. (Mitigated: TypeScript types in `@mindset/ai` are fully validated with Zod).

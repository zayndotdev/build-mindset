# ADR-003: Fourth Provider — Groq (OpenAI-Compatible Adapter)

**Status:** Accepted
**Date:** 2026-09-29
**Deciders:** Phase 0 design review

## Context

The spec requires a fourth OpenAI-compatible provider. User has a Groq API key.
The adapter should be generic enough to support any OpenAI-compatible endpoint.

## Options Considered

### Option A: Groq-specific adapter
- Tighter integration, Groq-specific optimizations
- Less reusable

### Option B: Generic OpenAI-compatible adapter (chosen)
- Configurable `baseUrl`, `apiKey`, `model`
- Works with Groq, xAI Grok, OpenRouter, any OpenAI-compatible API
- One adapter, multiple providers via config

## Decision

**Generic OpenAI-compatible adapter**, defaulting to Groq. Configuration:

```typescript
{
  id: "groq",
  type: "openai-compatible",
  baseUrl: "https://api.groq.com/openai/v1",
  models: {
    chat: "llama-3.3-70b-versatile",
    fast: "llama-3.1-8b-instant",
    transcribe: "whisper-large-v3-turbo"
  }
}
```

## Groq Free-Tier Findings (Sep 2026)

| Model | RPM | RPD | TPD |
|-------|-----|-----|-----|
| Llama 3.1 8B Instant | 30 | 14,400 | 500,000 |
| Llama 3.3 70B Versatile | 30 | 1,000 | 100,000 |
| Whisper Large v3 Turbo | — | — | — |

**Key advantage:** Groq is extremely fast (LPU inference). Ideal for the
`fast` and `transcribe` tasks. The 70B model is strong enough for grading.

## Consequences

- ✅ One adapter covers Groq + any future OpenAI-compatible provider
- ✅ Groq provides Whisper for STT fallback at no additional cost
- ✅ Groq's speed helps meet the <2s first-token target
- ⚠️ 70B model daily token cap (100K) limits heavy use — fallback to other providers
- ⚠️ Free tier limits may change — config must be updatable

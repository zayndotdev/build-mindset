# AI Providers — Verified Findings

> **Phase 0 Research** · Verified September 29, 2026
>
> ⚠️ Free-tier limits change frequently. Always verify in each provider's
> console before relying on these numbers.

---

## Provider Summary

| Provider | Type | Best For | Free-Tier Risk |
|----------|------|----------|----------------|
| **Google Gemini** | Native SDK | Coach chat, grading (strong reasoning) | Dynamic quotas, data used for training |
| **Groq** | OpenAI-compatible | Fast responses, transcription (Whisper) | Daily token caps on 70B model |
| **Mistral** | Native SDK | Backup coach, structured output | ~1 RPS, no published hard limits |
| **Cohere** | Native SDK | Tertiary fallback, topic generation | 1,000 calls/month hard cap |

---

## 1. Google Gemini

### Access
- **Platform:** Google AI Studio (`https://aistudio.google.com`)
- **SDK:** `@google/generative-ai` (Node.js)
- **Auth:** API key

### Available Models (Free Tier, Sep 2026)
| Model | Context Window | Notes |
|-------|---------------|-------|
| `gemini-2.0-flash` | 1M tokens | Stable, recommended for free tier |
| `gemini-3.5-flash-lite` | TBD | Newer, check AI Studio availability |
| `gemini-3.6-flash` | TBD | Newer, check AI Studio availability |

> **Note:** `gemini-2.5-flash` retiring Oct 20, 2026. Do NOT use as default.

### Free-Tier Limits (approximate — check AI Studio)
| Metric | Typical Value |
|--------|--------------|
| RPM | 15–30 |
| RPD | 1,500 |
| TPM | 250,000 |

### Capabilities
- ✅ Streaming (`streamGenerateContent`)
- ✅ JSON mode / structured output
- ✅ System instructions
- ✅ Long context (1M tokens)
- ❌ Audio transcription (no Whisper equivalent on free tier)
- ❌ TTS

### Quirks
- Free-tier data may be used by Google to improve models
- Rate limits are dynamic and per-project (not published as fixed numbers)
- JSON mode works but can sometimes produce markdown-wrapped JSON — validate with Zod

---

## 2. Groq

### Access
- **Platform:** Groq Console (`https://console.groq.com`)
- **SDK:** OpenAI-compatible (`openai` npm package with custom `baseURL`)
- **Base URL:** `https://api.groq.com/openai/v1`
- **Auth:** API key (`gsk_...`)

### Available Models (Free Tier, Sep 2026)
| Model | Context | Best For |
|-------|---------|----------|
| `llama-3.3-70b-versatile` | 128K | Grading, coaching (strong reasoning) |
| `llama-3.1-8b-instant` | 128K | Fast tasks, topic generation |
| `whisper-large-v3-turbo` | — | Audio transcription (STT fallback) |
| `qwen3-32b` | 128K | Alternative reasoning model |

### Free-Tier Limits
| Model | RPM | RPD | TPD |
|-------|-----|-----|-----|
| Llama 3.1 8B Instant | 30 | 14,400 | 500,000 |
| Llama 3.3 70B Versatile | 30 | 1,000 | 100,000 |
| Whisper Large v3 Turbo | — | — | — |

### Capabilities
- ✅ Streaming (OpenAI-compatible SSE)
- ✅ JSON mode (`response_format: { type: "json_object" }`)
- ✅ System messages
- ✅ Audio transcription (Whisper)
- ❌ TTS
- 🚀 **Extremely fast inference** (LPU architecture) — best for first-token latency

### Quirks
- No credit card required
- 70B model has tight daily token cap (100K TPD) — use 8B for non-critical tasks
- OpenAI SDK compatible — minimal adapter code needed
- Whisper supports up to 100 MB audio files

---

## 3. Mistral

### Access
- **Platform:** La Plateforme (`https://console.mistral.ai`)
- **SDK:** `@mistralai/mistralai` (Node.js)
- **Auth:** API key

### Available Models (Free Tier, Sep 2026)
| Model | Context | Best For |
|-------|---------|----------|
| `mistral-small-latest` (Small 4) | 128K | General coaching, structured output |
| `mistral-large-latest` (Large 3) | 128K | Complex reasoning (may not be on free tier) |

### Free-Tier Limits
| Metric | Typical Value |
|--------|--------------|
| RPM | ~30 |
| RPS | ~1 |
| Published hard caps | None (check console) |

### Capabilities
- ✅ Streaming
- ✅ JSON mode / structured output
- ✅ System messages
- ✅ Tool calling (not needed for our use case)
- ❌ Audio transcription (Voxtral Transcribe is paid)
- ❌ TTS (Voxtral TTS is paid, $16/M chars)

### Quirks
- Free tier = "Experiment" mode. Data may be used for model improvement
- No publicly documented hard caps — must check console
- `mistral-small-latest` is the workhorse; `large` may require paid tier
- Good at structured output / JSON mode

---

## 4. Cohere

### Access
- **Platform:** Cohere Dashboard (`https://dashboard.cohere.com`)
- **SDK:** `cohere-ai` (Node.js)
- **Auth:** Trial API key

### Available Models (Free Tier, Sep 2026)
| Model | Context | Best For |
|-------|---------|----------|
| `command-r` | 128K | General text generation |
| `command-r-plus` | 128K | Higher quality reasoning |
| `command-r7b-12-2024` | 128K | Lighter, faster |

### Free-Tier Limits
| Metric | Value |
|--------|-------|
| Monthly calls | **1,000** (hard cap across all endpoints) |
| RPM (generation) | 20 |
| RPM (embed) | 2,000 inputs/min |

### Capabilities
- ✅ Streaming
- ✅ Structured output (via `response_format`)
- ✅ System messages (preamble)
- ❌ Audio transcription
- ❌ TTS

### Quirks
- **1,000 calls/month is very restrictive** — ~33 calls/day
- Trial key is for evaluation only, not commercial use (personal app is fine)
- Best used as a tertiary fallback, not a primary provider
- Good at RAG-style tasks (relevant for our topic generation)

---

## 5. Task-to-Provider Routing (Default Priority)

| Task | Primary | Fallback 1 | Fallback 2 | Fallback 3 |
|------|---------|-----------|-----------|-----------|
| `coach_chat` | Gemini | Groq (70B) | Mistral | Cohere |
| `grade_answer` | Gemini | Groq (70B) | Mistral | Cohere |
| `generate_topic` | Groq (8B) | Mistral | Gemini | Cohere |
| `suggest_topics` | Groq (8B) | Gemini | Mistral | — |
| `english_feedback` | Gemini | Mistral | Groq (70B) | Cohere |
| `summarize` | Groq (8B) | Mistral | Gemini | — |
| `transcribe` | Browser STT | Groq Whisper | — | — |

### Routing Rationale
- **Gemini** as primary for coaching/grading — largest context window, strong reasoning
- **Groq 8B** for fast, cheap tasks (topic gen, summaries) — speed and high daily quota
- **Groq 70B** as first fallback for reasoning tasks — fast and capable
- **Cohere** always last due to 1,000 calls/month hard cap
- **Transcribe** prefers free browser API; only uses Groq Whisper when unavailable

---

## 6. Cost Control Strategy

1. **Browser STT first** — zero API cost for voice input
2. **Cache topic definitions** — generated once, reused
3. **Compact context** — rolling summaries, not full history (see Learning Engine)
4. **Request budgeting** — daily counter per provider; warn at 80% of known limits
5. **Prefer smaller models** for non-critical tasks (Groq 8B for summaries)
6. **Cohere conservation** — use only as last-resort fallback (~33 calls/day budget)

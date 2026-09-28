# ADR-006: Voice Architecture — Browser Web Speech Primary, Groq Whisper Fallback

**Status:** Accepted
**Date:** 2026-09-29
**Deciders:** Phase 0 design review

## Context

The spec requires mixed text+voice conversations with STT and TTS. Voice must
work on Android Chrome (primary) and ideally iOS Safari. Free-tier API
consumption must be minimized.

## Research Findings (Sep 2026)

### Speech-to-Text (STT)

| Method | Cost | Android Chrome | iOS Safari | Notes |
|--------|------|----------------|------------|-------|
| Web Speech API (`webkitSpeechRecognition`) | Free | ✅ Partial | ✅ Partial | Requires `webkit` prefix. iOS: doesn't work in Home Screen PWA mode |
| Groq Whisper (`whisper-large-v3-turbo`) | Free tier | ✅ | ✅ | Server-side, requires audio upload. 100 MB file limit |
| Mistral Voxtral Mini Transcribe | Paid | ✅ | ✅ | Not on free tier |

### Text-to-Speech (TTS)

| Method | Cost | Android Chrome | iOS Safari | Notes |
|--------|------|----------------|------------|-------|
| Web `speechSynthesis` | Free | ✅ | ✅ | Voices vary by device. Must be triggered by user interaction |
| Mistral Voxtral TTS | $16/M chars | ✅ | ✅ | Not free tier |
| Browser offline TTS | Free | ✅ | ✅ | Limited voice quality |

## Decision

### STT Strategy (tiered)
1. **Primary:** Browser `webkitSpeechRecognition` — free, no API cost, works
   well on Android Chrome
2. **Fallback:** Groq Whisper API — server-side transcription when browser API
   is unavailable (e.g., iOS PWA Home Screen, Firefox)
3. **Detection:** Auto-detect browser support; allow manual override in Settings

### TTS Strategy
1. **Primary and only (v1):** Browser `speechSynthesis` — free, works on both
   platforms. Stream sentence-by-sentence as LLM tokens arrive.
2. **Future (v2):** Provider TTS if user has paid keys (Voxtral, etc.)

### Voice Activity Detection (VAD)
- Use a lightweight client-side VAD library (e.g., `@ricky0123/vad-web`) for
  hands-free mode
- Detects speech start/end without continuous API calls
- Enables barge-in: if user starts speaking, cancel TTS playback

## Key Implementation Details

```
Voice Pipeline:
  User taps mic → check browser STT support
  ├── Supported: webkitSpeechRecognition.start()
  │   ├── interim results → show in text field (gray)
  │   └── final result → show in text field (black, editable)
  └── Not supported: MediaRecorder.start()
      ├── user stops recording → POST audio blob to /api/v1/voice/transcribe
      └── server: Groq Whisper → return transcript → editable text field

  In all cases: user reviews/edits transcript → explicit send
```

## iOS Safari Limitations (documented)

1. `webkitSpeechRecognition` works in Safari tab but **NOT** in "Add to Home
   Screen" PWA mode
2. `speechSynthesis.speak()` must be called from a user gesture handler
3. `pause()`/`resume()` unreliable — use `cancel()` + re-speak for barge-in
4. Voice list loading is async — wait for `voiceschanged` event

## Consequences

- ✅ Zero API cost for the primary voice path (browser APIs)
- ✅ Groq Whisper fallback is also free tier
- ✅ Editable transcript prevents speech errors from corrupting lessons
- ✅ Works well on primary target (Android Chrome)
- ⚠️ iOS PWA Home Screen users must use Groq Whisper fallback (uses quota)
- ⚠️ Browser TTS voice quality varies — document how to install better system voices
- ⚠️ Hands-free mode with VAD adds client-side complexity

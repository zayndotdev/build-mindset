# Voice Pipeline Specification — Mindset

> End-to-end voice architecture, speech recognition, audio transcription fallback, text-to-speech, and browser support matrix for Mindset.

---

## 1. Voice Pipeline Overview

```
                      +---------------------------------------+
                      |             User Voice                |
                      +-------------------+-------------------+
                                          |
                                          v
                         [ Browser Speech Recognition API ]
                                          |
                +-------------------------+-------------------------+
                | Available (Android Chrome)                        | Unavailable / Error (iOS / Safari)
                v                                                   v
     [ Real-Time STT Stream ]                             [ MediaRecorder Audio Blob ]
                |                                                   |
                |                                                   v
                |                                       [ POST /api/v1/voice/transcribe ]
                |                                                   |
                |                                                   v
                |                                       [ Groq Whisper API Adapter ]
                +-------------------------+-------------------------+
                                          |
                                          v
                           [ Candidate Edit Preview ]
                           - User reviews/edits text
                           - Original audio text saved
                                          |
                                          v
                       +------------------+------------------+
                       |                                     |
                       v                                     v
            [ Engineering Grader ]                 [ English Coach ]
            - Evaluates submitted text             - Evaluates original transcript
            - Grades technical accuracy            - Flags fillers, pauses, run-ons
```

---

## 2. Browser Compatibility Matrix

| Platform / Browser | Speech Recognition (STT) | Speech Synthesis (TTS) | Recommended Mode |
|---|---|---|---|
| **Android Chrome** (Primary) | Full native support (`webkitSpeechRecognition`) | Full native support (`speechSynthesis`) | Client-side Web Speech (Zero quota cost) |
| **iOS Safari** | Partial / Intermittent (Requires user gesture per utterance; background pause issues) | Supported (Requires user touch event) | Server-side Groq Whisper fallback (`POST /voice/transcribe`) |
| **Desktop Chrome / Edge** | Full native support | Full native support | Client-side Web Speech |
| **Desktop Firefox** | Disabled by default / Flag required | Full native support | Server-side Groq Whisper fallback |

---

## 3. Speech-to-Text (STT) Mechanics

### Primary: Browser Web Speech API
- Utilizes `window.webkitSpeechRecognition` or `window.SpeechRecognition`.
- Continuous listening enabled during push-to-talk.
- Real-time interim results rendered in the chat input field as the user speaks.
- When speech finishes (or user releases push-to-talk), the final transcript is populated.

### Fallback: Groq Whisper (`POST /api/v1/voice/transcribe`)
When client-side speech recognition is unavailable or errors out:
1. Client records audio using the `MediaRecorder` API (`audio/webm` or `audio/mp4`).
2. Client sends audio to `POST /api/v1/voice/transcribe` either as:
   - Binary buffer payload with `Content-Type: audio/webm`.
   - JSON payload with `{ audioBase64: "...", mimeType: "audio/webm" }`.
3. Server dispatches the audio to Groq Whisper (`whisper-large-v3-turbo` or `whisper-large-v3`).
4. Server returns `{ transcript: "..." }`.

---

## 4. Transcript Preservation & English Coaching (Decision D-016)

When answering via voice:
1. **Candidate Review**: The transcribed text appears in an editable input box. The user may fix typos or edit their phrasing before submitting.
2. **Database Storage**:
   - The user's submitted text is stored in `content` and used for engineering grading against key points.
   - The original raw transcript is stored in `voice_transcript_original` with `modality = "voice"`.
3. **English Communication Evaluation**:
   - The post-session English coach receives the original voice transcript flagged with `[VOICE]`.
   - Analyzes spoken habits:
     - Verbal fillers (*"um"*, *"uh"*, *"like"*, *"you know"*).
     - Run-on thoughts and trailing sentences.
     - Technical pronunciation issues captured phonetically by Whisper.

---

## 5. Text-to-Speech (TTS) Pipeline

### Browser `speechSynthesis`
- Converts the Socratic coach's response into spoken audio.
- Filter voices to prefer natural English accents (`en-US`, `en-GB`).
- Interactive player controls in UI:
  - Play / Pause / Replay buttons on each coach message bubble.
  - Adjustable playback speed (0.8x, 1.0x, 1.25x).
  - Immediate audio stop (barge-in) when the user activates push-to-talk.

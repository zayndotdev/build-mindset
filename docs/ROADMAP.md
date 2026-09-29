# Future Roadmap & Backlog — Mindset

> Feature backlog, architectural explorations, and future enhancements tracked for post-v1.0 iterations.

---

## 1. Planned for Version 1.1 / 1.2

### A. Full Deep Dive Mode (10 Steps)
- **Status**: Deferred from v1 (Decision D-012) due to session fatigue and token budgets.
- **Goal**: Author reference key points and model answers for all 10 framework steps across all 50 topics.
- **Features**: Allow users to toggle between Quick (2 steps), Standard (4 steps), and Deep Dive (10 steps) when launching a topic.

### B. Time-Based One-Time Passwords (TOTP / MFA)
- **Status**: Planned security hardening.
- **Goal**: Add RFC 6238 TOTP authenticator app support (Google Authenticator, 1Password) on top of the Argon2id passphrase.
- **Implementation**: Stored encrypted secret in `credentials` table, QR code setup in Settings > Security.

### C. Offline Local LLM Support (Ollama / WebLLM)
- **Status**: Research prototype.
- **Goal**: Enable fully offline, airgapped coaching sessions when traveling without internet connectivity.
- **Implementation**: Connect to local Ollama instance running Llama 3.2 3B / Qwen 2.5 on host or WebLLM in browser.

---

## 2. Long-Term Explorations (v2.0+)

### A. Interactive Visual Architecture Modeling
- As the candidate articulates data models and flows, the AI coach dynamically renders interactive Mermaid diagrams or C4 architecture maps in the chat timeline.

### B. Speech & Audio Enhancements
- **In-Browser Whisper.wasm**: Completely private, client-side STT with no external API calls even on iOS Safari.
- **Custom Accent & Intonation Coaching**: Deeper prosody, pitch, and technical cadence feedback for non-native English speakers.

### C. Multi-Device Peer-to-Peer Synchronization
- Encrypted state sync across multiple personal devices (phone, laptop, tablet) over Tailscale using CRDTs or SQLite session replication.

# Active Blockers & Issue Log

> This document tracks issues that have failed after 3 attempts or require human intervention.
> Format:
> - **Issue**: Description of problem
> - **Attempts**: What was tried and resulting errors
> - **Hypotheses & Workaround**: Current hypothesis and bypass/fallback implemented

## Status
*No active code or build blockers.* All 16 test files pass (92 tests green), and native PWA build succeeds.

### Items for Human Wake-up (Non-blocking):
- **Real Hardware Voice & PWA Testing**: Automated testing validated Web Speech fallbacks and mock audio pipelines; physical microphone interaction on Android Chrome and iPhone Safari should be verified using `docs/MORNING_CHECKLIST.md`.
- **Live Provider API Keys**: Add real provider keys in Settings > Providers UI (or `.env`) to replace mock fallbacks for live AI calls.

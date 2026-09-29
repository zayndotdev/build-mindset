# Morning Verification Checklist — Mindset

> Copy-paste, step-by-step checklist for Zayn when waking up. Follow these 5 steps to verify the overnight build and take Mindset live on your phone.

---

## Step 1: Verify Git & Test Suite

Verify that all overnight code is intact on branch `overnight`:

```bash
# 1. Check git status (should be on branch 'overnight')
git status

# 2. View overnight commits
git log -10 --oneline

# 3. Run the full monorepo test suite (16 test files, 92 tests)
pnpm test
```
*Expected result: 16 passed (16), 92 passed (92), 0 failures.*

---

## Step 2: Configure Real AI Provider API Keys

During the overnight run, all AI adapters operated with mocks or local fallbacks. Now add your real free-tier keys:

### Option A: Via Settings UI (Recommended)
1. Start the server (see Step 3 below).
2. Open the app in your browser, log in, and navigate to **Settings > Providers**.
3. Enter your API keys for:
   - **Google Gemini** (Gemini 2.5 / 1.5 Flash)
   - **Groq** (Llama 3.3 70B / Whisper)
   - **Mistral** (Mistral Small)
   - **Cohere** (Command R)
4. Tap **"Test Connection"** on each provider to verify latency and connectivity.
5. Drag to set priority order (Gemini -> Groq -> Mistral -> Cohere).

### Option B: Via `.env`
Edit `/opt/mindset/.env` (or local `.env`):
```env
GEMINI_API_KEY=AIzaSy...
GROQ_API_KEY=gsk_...
MISTRAL_API_KEY=...
COHERE_API_KEY=...
```

---

## Step 3: Launch Local Server (or Deploy to Oracle VM)

### To Test Locally on your PC:
```bash
# Start local API and Web dev servers
pnpm dev
# App is accessible at: http://localhost:3000 (or http://localhost:5173 for Vite HMR)
```

### To Deploy to your Oracle Cloud Always Free VM:
Follow the step-by-step commands in [`docs/DEPLOYMENT.md`](DEPLOYMENT.md):
```bash
# On your Oracle VM:
git clone https://github.com/zayndotdev/build-mindset.git /opt/mindset
cd /opt/mindset
git checkout overnight
pnpm install
pnpm build
pnpm seed
sudo systemctl enable --now mindset
sudo tailscale serve --bg https / http://127.0.0.1:3000
```

---

## Step 4: Install PWA on Your Phone & Verify Voice

1. **Connect to Tailscale** on your Android phone (or connect to your local WiFi if testing locally).
2. Open **Chrome** and navigate to your Tailscale URL (or local IP):
   `https://mindset-coach.tailnet123.ts.net`
3. **First-Run Passphrase Setup**:
   - The app will detect that this is the first run.
   - Enter your chosen master passphrase and confirm it.
4. **Install as PWA**:
   - Tap Chrome's three-dot menu (⋮) -> **"Install App"** (or **"Add to Home Screen"**).
   - Launch Mindset from your home screen icon.
5. **Start a Quick Practice Session**:
   - Tap **"Start Session"** -> Select **"Token Bucket Rate Limiting"** -> Choose **"Quick Mode (2 Steps)"**.
   - Review the coach's initial question.
6. **Test Voice Input (Microphone)**:
   - Tap the microphone icon.
   - When Android Chrome asks for permission, tap **"Allow"**.
   - Speak your engineering answer in English.
   - Confirm that your spoken words appear in real-time in the answer preview.
   - Tap **"Submit Answer"**.
7. **Verify Streaming & Audio Playback**:
   - Confirm that the Socratic feedback streams in real-time via SSE.
   - Tap the **Audio Play** button on the coach's message bubble to verify text-to-speech.
8. **Inspect Progress Dashboard**:
   - Navigate to the **Progress** tab.
   - Check that your Skill Radar Chart and Independence Trend reflect your completed session.

---

## Step 5: Test Encrypted Backup & Restore

Verify disaster-recovery durability with a test backup:

```bash
# 1. Create an encrypted backup snapshot
pnpm tsx scripts/backup.ts backups/morning-test.mbkp

# 2. Verify that the file was created and is encrypted
ls -lh backups/morning-test.mbkp

# 3. Test restoring to a verification database
pnpm tsx scripts/restore.ts backups/morning-test.mbkp data/mindset-verify.db

# 4. Remove temporary verification database
rm data/mindset-verify.db*
```
*Expected result: "Backup verified and successfully restored to data/mindset-verify.db".*

---

## Step 6: Merge to Main (When Satisfied)

When you have completed testing on your phone and are satisfied with the release:
```bash
git checkout main
git merge overnight --ff-only
git push origin main
git tag -a v1.0.0 -m "Release v1.0.0: Mindset AI Socratic Coach"
git push origin v1.0.0
```

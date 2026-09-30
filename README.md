# Mindset — AI Socratic Engineering Coach

> A private, self-hosted AI Socratic coach designed for senior and staff software engineers to practice system design, architectural trade-offs, and technical reasoning out loud.

[![CI](https://github.com/zayndotdev/build-mindset/actions/workflows/ci.yml/badge.svg)](https://github.com/zayndotdev/build-mindset/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D24.0.0-blue.svg)](https://nodejs.org/)
[![Fastify](https://img.shields.io/badge/fastify-v5.0-black.svg)](https://fastify.dev/)
[![React](https://img.shields.io/badge/react-v18.3-61dafb.svg)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/tailwind-tokens-38bdf8.svg)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/sqlite-native%20node:sqlite-003B57.svg)](https://nodejs.org/api/sqlite.html)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## Highlights & Features

- **Socratic Pedagogical Framework**: 4-step progressive disclosure (*Problem Framing*, *Architecture & Data*, *Trade-offs & Failure Modes*, *Communication & Synthesis*) with automated hint caps (max 2 hints/step) and split evaluation (**Answer Quality** [1.0–4.0] vs. **Independence Score** [0–4]).
- **Multi-Provider AI Resilience**: Primary grading with dynamic cascade across Google Gemini (`gemini-2.5-flash` / `gemini-3.8-flash`), Groq Cloud (`llama-3.3-70b-versatile`), Mistral AI (`mistral-large-latest`), and Cohere (`command-r-plus`). Built-in circuit breakers, exponential backoff on 429 quota exhaustion, and live model discovery.
- **Voice-First & Audio Dual-Modality**: Practice out loud with browser Web Speech API, Fastify audio transcription (`/api/v1/voice/transcribe` via Groq Whisper with mock fallback), and configurable TTS playback with accent selection and speed controls.
- **Competency Radar & Socratic Independence Trends**: Interactive 5-dimension SVG Skill Radar (*Problem Framing*, *Data & Architecture*, *Tradeoff Evaluation*, *Failure Modes & Edge Cases*, *Synthesis & Communication*) paired with session-over-session hint minimization charts.
- **SM-2 Spaced Repetition**: Automatic Leitner/SM-2 review queue scheduling based on step quality and independence scores to cement architectural heuristics over time.
- **Curriculum of 50 Architecture Topics**: 4 fully verified reference rubrics (*Email + Password Auth*, *Relational Schema Design*, *RESTful API Versioning*, *RAG Architecture*) plus 46 cataloged spec roadmap topics with interactive syllabus modals.
- **Responsive Desktop & Mobile UX**: Fluid 12-column responsive layout (`max-w-7xl`), desktop navigation integrated into the top header, mobile-only bottom navigation bar (`md:hidden`), multi-column topic grids, and full pagination with page-size selectors.
- **Semantic Design Tokens**: Strict CSS custom properties in `:root` and Tailwind config (`--color-primary: #F97316`, `--color-bg: #F8FAFC`, etc.) — zero hardcoded color literals for effortless, instant re-theming.
- **Zero-Cloud Privacy & Encrypted Backups**: Single-user architecture with zero telemetry, local Node 24 native SQLite database, AES-256-GCM encrypted provider credentials, and automated authenticated backup/restore scripts.
- **Robust Security**: RFC 9106 Argon2id passphrase hashing, dummy hash timing-attack mitigation, 256-bit CSPRNG session tokens in `HttpOnly` `SameSite=Strict` cookies, and 5-attempt rate-limited lockout protection.

---

## Monorepo Architecture

```
build-mindset/
├── apps/
│   ├── api/             # Fastify 5 REST API + SSE (Node 24 native node:sqlite + Drizzle ORM)
│   │   ├── src/
│   │   │   ├── ai/          # Multi-provider router, circuit breaker, quota resting, adapters
│   │   │   ├── auth/        # Argon2id hashing, session token management, rate limiting
│   │   │   ├── config/      # Environment validation (Zod)
│   │   │   ├── db/          # Schema, migrations, SQLite connection, seeds
│   │   │   ├── learning/    # Socratic state machine, 50-topic catalog, grader, SM-2 engine
│   │   │   ├── routes/      # REST & SSE streaming endpoints
│   │   │   └── voice/       # Groq Whisper audio transcription adapter
│   │   └── tests/           # 16 test suites covering auth, crypto, AI fallbacks, SSE, voice
│   └── web/             # React 18 + Vite 5 + Tailwind CSS PWA
│       ├── src/
│       │   ├── components/  # Header, Navigation, SkillRadarChart, IndependenceTrend, ReviewQueue, SessionHistory
│       │   ├── context/     # AuthContext (first-run setup, credentials, session check)
│       │   ├── views/       # CoachView, TopicsView, ProgressView, SettingsView, ActiveSessionView, LoginView
│       │   └── index.css    # Semantic design tokens & CSS variables
├── packages/
│   └── shared/          # Shared TypeScript types, Zod schemas, AES-256-GCM crypto, backup utilities
├── docs/                # Comprehensive documentation suite
│   ├── ARCHITECTURE.md  # Core system architecture & request lifecycles
│   ├── AI_PROVIDERS.md  # Provider routing, circuit breakers, and fallback matrix
│   ├── LEARNING_ENGINE.md # 50-topic curriculum, Socratic rubrics, and SM-2 mechanics
│   ├── SECURITY.md      # Threat model, cryptographic primitives, and security audit
│   ├── API.md           # REST & SSE endpoint specifications
│   ├── DECISIONS.md     # Architectural decisions record index
│   └── adr/             # Numbered Architecture Decision Records (ADR-001 through ADR-009)
├── docker-compose.yml   # Multi-stage containerized deployment
└── Dockerfile           # Optimized distroless production container
```

---

## Prerequisites

- **Node.js**: `^24.0.0` (pinned in `.nvmrc` and `package.json` engines)
- **pnpm**: `>=9.0.0`
- **Docker & Docker Compose** (optional, for containerized execution)

---

## Quick Start (Local Development)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/zayndotdev/build-mindset.git
cd build-mindset

# Use Node 24
nvm use 24

# Install monorepo dependencies
pnpm install
```

### 2. Configure Environment

Copy the example environment configuration:

```bash
cp .env.example .env
```

Generate a secure 32-byte hexadecimal encryption key for API credentials storage:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Update `.env` with your generated key:

```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173
DATABASE_PATH=./data/mindset.db
APP_ENCRYPTION_KEY=your_generated_64_char_hex_key_here
COOKIE_SECRET=your_random_cookie_secret_at_least_32_characters_long
```

*(Optional: Set provider keys `GEMINI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, or `COHERE_API_KEY` directly in `.env`, or configure them securely via the Settings UI in the browser).*

### 3. Initialize Database

Run migrations and seed the 50 architectural curriculum topics:

```bash
pnpm --filter @mindset/api db:migrate
pnpm --filter @mindset/api db:seed
```

### 4. Start Development Servers

```bash
# Run both API and Web concurrently
pnpm dev

# Or run services individually:
pnpm dev:api    # Fastify server on http://localhost:3000
pnpm dev:web    # Vite dev server on http://localhost:5173
```

- **Frontend Web Application**: [http://localhost:5173](http://localhost:5173)
- **Backend API Server**: [http://localhost:3000](http://localhost:3000)
- **Liveness Health Endpoint**: [http://localhost:3000/healthz](http://localhost:3000/healthz)
- **Readiness Health Endpoint**: [http://localhost:3000/readyz](http://localhost:3000/readyz)

---

## Authentication & First-Run Setup

Mindset uses a single-user security model designed for self-hosting:

1. **First-Run Setup**: On initial launch, navigate to [http://localhost:5173](http://localhost:5173). The setup screen prompts you to configure your master passphrase.
2. **Argon2id Hashing**: Passphrases are hashed with RFC 9106 Argon2id (64 MB memory cost, 3 iterations, 16-byte random salt).
3. **Session Authentication**: Upon login or setup, a 256-bit cryptographically secure session cookie (`mindset_session`) is issued (`HttpOnly`, `SameSite=Strict`, `Path=/`).
4. **Lockout Protection**: Login attempts are rate-limited to 5 attempts within a rolling 15-minute window with automated lockout mitigation.

---

## Curriculum Topics & Socratic Practice

The platform includes a curated syllabus of **50 System Design Topics**:

* **4 Verified Socratic Rubrics** (Ready to practice with live multi-step dialogue, hint ladder, and model answers):
  1. `auth-email-password`: Email + Password Authentication, Argon2id, Session Tokens, and Rate Limiting
  2. `db-relational-schema`: Relational Schema Modeling, Composite Indexing, and Query Optimization
  3. `api-restful-design`: RESTful API Design, Idempotency Keys, and Standard RateLimit Headers
  4. `ai-rag`: Retrieval-Augmented Generation Architecture, Vector Embeddings, and Chunking Strategies
* **46 Spec Roadmap Topics**: Fully cataloged with learning objectives, key trade-offs, and pitfall analyses, viewable through the interactive **Syllabus Spec Modal**.
* **Browse & Filter**: Multi-filter toolbar by status (*All 50*, *Ready 4*, *Roadmap 46*), difficulty (*Beginner*, *Intermediate*, *Advanced*), category, and live search with full pagination (6, 9, 12, 24, or All per page).

---

## Design System & Theme Customization

Mindset utilizes a **Semantic Design Tokens Architecture** built on CSS custom properties:

```css
/* apps/web/src/index.css */
:root {
  --color-primary: #F97316;          /* Brand Orange Accent */
  --color-primary-hover: #EA580C;
  --color-primary-subtle: #FFF7ED;
  --color-bg: #F8FAFC;               /* Canvas Background */
  --color-surface: #FFFFFF;          /* Card Surfaces */
  --color-border: #E2E8F0;           /* Borders & Dividers */
  --color-text-primary: #0F172A;     /* Primary Typography */
  --color-text-secondary: #475569;   /* Body Typography */
}
```

* All components, badges, charts, and buttons reference Tailwind utility classes mapped to these variables (`bg-primary`, `bg-surface`, `text-text-primary`, `border-surface-border`).
* Retheming the application requires modifying only the CSS custom properties in [index.css](file:///c:/Users/hp-new/Desktop/build-mindset/apps/web/src/index.css) — zero hardcoded literals across view files.

---

## Testing & Verification

Mindset utilizes **Vitest** for fast unit, cryptographic, and integration testing:

```bash
# Run all tests across monorepo packages (93 tests across 16 suites)
pnpm test

# Run tests with coverage report
pnpm test:coverage

# Build web application bundle
pnpm --filter @mindset/web build
```

### Test Coverage Highlights:
- **AES-256-GCM Encryption**: Verified ciphertext authentication, key rotation, tampered tag detection, and zero plaintext exposure.
- **Argon2id Passphrase Verification**: Proven 16-byte random salts, timing-attack mitigation via dummy hashes, and session invalidation.
- **AI Multi-Provider Failover**: Simulated 429 quota exhaustion, circuit breaker state transitions (CLOSED $\to$ OPEN $\to$ HALF_OPEN), and fallback cascade.
- **Socratic State Machine & Hints**: Hard caps at 2 hints/step, step skip penalties, Answer Quality vs. Independence score calculation, and SM-2 interval scheduling.
- **Audio & Voice Pipeline**: WebM audio payload ingestion, base64 transcription parsing, and session transcript persistence.

---

## Running with Docker Compose

To deploy the production stack (API + Web PWA) in a containerized environment:

```bash
# Build the production image
docker compose build

# Start the service in the background
docker compose up -d

# Verify health status
curl http://localhost:3000/healthz
```

---

## License

MIT © [Zayn](https://github.com/zayndotdev)

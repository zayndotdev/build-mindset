# Mindset — AI Socratic Engineering Coach

> A private, self-hosted AI Socratic coach designed for senior engineers and engineering leaders to practice system design, architectural tradeoffs, and technical reasoning out loud.

[![CI](https://github.com/zayndotdev/build-mindset/actions/workflows/ci.yml/badge.svg)](https://github.com/zayndotdev/build-mindset/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D24.0.0-blue.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## Highlights

- **Socratic Pedagogical Framework**: 4-step progressive disclosure (Problem Framing, Architecture & Data, Tradeoffs & Failure Modes, Communication & Synthesis) with automated hint caps and split evaluation (Answer Quality vs. Independence Score).
- **Multi-Provider AI Resilience**: Primary grading with dynamic fallback across Google Gemini, Groq, Mistral, and Cohere. Built-in circuit breakers, quota-aware resting, and live model discovery.
- **Privacy & Zero-Leakage Architecture**: Single-user application with zero cloud telemetry, local SQLite database, and AES-256-GCM encrypted provider credentials.
- **Modern Security**: RFC 9106 Argon2id passphrase hashing, dummy hash timing-attack mitigation, 256-bit CSPRNG session tokens in `HttpOnly` `SameSite=Strict` cookies, and rate-limited lockout protection.
- **Offline-First PWA**: Installable progressive web application with responsive dark-mode aesthetics, voice recording & transcription integration, and SM-2 spaced repetition review queues.

---

## Monorepo Architecture

```
build-mindset/
├── apps/
│   ├── api/             # Fastify 5 REST API + SSE (Node 24 native node:sqlite + Drizzle ORM)
│   └── web/             # React 18 + Vite 5 + Tailwind CSS PWA
├── packages/
│   └── shared/          # Shared TypeScript types, Zod schemas, crypto utilities
├── docs/                # Architecture docs, decisions log, API specs, and ADRs
│   ├── ARCHITECTURE.md  # Core system architecture & lifecycle
│   ├── DECISIONS.md     # Architectural decisions record index
│   ├── API.md           # REST & SSE endpoint specifications
│   └── adr/             # Numbered Architecture Decision Records (ADR-001 through ADR-008)
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

Generate a secure 32-byte hexadecimal encryption key for API keys storage:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Update `.env` with your generated key:

```env
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:5173
DATABASE_PATH=./data/mindset.db
APP_ENCRYPTION_KEY=your_generated_64_char_hex_key_here
COOKIE_SECRET=your_random_cookie_secret_at_least_32_characters_long
```

*(Optional: Set `APP_PASSPHRASE=your_master_passphrase` to automatically seed credentials on startup, or complete setup in the browser UI).*

### 3. Initialize Database

Run migrations and seed the initial foundational system design curriculum topics:

```bash
pnpm --filter @mindset/api db:migrate
pnpm --filter @mindset/api db:seed
```

### 4. Start Development Servers

```bash
pnpm dev
```

- **Frontend Web PWA**: [http://localhost:5173](http://localhost:5173)
- **Backend API Server**: [http://localhost:3001](http://localhost:3001)
- **Liveness Health Endpoint**: [http://localhost:3001/healthz](http://localhost:3001/healthz)

---

## First-Run Passphrase Setup

Mindset uses a single-user security model designed for self-hosting:

1. **Initial Visit**: Navigate to [http://localhost:5173](http://localhost:5173). If no master passphrase has been configured, the application automatically displays the **First-Run Setup** screen.
2. **Passphrase Creation**: Enter a secure passphrase (minimum 8 characters).
3. **Argon2id Hashing**: The backend hashes your passphrase using Argon2id with 64 MB memory cost, 3 iterations, and a cryptographically secure 16-byte random salt.
4. **Instant Unlock**: Upon successful creation, the server issues a 256-bit secure session cookie, and the full coaching workspace is unlocked.
5. **Conflict Protection**: Any subsequent calls to `/api/v1/auth/setup` are rejected with `409 Conflict`.

---

## Running with Docker Compose

To run the complete production stack (Web PWA + Fastify API) in a unified container:

```bash
# Build the production image
docker compose build

# Start the service in the background
docker compose up -d

# Verify health status
curl http://localhost:3000/healthz
```

Expected `/healthz` response:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2026-09-29T03:30:00.000Z",
  "uptime": 12.34
}
```

Stop the container:
```bash
docker compose down
```

---

## Running Tests

Mindset uses **Vitest** for fast unit, cryptographic, and integration testing:

```bash
# Run all tests across shared packages and applications
pnpm test

# Run tests in a specific package
pnpm --filter @mindset/shared test
pnpm --filter @mindset/api test
```

### What is Tested:
- **Cryptographic Primitives**: AES-256-GCM authenticated encryption/decryption, tampered ciphertext detection, key rotation, and IV uniqueness.
- **Argon2id Passphrase Security**: RFC 9106 Modular Crypt Format verification, unique random salt generation per hash, timing-attack protection via dummy hashes.
- **Database Consistency & Transactions**: SQLite proxy queries, foreign key constraints, session token lifecycles, and transaction rollback verification.
- **API Security & Routes**: CORS allow-list enforcement, 5-attempt rate-limiting lockout protection, authenticated session cookies, and health endpoints.

---

## CI & Security Hardening

Every pull request and push to `main` executes GitHub Actions workflows that verify:
1. **Node 24 Environment**: Builds `@mindset/shared`, `@mindset/api`, and `@mindset/web`.
2. **Automated Test Matrix**: 100% passing rate across all unit and integration tests.
3. **Gitleaks Secret Scanning**: Automated secret scanning to guarantee zero API keys or credentials enter version control.

---

## License

MIT © [Zayn](https://github.com/zayndotdev)

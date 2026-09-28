# ADR-001: Server Framework — Fastify

**Status:** Accepted
**Date:** 2026-09-29
**Deciders:** Phase 0 design review

## Context

The spec allows Fastify or Hono (decide via ADR). Both are modern, fast
Node.js HTTP frameworks with TypeScript support.

## Options Considered

### Option A: Fastify
- Mature plugin ecosystem: `@fastify/helmet`, `@fastify/rate-limit`,
  `@fastify/cookie`, `@fastify/cors`, `@fastify/sse` (or `@fastify/eventsource`)
- Built-in schema-based validation (integrates well with Zod via `fastify-type-provider-zod`)
- First-class pino logging (structured, fast)
- Encapsulation model (plugin scoping prevents leaky middleware)
- Large community, battle-tested in production Node.js servers
- Excellent for long-lived server processes

### Option B: Hono
- Ultra-fast, tiny runtime
- Designed for edge/serverless (Cloudflare Workers, Deno, Bun)
- Middleware ecosystem is growing but smaller
- Less mature Node.js-specific tooling
- SSE and streaming support exists but less documented for Node.js

## Decision

**Fastify.** We are deploying to a dedicated VM (Oracle Cloud), not edge/serverless.
Fastify's mature plugin ecosystem, built-in validation, pino integration, and
encapsulated plugin model are a better fit. The SSE streaming support, security
plugins (helmet, CORS, rate-limit), and cookie-based session handling are
production-ready and well-documented.

## Consequences

- ✅ Rich plugin ecosystem reduces custom code
- ✅ Schema validation pairs naturally with our Zod-first approach
- ✅ Structured logging via pino is built in
- ⚠️ Slightly larger dependency tree than Hono
- ⚠️ Not portable to edge runtimes if we ever wanted that (unlikely for this app)

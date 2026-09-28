# ADR-002: Database — SQLite (WAL mode) + Drizzle ORM

**Status:** Accepted
**Date:** 2026-09-29
**Deciders:** Phase 0 design review

## Context

The spec requires SQLite with WAL mode via Drizzle ORM, behind a repository
interface so a PostgreSQL swap is a config change.

## Options Considered

### Option A: SQLite + Drizzle (chosen)
- Zero-ops: no database server process, single file on disk
- WAL mode enables concurrent reads with writes
- Drizzle ORM: type-safe queries, migrations, supports both SQLite and PostgreSQL
- Repository pattern abstracts the ORM, making DB swap possible
- Perfect for single-user app on a VM with persistent block storage

### Option B: PostgreSQL + Drizzle
- Overkill for a single-user app
- Requires a database server process (memory, ops overhead)
- Free-tier managed PostgreSQL exists (Supabase, Neon) but adds external dependency
- Better for multi-user scaling but that's a non-goal

## Decision

**SQLite (WAL mode) + Drizzle ORM.** Single-user app doesn't need PostgreSQL.
SQLite is simpler to deploy, backup (copy file), and operate. Drizzle supports
both dialects, so migration to PostgreSQL is a schema + config change, not a
rewrite.

## Migration Path to PostgreSQL (documented)

1. Change `drizzle.config.ts` driver from `better-sqlite3` to `node-postgres`
2. Update repository implementations to use PG-compatible types
3. Run `drizzle-kit push` to generate PG migrations
4. Export data with the backup script, import into PG
5. Update connection config in `.env`

## Consequences

- ✅ Zero operational overhead
- ✅ Backup = encrypted copy of a single file
- ✅ Fast reads for a single-user workload
- ✅ Drizzle provides future PostgreSQL path
- ⚠️ No concurrent write scaling (irrelevant for single-user)
- ⚠️ Must handle SQLite-specific quirks (no native JSONB, limited ALTER TABLE)

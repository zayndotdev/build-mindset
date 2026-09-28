# ADR-007: Monorepo Tooling — pnpm + Turborepo

**Status:** Accepted
**Date:** 2026-09-29
**Deciders:** Phase 0 design review

## Context

The spec requires a pnpm workspace monorepo. Need a task orchestrator for
build, test, lint across packages.

## Options Considered

### Option A: pnpm workspaces + Turborepo (chosen)
- pnpm: fast, disk-efficient, strict dependency resolution
- Turborepo: fast task runner with caching, simple config (`turbo.json`)
- Both are well-maintained and widely adopted

### Option B: pnpm workspaces + Nx
- More powerful but heavier
- Plugin system is overkill for our 5-package monorepo
- Steeper learning curve

### Option C: pnpm workspaces alone (no orchestrator)
- Manual `--filter` commands for each package
- No caching, no parallelization of independent tasks
- Slow CI

## Decision

**pnpm + Turborepo.** Simple, fast, cacheable. `turbo.json` defines the
task dependency graph:

```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["build"] },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

## Consequences

- ✅ Fast builds with local + remote caching
- ✅ Parallel execution of independent tasks
- ✅ Simple configuration
- ✅ pnpm's strict mode catches phantom dependencies
- ⚠️ One more tool to install (minimal overhead)

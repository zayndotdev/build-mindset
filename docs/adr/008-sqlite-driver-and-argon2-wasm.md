# ADR-008: Native node:sqlite Driver & WebAssembly Argon2id

**Status:** Accepted  
**Date:** 2026-09-29  
**Deciders:** Core Engineering Team

---

## Context

During Phase 1 implementation, traditional native C++ addons (`better-sqlite3` and `@node-rs/argon2`) exhibited critical cross-platform portability friction:
1. `better-sqlite3` requires local C++ compilation via `node-gyp` or prebuilt platform binaries that fail when host build tools (Visual Studio C++ build tools or Python) are missing on developer machines.
2. `@node-rs/argon2` and `@libsql/client` distribute prebuilt `.node` addons dynamically linked to the Microsoft Visual C++ runtime (`vcruntime140.dll`), failing with runtime module resolution errors when the redistributable is absent.
3. Node.js 24 introduces native SQLite support via the built-in `node:sqlite` module (`DatabaseSync`), offering native SQLite execution compiled directly into the Node binary.

---

## Options Considered

### Option A: Enforce native C++ toolchain + pnpm `onlyBuiltDependencies`
- Requires developers to install Visual Studio C++ build tools, Python, and MSVC runtime redistributables.
- CI and Docker images must install `build-essential`, `python3`, and make tools, bloating container size and build times.
- Ongoing risk of binary incompatibility across Node minor releases.

### Option B: Node 24 `node:sqlite` (`DatabaseSync`) + WebAssembly `hash-wasm` (Chosen)
- **Database Driver:** Utilize Node 24's native `node:sqlite` `DatabaseSync` integrated with Drizzle ORM via `drizzle-orm/sqlite-proxy`.
- **Zero Native Build Toolchain:** Eliminates `node-gyp`, compiler toolchains, and MSVC runtime DLL requirements.
- **Identical SQLite Features:** Provides full native SQLite performance, in-memory execution (`:memory:`), Write-Ahead Logging (`PRAGMA journal_mode = WAL`), foreign key integrity (`PRAGMA foreign_keys = ON`), and busy lock timeouts (`PRAGMA busy_timeout = 5000`).
- **Argon2id via WebAssembly:** Uses `hash-wasm` (compiling the reference Argon2 C implementation to WASM), providing RFC 9106 / OWASP compliant modular crypt format (`$argon2id$v=19$...`), identical work factors, and constant-time comparison across any OS and CPU architecture.

---

## Decision

Adopt **Node 24 native `node:sqlite` with `drizzle-orm/sqlite-proxy`** for database persistence and **`hash-wasm`** for Argon2id hashing.

Pin Node.js to `^24.0.0` in:
- `.nvmrc`
- Root `package.json` `engines.node`
- CI workflows and Dockerfiles

---

## Consequences

- ✅ **Zero Native Compilation:** Clean installs succeed instantly on Windows, macOS, and Linux without compiler toolchains.
- ✅ **Deterministic Portability:** WebAssembly guarantees byte-for-byte identical Argon2id hashing across dev, CI, and production Docker.
- ✅ **Native SQLite Speed:** `node:sqlite` runs compiled C SQLite directly within Node 24 runtime with zero overhead.
- ✅ **Container Efficiency:** Slim Docker images without Python or C++ build dependencies.
- ⚠️ **Node 24 Required:** Runtime requires Node.js >= 24.0.0 (enforced via `package.json` engines and CI).

import { drizzle, SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NativeSqlite = any;
import * as schema from './schema';
import fs from 'node:fs';
import path from 'node:path';
import { getEnv } from '../config/env';

export type AppDatabase = SqliteRemoteDatabase<typeof schema> & {
  $client: NativeSqlite;
};

function resolveDatabasePath(rawPath: string): string {
  if (rawPath === ':memory:' || rawPath.startsWith(':memory:')) {
    return rawPath;
  }
  const cleanPath = rawPath.replace(/^file:/, '');
  if (path.isAbsolute(cleanPath)) {
    return cleanPath;
  }

  // Find monorepo root
  let curr = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(curr, 'pnpm-workspace.yaml')) || fs.existsSync(path.join(curr, '.git'))) {
      return path.resolve(curr, cleanPath);
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return path.resolve(process.cwd(), cleanPath);
}

export function createDbClient(dbPath?: string): AppDatabase {
  const rawPath = dbPath ?? getEnv().DATABASE_URL;
  const resolvedPath = resolveDatabasePath(rawPath);

  let sqlite: NativeSqlite;

  if (resolvedPath === ':memory:' || resolvedPath.startsWith(':memory:')) {
    sqlite = new DatabaseSync(':memory:');
  } else {
    // Ensure parent directory exists for file-based database
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    sqlite = new DatabaseSync(resolvedPath);
  }

  // WAL mode for concurrency, busy timeout, and enforce foreign keys
  sqlite.exec('PRAGMA foreign_keys = ON;');
  if (resolvedPath !== ':memory:' && !resolvedPath.startsWith(':memory:')) {
    sqlite.exec('PRAGMA journal_mode = WAL;');
    sqlite.exec('PRAGMA busy_timeout = 5000;');
  }

  const db = drizzle(
    async (sql, params, method) => {
      try {
        const stmt = sqlite.prepare(sql);
        if (method === 'run') {
          stmt.run(...params);
          return { rows: [] };
        }
        stmt.setReturnArrays(true);
        if (method === 'get') {
          const row = stmt.get(...params);
          return { rows: row ? (row as unknown[]) : [] };
        }
        const rows = stmt.all(...params);
        return { rows: rows as unknown[][] };
      } catch (err: unknown) {
        const error = err as Error;
        console.error('SQLite execution error:', error.message, 'SQL:', sql, 'params:', params);
        throw error;
      }
    },
    { schema }
  ) as AppDatabase;

  // Expose underlying native SQLite client for DDL, seeds, and pragmas
  db.$client = sqlite;

  return db;
}

let dbInstance: AppDatabase | null = null;

export function getDb(): AppDatabase {
  if (!dbInstance) {
    dbInstance = createDbClient();
  }
  return dbInstance;
}

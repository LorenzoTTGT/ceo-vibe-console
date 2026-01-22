import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import { existsSync, mkdirSync } from "fs";

// Database file location
const DATA_DIR = process.env.DATA_DIR || "./data";
const DB_PATH = path.join(DATA_DIR, "vibe.db");

let _db: BetterSQLite3Database<typeof schema> | null = null;

function initDb() {
  if (_db) return _db;

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Create database connection
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");

  // Initialize tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      github_id TEXT NOT NULL UNIQUE,
      email TEXT,
      name TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      owner TEXT NOT NULL,
      full_name TEXT NOT NULL,
      default_branch TEXT NOT NULL,
      cloned_at INTEGER DEFAULT (unixepoch()),
      last_used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS env_vars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_repos_user_id ON repos(user_id);
    CREATE INDEX IF NOT EXISTS idx_env_vars_repo_id ON env_vars(repo_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_repos_user_name ON repos(user_id, name);
  `);

  _db = drizzle(sqlite, { schema });
  return _db;
}

// Export a getter function instead of the db directly
export function getDb() {
  return initDb();
}

export { schema };

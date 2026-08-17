import type { Database } from "better-sqlite3";
import { getDb } from "./connection.js";
import type { PrScannerConfig } from "../../config/schema.js";

/**
 * Run database migrations to ensure all tables exist.
 * Uses CREATE TABLE IF NOT EXISTS for idempotency.
 */
export function runMigrations(config: PrScannerConfig): void {
  const db = getDb(config);

  // Get the raw SQLite connection for raw SQL execution
  const sqlite = (db as any).$client as Database;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS repositories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL,
      last_scanned_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pull_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER REFERENCES repositories(id),
      pull_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      state TEXT NOT NULL,
      merged INTEGER NOT NULL,
      merged_at TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      author_login TEXT NOT NULL,
      merged_by_login TEXT,
      base_ref TEXT NOT NULL,
      head_ref TEXT NOT NULL,
      labels TEXT,
      draft INTEGER NOT NULL,
      changed_files INTEGER NOT NULL,
      additions INTEGER NOT NULL,
      deletions INTEGER NOT NULL,
      merge_commit_sha TEXT,
      raw_json TEXT,
      raw_json_fetched_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_pull_requests_repo_number
      ON pull_requests(repo_id, pull_number);

    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pull_request_id INTEGER REFERENCES pull_requests(id),
      scan_id TEXT NOT NULL,
      evaluator_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      score REAL NOT NULL,
      metadata TEXT,
      evaluated_at TEXT NOT NULL,
      ai_model TEXT,
      ai_tokens_used INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_evaluations_scan
      ON evaluations(scan_id);

    CREATE TABLE IF NOT EXISTS scan_runs (
      id TEXT PRIMARY KEY,
      batch_id TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      repository_id INTEGER REFERENCES repositories(id),
      total_pull_requests INTEGER NOT NULL,
      evaluated_count INTEGER NOT NULL,
      average_score REAL,
      config_hash TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      error_message TEXT,
      progress_total INTEGER NOT NULL DEFAULT 0,
      progress_completed INTEGER NOT NULL DEFAULT 0,
      current_phase TEXT NOT NULL DEFAULT 'finalizing'
    );

    CREATE TABLE IF NOT EXISTS scan_batches (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      total_repositories INTEGER NOT NULL,
      completed_repositories INTEGER NOT NULL DEFAULT 0,
      failed_repositories INTEGER NOT NULL DEFAULT 0,
      total_pull_requests INTEGER NOT NULL DEFAULT 0,
      evaluated_count INTEGER NOT NULL DEFAULT 0,
      average_score REAL,
      current_phase TEXT,
      last_error TEXT,
      config_hash TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_scan_batches_started ON scan_batches(started_at);
  `);

  ensureColumn(sqlite, "scan_runs", "batch_id", "TEXT");
  ensureColumn(sqlite, "scan_runs", "status", "TEXT NOT NULL DEFAULT 'completed'");
  ensureColumn(sqlite, "scan_runs", "error_message", "TEXT");
  ensureColumn(sqlite, "scan_runs", "progress_total", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(sqlite, "scan_runs", "progress_completed", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(sqlite, "scan_runs", "current_phase", "TEXT NOT NULL DEFAULT 'finalizing'");

  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_scan_runs_batch ON scan_runs(batch_id)");

  sqlite.exec(`
    UPDATE scan_runs
    SET status = CASE WHEN completed_at IS NULL THEN 'running' ELSE 'completed' END
    WHERE status IS NULL OR status = '' OR (batch_id IS NULL AND completed_at IS NULL);

    UPDATE scan_runs
    SET progress_total = total_pull_requests,
        progress_completed = evaluated_count
    WHERE progress_total = 0 AND total_pull_requests > 0;
  `);
}

function ensureColumn(
  sqlite: Database,
  tableName: string,
  columnName: string,
  definition: string,
): void {
  const columns = sqlite
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === columnName)) {
    sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

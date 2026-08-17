import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import type { PrScannerConfig } from "../../config/schema.js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqliteInstance: Database.Database | null = null;

/**
 * Get or create the SQLite database connection.
 * Uses a singleton pattern to ensure only one connection exists.
 */
export function getDb(config: PrScannerConfig): ReturnType<typeof drizzle<typeof schema>> {
  if (dbInstance) {
    return dbInstance as ReturnType<typeof drizzle<typeof schema>>;
  }

  const dbPath = config.cache.dbPath;
  const dir = dirname(dbPath);
  if (dir !== ".") {
    mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  sqliteInstance = sqlite;
  dbInstance = drizzle(sqlite, { schema });

  return dbInstance as ReturnType<typeof drizzle<typeof schema>>;
}

/**
 * Close the database connection.
 */
export function closeDb(): void {
  sqliteInstance?.close();
  sqliteInstance = null;
  dbInstance = null;
}

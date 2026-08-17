import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { DEFAULT_CONFIG } from "../../../config/defaults.js";
import type { PrScannerConfig } from "../../../config/schema.js";
import { runMigrations } from "../../../data/db/migrate.js";
import { closeDb } from "../../../data/db/connection.js";
import { ScanResultRepository } from "../../../data/repositories/scan-result.repository.js";
import { RepositoryRepository } from "../../../data/repositories/repository.repository.js";

const tempDirectories: string[] = [];

function createConfig(): PrScannerConfig {
  const directory = mkdtempSync(join(tmpdir(), "pr-scanner-dashboard-"));
  tempDirectories.push(directory);
  return {
    ...DEFAULT_CONFIG,
    repositories: [{ name: "owner/repo" }],
    cache: { ...DEFAULT_CONFIG.cache, dbPath: join(directory, "scanner.db") },
  } as PrScannerConfig;
}

afterEach(() => {
  closeDb();
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("ScanResultRepository", () => {
  it("aggregates completed child runs into a completed batch", () => {
    const config = createConfig();
    runMigrations(config);
    const repository = new ScanResultRepository(config);
    const repositoryId = new RepositoryRepository(config).upsert("owner/repo", "github.com");

    repository.createBatch("batch-1", 2, "hash");
    repository.create("run-1", repositoryId, "hash", "batch-1");
    repository.create("run-2", repositoryId, "hash", "batch-1");
    repository.update("run-1", 2, 2, 2);
    repository.update("run-2", 4, 4, 1);
    repository.finalizeBatch("batch-1");

    const batch = repository.findBatchById("batch-1");
    expect(batch?.status).toBe("completed");
    expect(batch?.completedRepositories).toBe(2);
    expect(batch?.failedRepositories).toBe(0);
    expect(batch?.totalPullRequests).toBe(6);
    expect(batch?.evaluatedCount).toBe(6);
    expect(batch?.averageScore).toBe(4 / 3);
  });

  it("marks a batch partial when one repository fails", () => {
    const config = createConfig();
    runMigrations(config);
    const repository = new ScanResultRepository(config);
    const repositoryId = new RepositoryRepository(config).upsert("owner/repo", "github.com");

    repository.createBatch("batch-2", 2, "hash");
    repository.create("run-1", repositoryId, "hash", "batch-2");
    repository.create("run-2", repositoryId, "hash", "batch-2");
    repository.update("run-1", 3, 3, 2);
    repository.fail("run-2", "GitHub unavailable", "fetching");
    repository.finalizeBatch("batch-2");

    const batch = repository.findBatchById("batch-2");
    expect(batch?.status).toBe("partial");
    expect(batch?.completedRepositories).toBe(1);
    expect(batch?.failedRepositories).toBe(1);
    expect(batch?.lastError).toBe("GitHub unavailable");
  });

  it("keeps progress and marks all-failed batches as failed", () => {
    const config = createConfig();
    runMigrations(config);
    const repository = new ScanResultRepository(config);
    const repositoryId = new RepositoryRepository(config).upsert("owner/repo", "github.com");

    repository.createBatch("batch-3", 1, "hash");
    repository.create("run-1", repositoryId, "hash", "batch-3");
    repository.updateProgress("run-1", 10, 4, "evaluating");
    repository.fail("run-1", "Evaluation failed", "evaluating");
    repository.finalizeBatch("batch-3");

    const run = repository.findById("run-1");
    const batch = repository.findBatchById("batch-3");
    expect(run?.progressTotal).toBe(10);
    expect(run?.progressCompleted).toBe(4);
    expect(batch?.status).toBe("failed");
    expect(batch?.evaluatedCount).toBe(4);
  });

  it("upgrades a legacy scan_runs table without losing existing records", () => {
    const config = createConfig();
    const legacy = new Database(config.cache.dbPath);
    legacy.exec(`
      CREATE TABLE scan_runs (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        repository_id INTEGER,
        total_pull_requests INTEGER NOT NULL,
        evaluated_count INTEGER NOT NULL,
        average_score REAL,
        config_hash TEXT
      );
      INSERT INTO scan_runs (id, started_at, total_pull_requests, evaluated_count)
      VALUES ('legacy-run', '2026-08-18T00:00:00.000Z', 2, 1);
    `);
    legacy.close();

    runMigrations(config);
    const run = new ScanResultRepository(config).findById("legacy-run");

    expect(run?.status).toBe("running");
    expect(run?.progressTotal).toBe(2);
    expect(run?.progressCompleted).toBe(1);
  });
});

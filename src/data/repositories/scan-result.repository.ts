import { desc, eq } from "drizzle-orm";
import { getDb } from "../db/connection.js";
import { scanBatches, scanRuns } from "../db/schema.js";
import type { PrScannerConfig } from "../../config/schema.js";
import type { ScanPhase, ScanStatus } from "../db/schema.js";

export class ScanResultRepository {
  constructor(private config: PrScannerConfig) {}

  /** Create a batch for one CLI invocation. */
  createBatch(batchId: string, totalRepositories: number, configHash: string): void {
    const db = getDb(this.config);
    db.insert(scanBatches)
      .values({
        id: batchId,
        startedAt: new Date().toISOString(),
        status: "running",
        totalRepositories,
        configHash,
        currentPhase: "connecting",
      })
      .run();
  }

  /** Create a repository-level scan run linked to a batch. */
  create(scanId: string, repositoryId: number, configHash: string, batchId?: string): void {
    const db = getDb(this.config);
    db.insert(scanRuns)
      .values({
        id: scanId,
        batchId: batchId ?? null,
        startedAt: new Date().toISOString(),
        repositoryId,
        totalPullRequests: 0,
        evaluatedCount: 0,
        configHash,
        status: "running",
        progressTotal: 0,
        progressCompleted: 0,
        currentPhase: "connecting",
      })
      .run();
  }

  /** Update live progress for one repository-level run. */
  updateProgress(
    scanId: string,
    progressTotal: number,
    progressCompleted: number,
    currentPhase: ScanPhase,
  ): void {
    const db = getDb(this.config);
    db.update(scanRuns)
      .set({
        totalPullRequests: progressTotal,
        evaluatedCount: progressCompleted,
        progressTotal,
        progressCompleted,
        currentPhase,
      })
      .where(eq(scanRuns.id, scanId))
      .run();
  }

  /** Mark a repository-level scan run as completed. */
  update(
    scanId: string,
    totalPullRequests: number,
    evaluatedCount: number,
    averageScore: number,
  ): void {
    const db = getDb(this.config);
    db.update(scanRuns)
      .set({
        completedAt: new Date().toISOString(),
        totalPullRequests,
        evaluatedCount,
        averageScore,
        status: "completed",
        progressTotal: totalPullRequests,
        progressCompleted: evaluatedCount,
        currentPhase: "finalizing",
        errorMessage: null,
      })
      .where(eq(scanRuns.id, scanId))
      .run();
  }

  /** Mark a repository-level run as failed while retaining its partial progress. */
  fail(scanId: string, errorMessage: string, currentPhase: ScanPhase): void {
    const db = getDb(this.config);
    db.update(scanRuns)
      .set({
        completedAt: new Date().toISOString(),
        status: "failed",
        errorMessage,
        currentPhase,
      })
      .where(eq(scanRuns.id, scanId))
      .run();
  }

  /** Aggregate child runs into the final batch state. */
  finalizeBatch(batchId: string): void {
    const db = getDb(this.config);
    const runs = db.select().from(scanRuns).where(eq(scanRuns.batchId, batchId)).all();

    const completedRepositories = runs.filter((run) => run.status === "completed").length;
    const failedRepositories = runs.filter((run) => run.status === "failed").length;
    const totalPullRequests = runs.reduce((sum, run) => sum + run.totalPullRequests, 0);
    const evaluatedCount = runs.reduce((sum, run) => sum + run.evaluatedCount, 0);
    const weightedScore = runs.reduce(
      (sum, run) => sum + (run.averageScore ?? 0) * run.evaluatedCount,
      0,
    );
    const status: ScanStatus =
      completedRepositories === runs.length && failedRepositories === 0
        ? "completed"
        : completedRepositories > 0
          ? "partial"
          : "failed";
    const lastError = runs.find((run) => run.errorMessage)?.errorMessage ?? null;

    db.update(scanBatches)
      .set({
        completedAt: new Date().toISOString(),
        status,
        completedRepositories,
        failedRepositories,
        totalPullRequests,
        evaluatedCount,
        averageScore: evaluatedCount > 0 ? weightedScore / evaluatedCount : null,
        currentPhase: "finalizing",
        lastError,
      })
      .where(eq(scanBatches.id, batchId))
      .run();
  }

  findBatchById(batchId: string) {
    const db = getDb(this.config);
    return db.select().from(scanBatches).where(eq(scanBatches.id, batchId)).get();
  }

  findById(scanId: string) {
    const db = getDb(this.config);
    return db.select().from(scanRuns).where(eq(scanRuns.id, scanId)).get();
  }

  listRunsByBatch(batchId: string) {
    const db = getDb(this.config);
    return db
      .select()
      .from(scanRuns)
      .where(eq(scanRuns.batchId, batchId))
      .orderBy(desc(scanRuns.startedAt))
      .all();
  }

  listRecent(limit = 10) {
    const db = getDb(this.config);
    return db.select().from(scanBatches).orderBy(desc(scanBatches.startedAt)).limit(limit).all();
  }

  listRecentRuns(limit = 10) {
    const db = getDb(this.config);
    return db.select().from(scanRuns).orderBy(desc(scanRuns.startedAt)).limit(limit).all();
  }
}

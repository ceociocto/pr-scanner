import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { getDb } from "../data/db/connection.js";
import {
  evaluations,
  pullRequests,
  repositories,
  scanBatches,
  scanRuns,
} from "../data/db/schema.js";
import type { PrScannerConfig } from "../config/schema.js";

export interface DashboardBatchRecord {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: "running" | "completed" | "partial" | "failed";
  totalRepositories: number;
  completedRepositories: number;
  failedRepositories: number;
  totalPullRequests: number;
  evaluatedCount: number;
  averageScore: number | null;
  currentPhase: "connecting" | "fetching" | "evaluating" | "finalizing" | null;
  lastError: string | null;
  configHash: string | null;
  runIds: string[];
}

export type DashboardRunRecord = ReturnType<DashboardRepository["listRunsByBatch"]>[number];

export interface DashboardEvaluationRow {
  scanId: string;
  pullRequestId: number | null;
  evaluatorId: string;
  severity: string;
  message: string;
  score: number;
  metadata: string | null;
  evaluatedAt: string;
  aiModel: string | null;
  aiTokensUsed: number | null;
  repository: string | null;
  pullNumber: number | null;
  pullTitle: string | null;
  author: string | null;
  mergedAt: string | null;
  createdAt: string | null;
  changedFiles: number | null;
  additions: number | null;
  deletions: number | null;
}

export class DashboardRepository {
  constructor(private readonly config: PrScannerConfig) {}

  listRepositories() {
    const db = getDb(this.config);
    return db.select().from(repositories).orderBy(repositories.fullName).all();
  }

  listBatches(since?: string): DashboardBatchRecord[] {
    const db = getDb(this.config);
    const currentRows = since
      ? db
          .select()
          .from(scanBatches)
          .where(gte(scanBatches.startedAt, since))
          .orderBy(desc(scanBatches.startedAt))
          .all()
      : db.select().from(scanBatches).orderBy(desc(scanBatches.startedAt)).all();

    const batches = currentRows.map((row) => this.toBatchRecord(row, this.listRunsByBatch(row.id)));

    // Before scan_batches existed, each scan_runs row represented one complete scan.
    // Expose those rows as synthetic batches so existing databases remain readable.
    const legacyRuns = db
      .select()
      .from(scanRuns)
      .where(
        since
          ? and(isNull(scanRuns.batchId), gte(scanRuns.startedAt, since))
          : isNull(scanRuns.batchId),
      )
      .orderBy(desc(scanRuns.startedAt))
      .all();

    return [...batches, ...legacyRuns.map((run) => this.toLegacyBatch(run))].sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt),
    );
  }

  findBatch(batchId: string): DashboardBatchRecord | null {
    const db = getDb(this.config);
    const batch = db.select().from(scanBatches).where(eq(scanBatches.id, batchId)).get();
    if (batch) return this.toBatchRecord(batch, this.listRunsByBatch(batch.id));

    const legacyRun = db.select().from(scanRuns).where(eq(scanRuns.id, batchId)).get();
    return legacyRun ? this.toLegacyBatch(legacyRun) : null;
  }

  listRunsByBatch(batchId: string) {
    const db = getDb(this.config);
    const runs = db
      .select({
        run: scanRuns,
        repository: repositories.fullName,
      })
      .from(scanRuns)
      .leftJoin(repositories, eq(scanRuns.repositoryId, repositories.id))
      .where(eq(scanRuns.batchId, batchId))
      .orderBy(desc(scanRuns.startedAt))
      .all()
      .map(({ run, repository }) => ({ ...run, repository }));

    if (runs.length > 0) return runs;

    const legacyRun = db
      .select({
        run: scanRuns,
        repository: repositories.fullName,
      })
      .from(scanRuns)
      .leftJoin(repositories, eq(scanRuns.repositoryId, repositories.id))
      .where(eq(scanRuns.id, batchId))
      .get();

    return legacyRun ? [{ ...legacyRun.run, repository: legacyRun.repository }] : [];
  }

  listEvaluations(scanIds: string[]): DashboardEvaluationRow[] {
    if (scanIds.length === 0) return [];
    const db = getDb(this.config);
    return db
      .select({
        evaluation: evaluations,
        pullRequest: pullRequests,
        repository: repositories.fullName,
      })
      .from(evaluations)
      .leftJoin(pullRequests, eq(evaluations.pullRequestId, pullRequests.id))
      .leftJoin(repositories, eq(pullRequests.repoId, repositories.id))
      .where(inArray(evaluations.scanId, scanIds))
      .all()
      .map(({ evaluation, pullRequest, repository }) => ({
        scanId: evaluation.scanId,
        pullRequestId: evaluation.pullRequestId,
        evaluatorId: evaluation.evaluatorId,
        severity: evaluation.severity,
        message: evaluation.message,
        score: evaluation.score,
        metadata: evaluation.metadata,
        evaluatedAt: evaluation.evaluatedAt,
        aiModel: evaluation.aiModel,
        aiTokensUsed: evaluation.aiTokensUsed,
        repository,
        pullNumber: pullRequest?.pullNumber ?? null,
        pullTitle: pullRequest?.title ?? null,
        author: pullRequest?.authorLogin ?? null,
        mergedAt: pullRequest?.mergedAt ?? null,
        createdAt: pullRequest?.createdAt ?? null,
        changedFiles: pullRequest?.changedFiles ?? null,
        additions: pullRequest?.additions ?? null,
        deletions: pullRequest?.deletions ?? null,
      }));
  }

  findPullRequest(repository: string, pullNumber: number) {
    const db = getDb(this.config);
    return db
      .select({ pullRequest: pullRequests, repository: repositories.fullName })
      .from(pullRequests)
      .leftJoin(repositories, eq(pullRequests.repoId, repositories.id))
      .where(and(eq(repositories.fullName, repository), eq(pullRequests.pullNumber, pullNumber)))
      .get();
  }

  private toBatchRecord(
    row: typeof scanBatches.$inferSelect,
    runs: Array<DashboardRunRecord>,
  ): DashboardBatchRecord {
    return {
      id: row.id,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      status: row.status,
      totalRepositories: row.totalRepositories,
      completedRepositories: row.completedRepositories,
      failedRepositories: row.failedRepositories,
      totalPullRequests: row.totalPullRequests,
      evaluatedCount: row.evaluatedCount,
      averageScore: row.averageScore,
      currentPhase: row.currentPhase,
      lastError: row.lastError,
      configHash: row.configHash,
      runIds: runs.map((run) => run.id),
    };
  }

  private toLegacyBatch(run: typeof scanRuns.$inferSelect): DashboardBatchRecord {
    return {
      id: run.id,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      status: run.status,
      totalRepositories: 1,
      completedRepositories: run.status === "completed" ? 1 : 0,
      failedRepositories: run.status === "failed" ? 1 : 0,
      totalPullRequests: run.totalPullRequests,
      evaluatedCount: run.evaluatedCount,
      averageScore: run.averageScore,
      currentPhase: run.currentPhase,
      lastError: run.errorMessage,
      configHash: run.configHash,
      runIds: [run.id],
    };
  }
}

import { eq, and } from "drizzle-orm";
import { getDb } from "../db/connection.js";
import { evaluations } from "../db/schema.js";
import type { EvaluationResult } from "../../scanner/types.js";
import type { PrScannerConfig } from "../../config/schema.js";

export class EvaluationRepository {
  constructor(private config: PrScannerConfig) {}

  /** Insert an evaluation result */
  insert(
    pullRequestId: number,
    scanId: string,
    result: EvaluationResult,
  ): void {
    const db = getDb(this.config);
    db.insert(evaluations).values({
      pullRequestId,
      scanId,
      evaluatorId: result.evaluatorId,
      severity: result.severity,
      message: result.message,
      score: result.score,
      metadata: result.metadata ? JSON.stringify(result.metadata) : null,
      evaluatedAt: new Date().toISOString(),
      aiModel: result.aiModel ?? null,
      aiTokensUsed: result.aiTokensUsed ?? null,
    }).run();
  }

  /** Get all evaluations for a scan */
  getByScanId(scanId: string) {
    const db = getDb(this.config);
    return db
      .select()
      .from(evaluations)
      .where(eq(evaluations.scanId, scanId))
      .all();
  }

  /** Get evaluations for a specific PR */
  getByPullRequestId(pullRequestId: number) {
    const db = getDb(this.config);
    return db
      .select()
      .from(evaluations)
      .where(eq(evaluations.pullRequestId, pullRequestId))
      .all();
  }

  /** Delete all evaluations for a scan */
  deleteByScanId(scanId: string): void {
    const db = getDb(this.config);
    db.delete(evaluations).where(eq(evaluations.scanId, scanId)).run();
  }
}

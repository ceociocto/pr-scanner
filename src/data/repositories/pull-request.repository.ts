import { eq, and } from "drizzle-orm";
import { getDb } from "../db/connection.js";
import { pullRequests } from "../db/schema.js";
import type { PullRequestData } from "../../github/types.js";
import type { PrScannerConfig } from "../../config/schema.js";

export class PullRequestRepository {
  constructor(private config: PrScannerConfig) {}

  /** Find cached PR by repo and number */
  findByNumber(repoId: number, pullNumber: number) {
    const db = getDb(this.config);
    return db
      .select()
      .from(pullRequests)
      .where(and(eq(pullRequests.repoId, repoId), eq(pullRequests.pullNumber, pullNumber)))
      .get();
  }

  /** Check if a cached PR is still fresh */
  isFresh(repoId: number, pullNumber: number, ttlMs: number): boolean {
    const cached = this.findByNumber(repoId, pullNumber);
    if (!cached) return false;
    if (!cached.rawJsonFetchedAt) return false;

    const fetchedAt = new Date(cached.rawJsonFetchedAt).getTime();
    return Date.now() - fetchedAt < ttlMs;
  }

  /** Insert or update a cached PR */
  upsert(repoId: number, pr: PullRequestData, rawJson: string): number {
    const db = getDb(this.config);
    const now = new Date().toISOString();

    const existing = this.findByNumber(repoId, pr.number);

    if (existing) {
      db.update(pullRequests)
        .set({
          title: pr.title,
          body: pr.body,
          state: pr.state,
          merged: pr.merged,
          mergedAt: pr.mergedAt,
          closedAt: pr.closedAt,
          updatedAt: pr.updatedAt,
          authorLogin: pr.author.login,
          mergedByLogin: pr.mergedBy?.login ?? null,
          baseRef: pr.baseRef,
          headRef: pr.headRef,
          labels: JSON.stringify(pr.labels),
          draft: pr.draft,
          changedFiles: pr.changedFiles,
          additions: pr.additions,
          deletions: pr.deletions,
          mergeCommitSha: pr.mergeCommitSha,
          rawJson,
          rawJsonFetchedAt: now,
        })
        .where(eq(pullRequests.id, existing.id))
        .run();
      return existing.id;
    }

    const result = db
      .insert(pullRequests)
      .values({
        repoId,
        pullNumber: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        merged: pr.merged,
        mergedAt: pr.mergedAt,
        closedAt: pr.closedAt,
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
        authorLogin: pr.author.login,
        mergedByLogin: pr.mergedBy?.login ?? null,
        baseRef: pr.baseRef,
        headRef: pr.headRef,
        labels: JSON.stringify(pr.labels),
        draft: pr.draft,
        changedFiles: pr.changedFiles,
        additions: pr.additions,
        deletions: pr.deletions,
        mergeCommitSha: pr.mergeCommitSha,
        rawJson,
        rawJsonFetchedAt: now,
      })
      .returning({ id: pullRequests.id })
      .get();

    return result!.id;
  }

  /** Parse raw JSON from cache back to PullRequestData */
  parseCachedPr(rawJson: string): PullRequestData {
    return JSON.parse(rawJson) as PullRequestData;
  }
}

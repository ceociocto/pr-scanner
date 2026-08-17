import type { PullRequestRepository } from "../data/repositories/pull-request.repository.js";
import type { PullRequestData } from "../github/types.js";

/** Cache check result */
export interface CacheCheckResult {
  cached: boolean;
  pullRequestId: number;
  data?: PullRequestData;
}

/**
 * Check if PR data is in cache and still fresh.
 */
export function checkCache(
  pullRequestRepo: PullRequestRepository,
  repoId: number,
  prNumber: number,
  ttlMs: number,
): CacheCheckResult {
  const isFresh = pullRequestRepo.isFresh(repoId, prNumber, ttlMs);

  if (!isFresh) {
    return { cached: false, pullRequestId: 0 };
  }

  const cached = pullRequestRepo.findByNumber(repoId, prNumber);
  if (!cached || !cached.rawJson) {
    return { cached: false, pullRequestId: 0 };
  }

  return {
    cached: true,
    pullRequestId: cached.id,
    data: pullRequestRepo.parseCachedPr(cached.rawJson),
  };
}

/**
 * Store PR data in cache.
 */
export function storeInCache(
  pullRequestRepo: PullRequestRepository,
  repoId: number,
  pr: PullRequestData,
): number {
  return pullRequestRepo.upsert(repoId, pr, JSON.stringify(pr));
}

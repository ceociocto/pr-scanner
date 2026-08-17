import type { EnrichedPullRequest, PullRequestData, ReviewData, CommitData, CheckRunData } from "../github/types.js";

/** Input data from fetcher */
export interface RawPRData {
  pullRequest: PullRequestData;
  reviews: ReviewData[];
  commits: CommitData[];
  checkRuns: CheckRunData[];
}

/**
 * Enrich raw PR data with computed fields.
 */
export function enrichPR(data: RawPRData, repository: string): EnrichedPullRequest {
  const pr = data.pullRequest;

  // Compute first review timestamp
  const submittedReviews = data.reviews
    .filter((r) => r.submittedAt !== null)
    .sort((a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime());

  const firstReviewAt = submittedReviews.length > 0 ? submittedReviews[0].submittedAt : null;

  // Compute time to first review
  const timeToFirstReviewMs = firstReviewAt && pr.createdAt
    ? new Date(firstReviewAt).getTime() - new Date(pr.createdAt).getTime()
    : null;

  // Compute time to merge
  const timeToMergeMs = pr.mergedAt && pr.createdAt
    ? new Date(pr.mergedAt).getTime() - new Date(pr.createdAt).getTime()
    : null;

  // Detect self-merge: author merged their own PR without any approvals
  const approvals = data.reviews.filter((r) => r.state === "APPROVED");
  const isSelfMerge =
    pr.mergedBy !== null &&
    pr.author.login === pr.mergedBy.login &&
    approvals.length === 0;

  return {
    pullRequest: pr,
    reviews: data.reviews,
    commits: data.commits,
    checkRuns: data.checkRuns,
    firstReviewAt,
    timeToFirstReviewMs,
    timeToMergeMs,
    repository,
    isSelfMerge,
  };
}

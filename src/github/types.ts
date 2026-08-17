/** Raw pull request data from GitHub API */
export interface PullRequestData {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  merged: boolean;
  mergedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: {
    login: string;
    id: number;
  };
  mergedBy: {
    login: string;
    id: number;
  } | null;
  baseRef: string;
  headRef: string;
  labels: string[];
  draft: boolean;
  changedFiles: number;
  additions: number;
  deletions: number;
  mergeCommitSha: string | null;
  reverted: boolean;
}

/** Review data from GitHub API */
export interface ReviewData {
  id: number;
  pullRequestId: number;
  author: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
  body: string;
  submittedAt: string | null;
  commitId: string;
}

/** Commit data from GitHub API */
export interface CommitData {
  sha: string;
  message: string;
  author: string;
  date: string;
}

/** Check run data from GitHub API */
export interface CheckRunData {
  id: number;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion:
    | "success"
    | "failure"
    | "neutral"
    | "cancelled"
    | "skipped"
    | "timed_out"
    | "action_required"
    | null;
  completedAt: string | null;
  startedAt: string | null;
  headSha: string;
}

/** Enriched pull request with computed fields */
export interface EnrichedPullRequest {
  pullRequest: PullRequestData;
  reviews: ReviewData[];
  commits: CommitData[];
  checkRuns: CheckRunData[];
  firstReviewAt: string | null;
  timeToFirstReviewMs: number | null;
  timeToMergeMs: number | null;
  repository: string;
  isSelfMerge: boolean;
}

/** Combined commit status */
export interface CombinedStatus {
  state: "success" | "failure" | "pending";
  totalCount: number;
  statuses: Array<{
    state: string;
    description: string | null;
    targetUrl: string | null;
  }>;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  hasNextPage: boolean;
  nextPage?: string | number;
}

/** Options for listing pull requests */
export interface ListPullRequestsOptions {
  state?: "closed" | "all";
  mergedAfter?: string;
  mergedBefore?: string;
  sort?: "created" | "updated" | "popularity" | "long-running";
  direction?: "asc" | "desc";
  perPage?: number;
  page?: number;
}

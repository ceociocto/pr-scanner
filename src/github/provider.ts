import type {
  PullRequestData,
  ReviewData,
  CommitData,
  CheckRunData,
  CombinedStatus,
  PaginatedResponse,
  ListPullRequestsOptions,
} from "./types.js";

/** Abstract interface for GitHub data providers */
export interface GitHubProvider {
  /** Which platform this provider targets */
  readonly platform: "github.com" | "github-enterprise";

  /** List pull requests with pagination */
  listPullRequests(
    owner: string,
    repo: string,
    options?: ListPullRequestsOptions,
  ): Promise<PaginatedResponse<PullRequestData>>;

  /** Get detailed info for a single PR */
  getPullRequest(owner: string, repo: string, pullNumber: number): Promise<PullRequestData>;

  /** List reviews on a PR */
  listReviews(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PaginatedResponse<ReviewData>>;

  /** List commits on a PR */
  listCommits(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PaginatedResponse<CommitData>>;

  /** Get check runs for a ref */
  listCheckRuns(owner: string, repo: string, ref: string): Promise<PaginatedResponse<CheckRunData>>;

  /** Get combined status for a ref */
  getCombinedStatus(owner: string, repo: string, ref: string): Promise<CombinedStatus>;

  /** Test connectivity */
  testConnection(): Promise<{ ok: boolean; username: string }>;
}

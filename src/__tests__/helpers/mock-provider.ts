import type {
  GitHubProvider,
  PullRequestData,
  ReviewData,
  CommitData,
  CheckRunData,
  CombinedStatus,
  PaginatedResponse,
  ListPullRequestsOptions,
} from "../../github/types.js";
import pullsFixture from "../fixtures/pulls.json";
import reviewsFixture from "../fixtures/reviews.json";
import commitsFixture from "../fixtures/commits.json";
import checkRunsFixture from "../fixtures/check-runs.json";

function mapPullRequest(data: any): PullRequestData {
  return {
    id: data.id,
    number: data.number,
    title: data.title,
    body: data.body,
    state: data.state,
    merged: data.merged_at !== null,
    mergedAt: data.merged_at,
    closedAt: data.closed_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    author: { login: data.user?.login ?? "unknown", id: data.user?.id ?? 0 },
    mergedBy: data.merged_by ? { login: data.merged_by.login, id: data.merged_by.id } : null,
    baseRef: data.base?.ref ?? "",
    headRef: data.head?.ref ?? "",
    labels: (data.labels ?? []).map((l: any) => l.name),
    draft: data.draft ?? false,
    changedFiles: data.changed_files ?? 0,
    additions: data.additions ?? 0,
    deletions: data.deletions ?? 0,
    mergeCommitSha: data.merge_commit_sha,
    reverted: false,
  };
}

function mapReview(data: any): ReviewData {
  return {
    id: data.id,
    pullRequestId: 123,
    author: data.user?.login ?? "unknown",
    state: data.state,
    body: data.body ?? "",
    submittedAt: data.submitted_at,
    commitId: data.commit_id,
  };
}

function mapCommit(data: any): CommitData {
  return {
    sha: data.sha,
    message: data.commit?.message ?? "",
    author: data.commit?.author?.name ?? "unknown",
    date: data.commit?.author?.date ?? "",
  };
}

function mapCheckRun(data: any): CheckRunData {
  return {
    id: data.id,
    name: data.name,
    status: data.status,
    conclusion: data.conclusion,
    completedAt: data.completed_at,
    startedAt: data.started_at,
    headSha: data.head_sha,
  };
}

/** Mock GitHub provider for testing */
export class MockProvider implements GitHubProvider {
  readonly platform = "github.com" as const;
  private customPRs: PullRequestData[] = [];
  private failConnection = false;

  setCustomPRs(prs: PullRequestData[]) {
    this.customPRs = prs;
  }

  setFailConnection(fail: boolean) {
    this.failConnection = fail;
  }

  async listPullRequests(
    _owner: string,
    _repo: string,
    _options?: ListPullRequestsOptions,
  ): Promise<PaginatedResponse<PullRequestData>> {
    if (this.customPRs.length > 0) {
      return {
        data: this.customPRs.filter((pr) => pr.merged),
        hasNextPage: false,
      };
    }
    return {
      data: [mapPullRequest(pullsFixture)],
      hasNextPage: false,
    };
  }

  async getPullRequest(
    _owner: string,
    _repo: string,
    _pullNumber: number,
  ): Promise<PullRequestData> {
    return mapPullRequest(pullsFixture);
  }

  async listReviews(
    _owner: string,
    _repo: string,
    _pullNumber: number,
  ): Promise<PaginatedResponse<ReviewData>> {
    return {
      data: reviewsFixture.map(mapReview),
      hasNextPage: false,
    };
  }

  async listCommits(
    _owner: string,
    _repo: string,
    _pullNumber: number,
  ): Promise<PaginatedResponse<CommitData>> {
    return {
      data: commitsFixture.map(mapCommit),
      hasNextPage: false,
    };
  }

  async listCheckRuns(
    _owner: string,
    _repo: string,
    _ref: string,
  ): Promise<PaginatedResponse<CheckRunData>> {
    return {
      data: checkRunsFixture.map(mapCheckRun),
      hasNextPage: false,
    };
  }

  async getCombinedStatus(_owner: string, _repo: string, _ref: string): Promise<CombinedStatus> {
    return {
      state: "success",
      totalCount: 2,
      statuses: [{ state: "success", description: "All checks passed", targetUrl: null }],
    };
  }

  async testConnection(): Promise<{ ok: boolean; username: string }> {
    if (this.failConnection) {
      return { ok: false, username: "" };
    }
    return { ok: true, username: "test-user" };
  }
}

/** Factory for creating test PR data */
export function createTestPR(overrides: Partial<PullRequestData> = {}): PullRequestData {
  const base: PullRequestData = {
    id: 999,
    number: 100,
    title: "Test PR",
    body: "Fixes #789\n\nThis is a test PR.",
    state: "closed",
    merged: true,
    mergedAt: "2025-07-01T12:00:00Z",
    closedAt: "2025-07-01T12:00:00Z",
    createdAt: "2025-06-30T08:00:00Z",
    updatedAt: "2025-07-01T12:00:00Z",
    author: { login: "dev1", id: 10 },
    mergedBy: { login: "dev2", id: 20 },
    baseRef: "main",
    headRef: "fix/test-pr",
    labels: ["bug"],
    draft: false,
    changedFiles: 5,
    additions: 100,
    deletions: 30,
    mergeCommitSha: "sha-test",
    reverted: false,
  };
  return { ...base, ...overrides };
}

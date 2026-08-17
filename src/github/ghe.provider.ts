import type {
  PullRequestData,
  ReviewData,
  CommitData,
  CheckRunData,
  CombinedStatus,
  PaginatedResponse,
  ListPullRequestsOptions,
} from "./types.js";
import { GitHubProvider } from "./provider.js";
import type { AppOctokit } from "./octokit-builder.js";

/**
 * GitHub Enterprise Server provider.
 * Uses the same REST API as GitHub.com but with a custom baseUrl.
 */
export class GheProvider implements GitHubProvider {
  readonly platform = "github-enterprise" as const;
  private octokit: AppOctokit;

  constructor(octokit: AppOctokit) {
    this.octokit = octokit;
  }

  async listPullRequests(
    owner: string,
    repo: string,
    options: ListPullRequestsOptions = {},
  ): Promise<PaginatedResponse<PullRequestData>> {
    const response = await this.octokit.paginate("GET /repos/{owner}/{repo}/pulls", {
      owner,
      repo,
      state: options.state ?? "closed",
      sort: options.sort ?? "updated",
      direction: options.direction ?? "desc",
      per_page: options.perPage ?? 100,
      page: options.page ?? 1,
    });

    const prs = (response as any[]).map(mapPullRequest).filter((pr) => pr.merged);

    return {
      data: prs,
      hasNextPage: false,
    };
  }

  async getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequestData> {
    const response = await this.octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      { owner, repo, pull_number: pullNumber },
    );
    return mapPullRequest(response.data);
  }

  async listReviews(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PaginatedResponse<ReviewData>> {
    const response = await this.octokit.paginate(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      { owner, repo, pull_number: pullNumber },
    );

    return {
      data: (response as any[]).map(mapReview),
      hasNextPage: false,
    };
  }

  async listCommits(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PaginatedResponse<CommitData>> {
    const response = await this.octokit.paginate(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
      { owner, repo, pull_number: pullNumber },
    );

    return {
      data: (response as any[]).map(mapCommit),
      hasNextPage: false,
    };
  }

  async listCheckRuns(
    owner: string,
    repo: string,
    ref: string,
  ): Promise<PaginatedResponse<CheckRunData>> {
    const response = await this.octokit.paginate(
      "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
      { owner, repo, ref },
    );

    return {
      data: (response as any[]).map(mapCheckRun),
      hasNextPage: false,
    };
  }

  async getCombinedStatus(
    owner: string,
    repo: string,
    ref: string,
  ): Promise<CombinedStatus> {
    const response = await this.octokit.request(
      "GET /repos/{owner}/{repo}/commits/{ref}/status",
      { owner, repo, ref },
    );
    return response.data as CombinedStatus;
  }

  async testConnection(): Promise<{ ok: boolean; username: string }> {
    try {
      const response = await this.octokit.request("GET /user");
      return { ok: true, username: response.data.login };
    } catch {
      return { ok: false, username: "" };
    }
  }
}

// ── Mapping functions (shared with GitHubComProvider, duplicated for clarity) ──

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
    author: {
      login: data.user?.login ?? "unknown",
      id: data.user?.id ?? 0,
    },
    mergedBy: data.merged_by
      ? { login: data.merged_by.login, id: data.merged_by.id }
      : null,
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
    pullRequestId: data.pull_request_url
      ? parseInt(data.pull_request_url.split("/").pop()!)
      : 0,
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
    author: data.commit?.author?.name ?? data.author?.login ?? "unknown",
    date: data.commit?.author?.date ?? data.committer?.date ?? "",
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

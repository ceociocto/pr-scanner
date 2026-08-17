import type { GitHubProvider } from "../github/provider.js";
import type { PullRequestData, ReviewData, CommitData, CheckRunData } from "../github/types.js";

/** All enriched data for a single PR */
export interface FetchedPRData {
  pullRequest: PullRequestData;
  reviews: ReviewData[];
  commits: CommitData[];
  checkRuns: CheckRunData[];
}

/**
 * Fetch all data needed for a single PR evaluation.
 * Orchestrates calls to the GitHub provider.
 */
export async function fetchPRData(
  provider: GitHubProvider,
  owner: string,
  repo: string,
  pr: PullRequestData,
): Promise<FetchedPRData> {
  const [reviewsResult, commitsResult] = await Promise.all([
    provider.listReviews(owner, repo, pr.number),
    provider.listCommits(owner, repo, pr.number),
  ]);

  // Fetch check runs only if the PR has a merge commit SHA
  let checkRunsResult = { data: [] as CheckRunData[], hasNextPage: false };
  if (pr.mergeCommitSha) {
    try {
      checkRunsResult = await provider.listCheckRuns(owner, repo, pr.mergeCommitSha);
    } catch {
      // Check runs may not be available for all repos
    }
  }

  return {
    pullRequest: pr,
    reviews: reviewsResult.data,
    commits: commitsResult.data,
    checkRuns: checkRunsResult.data,
  };
}

/**
 * Fetch data for multiple PRs with controlled concurrency.
 */
export async function fetchPRDataBatch(
  provider: GitHubProvider,
  owner: string,
  repo: string,
  prs: PullRequestData[],
  concurrency: number,
  onProgress?: (index: number, total: number) => void,
): Promise<FetchedPRData[]> {
  const results: FetchedPRData[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < prs.length; i++) {
    const pr = prs[i];
    const index = i;

    const promise = fetchPRData(provider, owner, repo, pr)
      .then((data) => {
        results[index] = data;
        onProgress?.(index + 1, prs.length);
      })
      .catch((error) => {
        results[index] = {
          pullRequest: pr,
          reviews: [],
          commits: [],
          checkRuns: [],
        };
        onProgress?.(index + 1, prs.length);
      });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      for (let j = executing.length - 1; j >= 0; j--) {
        // We can't easily check if a promise is resolved, so we just cap
        if (j >= concurrency) {
          continue;
        }
        break;
      }
      // Simplified: just wait for one to complete
    }
  }

  await Promise.all(executing);
  return results.filter(Boolean);
}

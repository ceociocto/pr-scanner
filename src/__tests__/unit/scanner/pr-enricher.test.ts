import { describe, it, expect } from "vitest";
import { enrichPR } from "../../../scanner/pr-enricher.js";
import type { PullRequestData } from "../../../github/types.js";
import { createTestPR } from "../../helpers/mock-provider.js";

describe("PR Enricher", () => {
  const baseReviews = [
    {
      id: 1,
      pullRequestId: 100,
      author: "reviewer1",
      state: "APPROVED" as const,
      body: "LGTM",
      submittedAt: "2025-06-30T12:00:00Z",
      commitId: "sha1",
    },
  ];

  const baseCommits = [
    {
      sha: "sha1",
      message: "fix: something",
      author: "dev",
      date: "2025-06-30T08:00:00Z",
    },
  ];

  it("should compute time-to-first-review", () => {
    const pr = createTestPR({
      createdAt: "2025-06-30T08:00:00Z",
    });

    const result = enrichPR(
      { pullRequest: pr, reviews: baseReviews, commits: baseCommits, checkRuns: [] },
      "owner/repo",
    );

    expect(result.timeToFirstReviewMs).toBe(14_400_000); // 4 hours
    expect(result.firstReviewAt).toBe("2025-06-30T12:00:00Z");
  });

  it("should compute time-to-merge", () => {
    const pr = createTestPR({
      createdAt: "2025-06-30T08:00:00Z",
      mergedAt: "2025-07-01T08:00:00Z",
    });

    const result = enrichPR(
      { pullRequest: pr, reviews: baseReviews, commits: baseCommits, checkRuns: [] },
      "owner/repo",
    );

    expect(result.timeToMergeMs).toBe(86_400_000); // 24 hours
  });

  it("should detect self-merge when author merges own PR with no approvals", () => {
    const pr = createTestPR({
      author: { login: "alice", id: 1 },
      mergedBy: { login: "alice", id: 1 },
    });

    const result = enrichPR(
      { pullRequest: pr, reviews: [], commits: baseCommits, checkRuns: [] },
      "owner/repo",
    );

    expect(result.isSelfMerge).toBe(true);
  });

  it("should not flag self-merge when author merges own PR with approvals", () => {
    const pr = createTestPR({
      author: { login: "alice", id: 1 },
      mergedBy: { login: "alice", id: 1 },
    });

    const result = enrichPR(
      { pullRequest: pr, reviews: baseReviews, commits: baseCommits, checkRuns: [] },
      "owner/repo",
    );

    expect(result.isSelfMerge).toBe(false);
  });

  it("should not flag self-merge when someone else merges", () => {
    const pr = createTestPR({
      author: { login: "alice", id: 1 },
      mergedBy: { login: "bob", id: 2 },
    });

    const result = enrichPR(
      { pullRequest: pr, reviews: [], commits: baseCommits, checkRuns: [] },
      "owner/repo",
    );

    expect(result.isSelfMerge).toBe(false);
  });

  it("should return null time-to-review when no reviews submitted", () => {
    const pr = createTestPR();
    const result = enrichPR(
      {
        pullRequest: pr,
        reviews: [{ ...baseReviews[0], submittedAt: null }],
        commits: baseCommits,
        checkRuns: [],
      },
      "owner/repo",
    );

    expect(result.timeToFirstReviewMs).toBeNull();
    expect(result.firstReviewAt).toBeNull();
  });

  it("should set repository name correctly", () => {
    const pr = createTestPR();
    const result = enrichPR(
      { pullRequest: pr, reviews: baseReviews, commits: baseCommits, checkRuns: [] },
      "my-org/my-repo",
    );

    expect(result.repository).toBe("my-org/my-repo");
  });
});

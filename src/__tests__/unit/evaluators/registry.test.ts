import { describe, it, expect } from "vitest";
import { evaluatePR, computeSummary, getRegisteredEvaluators } from "../../../evaluators/evaluator-registry.js";
import { enrichPR } from "../../../scanner/pr-enricher.js";
import type { EnrichedPullRequest } from "../../../github/types.js";
import type { PrScannerConfig } from "../../../config/schema.js";
import { DEFAULT_CONFIG } from "../../../config/defaults.js";

/** Create a complete enriched PR for testing */
function createEnrichedPR(overrides: Partial<EnrichedPullRequest> = {}): EnrichedPullRequest {
  return {
    pullRequest: {
      id: 1,
      number: 42,
      title: "fix(auth): resolve login redirect loop",
      body: "Fixes #123\n\nResolved a redirect loop in the auth flow.",
      state: "closed",
      merged: true,
      mergedAt: "2025-06-15T10:30:00Z",
      closedAt: "2025-06-15T10:30:00Z",
      createdAt: "2025-06-14T08:00:00Z",
      updatedAt: "2025-06-15T10:30:00Z",
      author: { login: "alice", id: 1 },
      mergedBy: { login: "bob", id: 2 },
      baseRef: "main",
      headRef: "fix/login-redirect",
      labels: ["bug"],
      draft: false,
      changedFiles: 3,
      additions: 45,
      deletions: 12,
      mergeCommitSha: "abc123",
      reverted: false,
    },
    reviews: [
      {
        id: 1,
        pullRequestId: 42,
        author: "bob",
        state: "APPROVED",
        body: "LGTM",
        submittedAt: "2025-06-15T09:00:00Z",
        commitId: "sha1",
      },
      {
        id: 2,
        pullRequestId: 42,
        author: "carol",
        state: "COMMENTED",
        body: "Consider adding a test.",
        submittedAt: "2025-06-15T08:30:00Z",
        commitId: "sha1",
      },
    ],
    commits: [
      {
        sha: "sha1",
        message: "fix(auth): resolve login redirect loop",
        author: "alice",
        date: "2025-06-14T08:00:00Z",
      },
    ],
    checkRuns: [
      {
        id: 1,
        name: "CI / build",
        status: "completed",
        conclusion: "success",
        completedAt: "2025-06-15T09:30:00Z",
        startedAt: "2025-06-15T09:20:00Z",
        headSha: "abc123",
      },
    ],
    firstReviewAt: "2025-06-15T08:30:00Z",
    timeToFirstReviewMs: 1_800_000,
    timeToMergeMs: 98_400_000,
    repository: "owner/repo",
    isSelfMerge: false,
    ...overrides,
  };
}

describe("Evaluator Registry", () => {
  it("should have 13 evaluators registered", () => {
    const evaluators = getRegisteredEvaluators();
    expect(evaluators.length).toBe(13);
  });

  it("should evaluate a good PR and produce mostly pass results", () => {
    const pr = createEnrichedPR();
    const config = { ...DEFAULT_CONFIG } as PrScannerConfig;
    const result = evaluatePR(pr, config);

    expect(result.pullNumber).toBe(42);
    expect(result.results.length).toBeGreaterThan(5);
    expect(result.passCount).toBeGreaterThan(0);
    expect(result.failCount).toBe(0);
    expect(result.aggregateScore).toBeGreaterThan(1);
  });

  it("should detect a PR with no linked issues", () => {
    const pr = createEnrichedPR({
      pullRequest: {
        ...createEnrichedPR().pullRequest,
        title: "Some random fix",
        body: "Fixed a thing.",
      },
    });
    const config = { ...DEFAULT_CONFIG } as PrScannerConfig;
    const result = evaluatePR(pr, config);

    const linkedIssues = result.results.find((r) => r.evaluatorId === "linked-issues");
    expect(linkedIssues).toBeDefined();
    expect(linkedIssues!.severity).toBe("fail");
  });

  it("should detect self-merge", () => {
    const pr = createEnrichedPR({
      pullRequest: {
        ...createEnrichedPR().pullRequest,
        author: { login: "alice", id: 1 },
        mergedBy: { login: "alice", id: 1 },
      },
      reviews: [], // No approvals
      isSelfMerge: true,
    });
    const config = { ...DEFAULT_CONFIG } as PrScannerConfig;
    const result = evaluatePR(pr, config);

    const selfMerge = result.results.find((r) => r.evaluatorId === "self-merge");
    expect(selfMerge).toBeDefined();
    expect(selfMerge!.severity).toBe("fail");
  });

  it("should skip disabled evaluators", () => {
    const pr = createEnrichedPR();
    const config = {
      ...DEFAULT_CONFIG,
      standards: {
        ...DEFAULT_CONFIG.standards,
        prSize: { ...DEFAULT_CONFIG.standards.prSize, enabled: false },
        commitConvention: { ...DEFAULT_CONFIG.standards.commitConvention, enabled: false },
        reviewerCount: { ...DEFAULT_CONFIG.standards.reviewerCount, enabled: false },
      },
    } as PrScannerConfig;
    const result = evaluatePR(pr, config);

    const ids = result.results.map((r) => r.evaluatorId);
    expect(ids).not.toContain("pr-size");
    expect(ids).not.toContain("commit-convention");
    expect(ids).not.toContain("reviewer-count");
  });
});

describe("Scan Summary", () => {
  it("should compute correct summary statistics", () => {
    const config = { ...DEFAULT_CONFIG } as PrScannerConfig;
    const evaluations = [
      evaluatePR(createEnrichedPR(), config),
      evaluatePR(createEnrichedPR(), config),
    ];
    const summary = computeSummary(evaluations);

    expect(summary.averageScore).toBeGreaterThan(0);
    expect(summary.allPassCount + summary.warningCount + summary.failureCount).toBe(2);
    expect(summary.evaluatorSummaries.length).toBe(13);
  });
});

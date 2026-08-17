import { describe, it, expect } from "vitest";
import { DescriptionQualityAiEvaluator } from "../../../evaluators/ai/description-quality-ai.evaluator.js";
import { CodeRiskAiEvaluator } from "../../../evaluators/ai/code-risk-ai.evaluator.js";
import { ReviewQualityAiEvaluator } from "../../../evaluators/ai/review-quality-ai.evaluator.js";
import { MockLlmClient } from "../../helpers/mock-llm.js";
import { createTokenBudget } from "../../../ai/token-counter.js";
import type { EnrichedPullRequest } from "../../../github/types.js";
import type { PrScannerConfig } from "../../../config/schema.js";
import { DEFAULT_CONFIG } from "../../../config/defaults.js";

function createTestPR(): EnrichedPullRequest {
  return {
    pullRequest: {
      id: 1,
      number: 42,
      title: "feat(api): add user pagination endpoint",
      body: "## Motivation\nUsers requested pagination support for the user list API.\n\n## Changes\n- Added `/api/users?page=1&limit=20` endpoint\n- Added cursor-based pagination for large datasets\n\n## Testing\n- Added unit tests in `user-api.test.ts`\n- Tested with 1000+ user records",
      state: "closed",
      merged: true,
      mergedAt: "2025-06-15T10:30:00Z",
      closedAt: "2025-06-15T10:30:00Z",
      createdAt: "2025-06-14T08:00:00Z",
      updatedAt: "2025-06-15T10:30:00Z",
      author: { login: "alice", id: 1 },
      mergedBy: { login: "bob", id: 2 },
      baseRef: "main",
      headRef: "feat/user-pagination",
      labels: ["feature"],
      draft: false,
      changedFiles: 5,
      additions: 120,
      deletions: 30,
      mergeCommitSha: "abc123",
      reverted: false,
    },
    reviews: [
      {
        id: 1,
        pullRequestId: 42,
        author: "bob",
        state: "APPROVED",
        body: "LGTM, looks good to me",
        submittedAt: "2025-06-15T09:00:00Z",
        commitId: "sha1",
      },
      {
        id: 2,
        pullRequestId: 42,
        author: "carol",
        state: "CHANGES_REQUESTED",
        body: "The SQL query in user-controller.ts could be vulnerable to injection. Please use parameterized queries instead of string concatenation. Also, the pagination cursor should be opaque — currently it exposes the internal database ID which could be a security concern.",
        submittedAt: "2025-06-15T08:30:00Z",
        commitId: "sha1",
      },
    ],
    commits: [
      {
        sha: "sha1",
        message: "feat(api): add user pagination endpoint",
        author: "alice",
        date: "2025-06-14T08:00:00Z",
      },
    ],
    checkRuns: [
      {
        id: 1,
        name: "CI / test",
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
  };
}

function createConfigWithAi(overrides: Partial<PrScannerConfig["ai"]> = {}): PrScannerConfig {
  return {
    ...DEFAULT_CONFIG,
    ai: {
      ...DEFAULT_CONFIG.ai,
      enabled: true,
      ...overrides,
    },
  } as PrScannerConfig;
}

describe("AI Evaluators", () => {
  const mockLlm = new MockLlmClient({
    defaultResponse: {
      severity: "warn",
      message: "AI detected a potential issue",
      details: { motivation: "warn", impact: "pass", testing: "pass" },
      suggestion: "Consider adding more detail about the impact",
    },
    responses: {
      "Pull Request description": {
        severity: "pass",
        message: "Description is well-structured with motivation and testing sections",
        details: { motivation: "pass", impact: "pass", testing: "pass", rollback: "n/a" },
      },
      "risk assessment": {
        severity: "warn",
        message: "Potential SQL injection risk identified in user controller",
        details: { security: "warn", performance: "pass", architecture: "pass", techDebt: "pass" },
        suggestion: "Use parameterized queries for all database operations",
      },
      "review quality": {
        severity: "warn",
        message: "One reviewer provided only a brief LGTM without detailed analysis",
        details: { depth: "warn", constructive: "pass", thoroughness: "warn" },
        suggestion: "Require substantive review comments before approval",
      },
    },
  });

  const budget = createTokenBudget(10000);

  it("DescriptionQualityAiEvaluator should produce pass for good descriptions", async () => {
    const evaluator = new DescriptionQualityAiEvaluator();
    evaluator.setLlmClient(mockLlm);
    evaluator.setTokenBudget(budget);

    const pr = createTestPR();
    const config = createConfigWithAi();

    const result = await evaluator.evaluate(pr, config);

    expect(result.evaluatorId).toBe("description-quality-ai");
    expect(result.severity).toBe("pass");
    expect(result.aiModel).toBe("mock-model");
    expect(result.aiTokensUsed).toBe(150);
    expect(result.metadata?.details).toBeDefined();
  });

  it("CodeRiskAiEvaluator should detect security risk", async () => {
    const evaluator = new CodeRiskAiEvaluator();
    evaluator.setLlmClient(mockLlm);
    evaluator.setTokenBudget(budget);

    const pr = createTestPR();
    const config = createConfigWithAi();

    const result = await evaluator.evaluate(pr, config);

    expect(result.evaluatorId).toBe("code-risk-ai");
    expect(result.severity).toBe("warn");
    expect(result.metadata?.suggestion).toContain("parameterized");
  });

  it("ReviewQualityAiEvaluator should detect ceremonial review", async () => {
    const evaluator = new ReviewQualityAiEvaluator();
    evaluator.setLlmClient(mockLlm);
    evaluator.setTokenBudget(budget);

    const pr = createTestPR();
    const config = createConfigWithAi();

    const result = await evaluator.evaluate(pr, config);

    expect(result.evaluatorId).toBe("review-quality-ai");
    expect(result.severity).toBe("warn");
    expect(result.metadata?.details).toBeDefined();
  });

  it("AI evaluator should skip when LLM client is not set", async () => {
    const evaluator = new DescriptionQualityAiEvaluator();
    // Don't set LLM client

    const pr = createTestPR();
    const config = createConfigWithAi();

    const result = await evaluator.evaluate(pr, config);

    expect(result.severity).toBe("pass");
    expect(result.metadata?.skipped).toBe(true);
  });

  it("AI evaluator should skip when AI is disabled", async () => {
    const evaluator = new DescriptionQualityAiEvaluator();
    evaluator.setLlmClient(mockLlm);
    evaluator.setTokenBudget(budget);

    const pr = createTestPR();
    const config = createConfigWithAi({ enabled: false });

    const result = await evaluator.evaluate(pr, config);

    expect(result.severity).toBe("pass");
    expect(result.metadata?.skipped).toBe(true);
  });

  it("AI evaluator should skip when token budget exceeded", async () => {
    const evaluator = new DescriptionQualityAiEvaluator();
    evaluator.setLlmClient(mockLlm);
    const exceededBudget = createTokenBudget(10);
    exceededBudget.record(10); // Exhaust the budget
    evaluator.setTokenBudget(exceededBudget);

    const pr = createTestPR();
    const config = createConfigWithAi();

    const result = await evaluator.evaluate(pr, config);

    expect(result.severity).toBe("pass");
    expect(result.metadata?.skipped).toBe(true);
    expect(result.metadata?.reason).toContain("Token budget");
  });

  it("AI evaluator should record token usage", async () => {
    const evaluator = new DescriptionQualityAiEvaluator();
    const budget = createTokenBudget(10000);
    evaluator.setLlmClient(mockLlm);
    evaluator.setTokenBudget(budget);

    const pr = createTestPR();
    const config = createConfigWithAi();

    await evaluator.evaluate(pr, config);

    expect(budget.used).toBe(150);
  });

  it("AI evaluator should skip when disabled via config", async () => {
    const evaluator = new DescriptionQualityAiEvaluator();
    evaluator.setLlmClient(mockLlm);
    evaluator.setTokenBudget(budget);

    const pr = createTestPR();
    const config = createConfigWithAi({
      evaluators: {
        descriptionQuality: { enabled: false },
      },
    });

    const result = await evaluator.evaluate(pr, config);

    expect(result.severity).toBe("pass");
    expect(result.metadata?.skipped).toBe(true);
  });
});

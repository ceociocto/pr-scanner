import { describe, it, expect } from "vitest";
import { JsonReporter } from "../../../reporters/json.reporter.js";
import { CsvReporter } from "../../../reporters/csv.reporter.js";
import { MarkdownReporter } from "../../../reporters/markdown.reporter.js";
import { ConsoleReporter } from "../../../reporters/console.reporter.js";
import { AiInsightReporter } from "../../../reporters/ai-insight.reporter.js";
import { createReporter } from "../../../reporters/reporter-factory.js";
import { evaluatePR, buildScanResult } from "../../../evaluators/evaluator-registry.js";
import { enrichPR } from "../../../scanner/pr-enricher.js";
import type { PrScannerConfig } from "../../../config/schema.js";
import { DEFAULT_CONFIG } from "../../../config/defaults.js";

function createTestScanResult() {
  const config = { ...DEFAULT_CONFIG } as PrScannerConfig;
  const enriched = enrichPR(
    {
      pullRequest: {
        id: 1,
        number: 42,
        title: "fix(auth): resolve login redirect loop",
        body: "Fixes #123\n\nResolved a redirect loop.",
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
          id: 1, pullRequestId: 42, author: "bob", state: "APPROVED" as const,
          body: "LGTM", submittedAt: "2025-06-15T09:00:00Z", commitId: "sha1",
        },
      ],
      commits: [
        { sha: "sha1", message: "fix(auth): resolve login redirect loop", author: "alice", date: "2025-06-14T08:00:00Z" },
      ],
      checkRuns: [
        {
          id: 1, name: "CI/build", status: "completed" as const, conclusion: "success" as const,
          completedAt: "2025-06-15T09:30:00Z", startedAt: "2025-06-15T09:20:00Z", headSha: "abc123",
        },
      ],
      firstReviewAt: "2025-06-15T08:30:00Z",
      timeToFirstReviewMs: 1_800_000,
      timeToMergeMs: 98_400_000,
      repository: "owner/repo",
      isSelfMerge: false,
    },
    "owner/repo",
  );

  const evaluations = [evaluatePR(enriched, config)];
  return buildScanResult(["owner/repo"], evaluations);
}

describe("Reporters", () => {
  const result = createTestScanResult();

  it("JSON reporter produces valid JSON", () => {
    const reporter = new JsonReporter();
    const output = reporter.render(result);
    const parsed = JSON.parse(output);
    expect(parsed.totalPullRequests).toBe(1);
    expect(parsed.evaluations).toHaveLength(1);
    expect(parsed.summary).toBeDefined();
  });

  it("CSV reporter has headers", () => {
    const reporter = new CsvReporter();
    const output = reporter.render(result);
    // CSV has two sections: summary then PR rows, each with its own header
    expect(output).toContain("Type");
    expect(output).toContain("Metric");
    expect(output).toContain("Value");
    // PR data section should have its own header
    expect(output).toContain("Repository");
    expect(output).toContain("PR");
    expect(output).toContain("Score");
    // PR data row
    expect(output).toContain("#42");
  });

  it("Markdown reporter has sections", () => {
    const reporter = new MarkdownReporter();
    const output = reporter.render(result);
    expect(output).toContain("# PR Quality Scan Report");
    expect(output).toContain("## Summary");
    expect(output).toContain("## Evaluator Breakdown");
    expect(output).toContain("## Pull Request Details");
    expect(output).toContain("|");
  });

  it("Console reporter outputs text", () => {
    const reporter = new ConsoleReporter();
    const output = reporter.render(result);
    expect(output).toContain("PR Quality Scan Report");
    expect(output).toContain("Average Score");
    expect(output).toContain("#42");
  });

  it("Console reporter can disable colors", () => {
    const reporter = new ConsoleReporter();
    reporter.disableColor();
    const output = reporter.render(result);
    // Should still have content, just no ANSI codes
    expect(output).toContain("PR Quality Scan Report");
    expect(output).not.toContain("\x1b[");
  });

  it("AI Insight reporter returns placeholder", () => {
    const reporter = new AiInsightReporter();
    const output = reporter.render(result);
    expect(output).toContain("AI Insight reports require AI to be enabled");
  });

  it("Reporter factory creates correct types", () => {
    expect(createReporter("json")).toBeInstanceOf(JsonReporter);
    expect(createReporter("csv")).toBeInstanceOf(CsvReporter);
    expect(createReporter("markdown")).toBeInstanceOf(MarkdownReporter);
    expect(createReporter("console")).toBeInstanceOf(ConsoleReporter);
    expect(createReporter("ai-insight")).toBeInstanceOf(AiInsightReporter);
  });
});

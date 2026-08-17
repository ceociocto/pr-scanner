import type { Evaluator } from "./evaluator.js";
import type { EnrichedPullRequest } from "../github/types.js";
import type { StandardsConfig, PrScannerConfig } from "../config/schema.js";
import type { EvaluationResult, PullRequestEvaluation, ScanResult, ScanSummary, EvaluatorSummary } from "../scanner/types.js";
import { PrSizeEvaluator } from "./structural/pr-size.evaluator.js";
import { CommitConventionEvaluator } from "./structural/commit-convention.evaluator.js";
import { ReviewerCountEvaluator } from "./structural/reviewer-count.evaluator.js";
import { CiStatusEvaluator } from "./structural/ci-status.evaluator.js";
import { TimeToMergeEvaluator } from "./structural/time-to-merge.evaluator.js";
import { TimeToReviewEvaluator } from "./structural/time-to-review.evaluator.js";
import { LabelsEvaluator } from "./structural/labels.evaluator.js";
import { BranchNamingEvaluator } from "./structural/branch-naming.evaluator.js";
import { LinkedIssuesEvaluator } from "./structural/linked-issues.evaluator.js";
import { CodeChurnEvaluator } from "./semi-automated/code-churn.evaluator.js";
import { SelfMergeEvaluator } from "./semi-automated/self-merge.evaluator.js";
import { RevertRateEvaluator } from "./semi-automated/revert-rate.evaluator.js";
import { ReviewCommentCountEvaluator } from "./semi-automated/review-comment-count.evaluator.js";

/** All registered evaluators */
const ALL_EVALUATORS: Evaluator[] = [
  new PrSizeEvaluator(),
  new CommitConventionEvaluator(),
  new ReviewerCountEvaluator(),
  new CiStatusEvaluator(),
  new TimeToMergeEvaluator(),
  new TimeToReviewEvaluator(),
  new LabelsEvaluator(),
  new BranchNamingEvaluator(),
  new LinkedIssuesEvaluator(),
  new CodeChurnEvaluator(),
  new SelfMergeEvaluator(),
  new RevertRateEvaluator(),
  new ReviewCommentCountEvaluator(),
];

/**
 * Get all registered evaluators.
 */
export function getRegisteredEvaluators(): Evaluator[] {
  return ALL_EVALUATORS;
}

/**
 * Run all enabled evaluators against a single PR.
 */
export function evaluatePR(
  pr: EnrichedPullRequest,
  config: PrScannerConfig,
): PullRequestEvaluation {
  const standards = config.standards;
  const allResults: EvaluationResult[] = [];

  for (const evaluator of ALL_EVALUATORS) {
    if (!evaluator.isEnabled(standards)) {
      continue;
    }

    const results = evaluator.evaluate(pr, standards);
    const normalized = Array.isArray(results) ? results : [results];
    allResults.push(...normalized);
  }

  // Compute aggregate score
  const totalScore = allResults.reduce((sum, r) => sum + r.score, 0);
  const aggregateScore = allResults.length > 0 ? totalScore / allResults.length : 2;

  const passCount = allResults.filter((r) => r.severity === "pass").length;
  const warnCount = allResults.filter((r) => r.severity === "warn").length;
  const failCount = allResults.filter((r) => r.severity === "fail").length;

  return {
    repository: pr.repository,
    pullNumber: pr.pullRequest.number,
    pullTitle: pr.pullRequest.title,
    author: pr.pullRequest.author.login,
    mergedAt: pr.pullRequest.mergedAt ?? "",
    url: `https://github.com/${pr.repository}/pull/${pr.pullRequest.number}`,
    results: allResults,
    aggregateScore: Math.round(aggregateScore * 100) / 100,
    passCount,
    warnCount,
    failCount,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Compute scan summary from all evaluations.
 */
export function computeSummary(evaluations: PullRequestEvaluation[]): ScanSummary {
  if (evaluations.length === 0) {
    return {
      averageScore: 0,
      allPassCount: 0,
      warningCount: 0,
      failureCount: 0,
      evaluatorSummaries: [],
    };
  }

  const averageScore =
    evaluations.reduce((sum, e) => sum + e.aggregateScore, 0) / evaluations.length;

  const allPassCount = evaluations.filter((e) => e.failCount === 0 && e.warnCount === 0).length;
  const warningCount = evaluations.filter((e) => e.warnCount > 0 && e.failCount === 0).length;
  const failureCount = evaluations.filter((e) => e.failCount > 0).length;

  // Per-evaluator summaries
  const evaluatorMap = new Map<string, { pass: number; warn: number; fail: number; na: number }>();
  for (const evaluator of ALL_EVALUATORS) {
    evaluatorMap.set(evaluator.id, { pass: 0, warn: 0, fail: 0, na: 0 });
  }

  for (const eval_ of evaluations) {
    for (const result of eval_.results) {
      const stats = evaluatorMap.get(result.evaluatorId);
      if (stats) {
        if (result.severity === "pass") stats.pass++;
        else if (result.severity === "warn") stats.warn++;
        else if (result.severity === "fail") stats.fail++;
      }
    }
    // Count N/A (evaluators not present in results)
    for (const [id, stats] of evaluatorMap) {
      if (!eval_.results.some((r) => r.evaluatorId === id)) {
        stats.na++;
      }
    }
  }

  const total = evaluations.length;
  const evaluatorSummaries: EvaluatorSummary[] = ALL_EVALUATORS.map((e) => {
    const stats = evaluatorMap.get(e.id)!;
    return {
      evaluatorId: e.id,
      name: e.name,
      passRate: total > 0 ? (stats.pass / total) * 100 : 0,
      warnRate: total > 0 ? (stats.warn / total) * 100 : 0,
      failRate: total > 0 ? (stats.fail / total) * 100 : 0,
      notApplicableCount: stats.na,
    };
  });

  return {
    averageScore: Math.round(averageScore * 100) / 100,
    allPassCount,
    warningCount,
    failureCount,
    evaluatorSummaries,
  };
}

/**
 * Build a ScanResult from evaluations.
 */
export function buildScanResult(
  repositories: string[],
  evaluations: PullRequestEvaluation[],
): ScanResult {
  const summary = computeSummary(evaluations);
  const now = new Date().toISOString();

  return {
    repositories,
    startedAt: evaluations.length > 0 ? evaluations[0].evaluatedAt : now,
    completedAt: now,
    totalPullRequests: evaluations.length,
    evaluatedPullRequests: evaluations.length,
    evaluations,
    summary,
  };
}

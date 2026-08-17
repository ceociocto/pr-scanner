import type { Evaluator } from "./evaluator.js";
import type { EnrichedPullRequest } from "../github/types.js";
import type { PrScannerConfig } from "../config/schema.js";
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
import { DescriptionQualityAiEvaluator } from "./ai/description-quality-ai.evaluator.js";
import { CodeRiskAiEvaluator } from "./ai/code-risk-ai.evaluator.js";
import { ReviewQualityAiEvaluator } from "./ai/review-quality-ai.evaluator.js";
import type { AiEvaluator } from "./ai/ai-evaluator.js";
import type { LlmClient } from "../ai/llm-client.js";
import type { TokenBudget } from "../ai/types.js";

/** All registered rule-based evaluators */
const RULE_EVALUATORS: Evaluator[] = [
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

/** All registered AI evaluators */
const AI_EVALUATORS: AiEvaluator[] = [
  new DescriptionQualityAiEvaluator(),
  new CodeRiskAiEvaluator(),
  new ReviewQualityAiEvaluator(),
];

/** All registered evaluators (rules only, AI added at runtime) */
const ALL_EVALUATORS: Evaluator[] = [...RULE_EVALUATORS];

/**
 * Get all registered rule-based evaluators.
 */
export function getRegisteredEvaluators(): Evaluator[] {
  return ALL_EVALUATORS;
}

/**
 * Initialize AI evaluators with LLM client and token budget.
 * Returns the list of AI evaluators that are ready to use.
 */
export function initAiEvaluators(
  config: PrScannerConfig,
  llmClient: LlmClient | null,
  tokenBudget: TokenBudget | null,
): AiEvaluator[] {
  if (!config.ai.enabled || !llmClient) {
    return [];
  }

  for (const evaluator of AI_EVALUATORS) {
    evaluator.setLlmClient(llmClient);
    evaluator.setTokenBudget(tokenBudget);
  }

  return AI_EVALUATORS;
}

/**
 * Run all enabled evaluators (rules + AI) against a single PR.
 */
export async function evaluatePR(
  pr: EnrichedPullRequest,
  config: PrScannerConfig,
  aiEvaluators: AiEvaluator[] = [],
): Promise<PullRequestEvaluation> {
  const allResults: EvaluationResult[] = [];

  // Run rule evaluators (sync)
  for (const evaluator of RULE_EVALUATORS) {
    if (!evaluator.isEnabled(config.standards)) {
      continue;
    }

    const results = evaluator.evaluate(pr, config.standards);
    const normalized = Array.isArray(results) ? results : [results];
    allResults.push(...normalized);
  }

  // Run AI evaluators (async) and build rule result map for context
  const ruleResultMap: Record<string, string> = {};
  for (const result of allResults) {
    ruleResultMap[result.evaluatorId] = `${result.severity}: ${result.message}`;
  }

  for (const evaluator of aiEvaluators) {
    if (!evaluator.isEnabled(config)) {
      continue;
    }

    // Inject rule results as context for AI evaluators
    if (evaluator instanceof CodeRiskAiEvaluator) {
      evaluator.getRuleEvalResults = () => ruleResultMap;
    }

    const results = await evaluator.evaluate(pr, config);
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

  // Collect all evaluator IDs from results across all PRs
  const allEvaluatorIds = new Set<string>();
  for (const eval_ of evaluations) {
    for (const result of eval_.results) {
      allEvaluatorIds.add(result.evaluatorId);
    }
  }

  // Per-evaluator summaries
  const evaluatorMap = new Map<string, { name: string; pass: number; warn: number; fail: number; na: number }>();
  for (const id of allEvaluatorIds) {
    const match = ALL_EVALUATORS.find((e) => e.id === id) ?? AI_EVALUATORS.find((e) => e.id === id);
    evaluatorMap.set(id, { name: match?.name ?? id, pass: 0, warn: 0, fail: 0, na: 0 });
  }

  const total = evaluations.length;
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

  const evaluatorSummaries: EvaluatorSummary[] = Array.from(evaluatorMap.entries()).map(
    ([id, stats]) => ({
      evaluatorId: id,
      name: stats.name,
      passRate: total > 0 ? (stats.pass / total) * 100 : 0,
      warnRate: total > 0 ? (stats.warn / total) * 100 : 0,
      failRate: total > 0 ? (stats.fail / total) * 100 : 0,
      notApplicableCount: stats.na,
    }),
  );

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

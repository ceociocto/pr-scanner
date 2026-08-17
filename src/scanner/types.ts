import type { EvaluationSeverity } from "../evaluators/evaluator.js";

/** Single evaluation result from one evaluator */
export interface EvaluationResult {
  evaluatorId: string;
  name: string;
  severity: EvaluationSeverity;
  message: string;
  score: number;
  metadata?: Record<string, unknown>;
  aiModel?: string;
  aiTokensUsed?: number;
}

/** Complete evaluation for one PR */
export interface PullRequestEvaluation {
  repository: string;
  pullNumber: number;
  pullTitle: string;
  author: string;
  mergedAt: string;
  url: string;
  results: EvaluationResult[];
  aggregateScore: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  evaluatedAt: string;
}

/** Summary for one evaluator across all PRs */
export interface EvaluatorSummary {
  evaluatorId: string;
  name: string;
  passRate: number;
  warnRate: number;
  failRate: number;
  notApplicableCount: number;
}

/** Overall scan summary */
export interface ScanSummary {
  averageScore: number;
  allPassCount: number;
  warningCount: number;
  failureCount: number;
  evaluatorSummaries: EvaluatorSummary[];
}

/** Complete scan result */
export interface ScanResult {
  repositories: string[];
  startedAt: string;
  completedAt: string;
  totalPullRequests: number;
  evaluatedPullRequests: number;
  evaluations: PullRequestEvaluation[];
  summary: ScanSummary;
}

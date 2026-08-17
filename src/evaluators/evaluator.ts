import type { EnrichedPullRequest } from "../github/types.js";
import type { StandardsConfig } from "../config/schema.js";

/** Severity levels for evaluation results */
export type EvaluationSeverity = "pass" | "warn" | "fail";

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

/** Interface that all evaluators must implement */
export interface Evaluator {
  /** Unique identifier for this evaluator */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Category for grouping in reports */
  readonly category: "structural" | "semi-automated" | "ai";
  /** Whether this evaluator is enabled in the current config */
  isEnabled(config: StandardsConfig): boolean;
  /** Evaluate a single PR (sync for rules, async for AI) */
  evaluate(
    pr: EnrichedPullRequest,
    config: StandardsConfig,
  ): EvaluationResult | EvaluationResult[] | Promise<EvaluationResult | EvaluationResult[]>;
}

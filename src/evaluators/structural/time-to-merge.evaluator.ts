import type { Evaluator, EvaluationResult } from "../evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { StandardsConfig } from "../../config/schema.js";
import { formatDuration } from "../../utils/time.js";

export class TimeToMergeEvaluator implements Evaluator {
  readonly id = "time-to-merge";
  readonly name = "Time to Merge";
  readonly category = "structural" as const;

  isEnabled(config: StandardsConfig): boolean {
    return config.timeToMerge.enabled;
  }

  evaluate(pr: EnrichedPullRequest, config: StandardsConfig): EvaluationResult {
    if (pr.timeToMergeMs === null) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "warn",
        message: "Merge time not available",
        score: 1,
      };
    }

    const hours = pr.timeToMergeMs / 3_600_000;
    const warningHours = config.timeToMerge.warningHours;
    const criticalHours = config.timeToMerge.criticalHours;

    if (hours <= warningHours) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "pass",
        message: `Merged in ${formatDuration(pr.timeToMergeMs)} (within ${warningHours}h threshold)`,
        score: 2,
        metadata: { hours: Math.round(hours * 10) / 10, ms: pr.timeToMergeMs },
      };
    }

    if (hours <= criticalHours) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "warn",
        message: `Merged in ${formatDuration(pr.timeToMergeMs)} (exceeds ${warningHours}h warning)`,
        score: 1,
        metadata: { hours: Math.round(hours * 10) / 10, ms: pr.timeToMergeMs },
      };
    }

    return {
      evaluatorId: this.id,
      name: this.name,
      severity: "fail",
      message: `Merged in ${formatDuration(pr.timeToMergeMs)} (exceeds ${criticalHours}h critical)`,
      score: 0,
      metadata: { hours: Math.round(hours * 10) / 10, ms: pr.timeToMergeMs },
    };
  }
}

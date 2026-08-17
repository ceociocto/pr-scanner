import type { Evaluator, EvaluationResult } from "../evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { StandardsConfig } from "../../config/schema.js";
import { formatDuration } from "../../utils/time.js";

export class TimeToReviewEvaluator implements Evaluator {
  readonly id = "time-to-review";
  readonly name = "Time to First Review";
  readonly category = "structural" as const;

  isEnabled(config: StandardsConfig): boolean {
    return config.timeToReview.enabled;
  }

  evaluate(pr: EnrichedPullRequest, config: StandardsConfig): EvaluationResult {
    if (pr.timeToFirstReviewMs === null) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "warn",
        message: "No reviews submitted",
        score: 1,
      };
    }

    const hours = pr.timeToFirstReviewMs / 3_600_000;
    const warningHours = config.timeToReview.warningHours;

    if (hours <= warningHours) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "pass",
        message: `First review in ${formatDuration(pr.timeToFirstReviewMs)} (within ${warningHours}h)`,
        score: 2,
        metadata: { hours: Math.round(hours * 10) / 10, ms: pr.timeToFirstReviewMs },
      };
    }

    return {
      evaluatorId: this.id,
      name: this.name,
      severity: "warn",
      message: `First review took ${formatDuration(pr.timeToFirstReviewMs)} (exceeds ${warningHours}h)`,
      score: 1,
      metadata: { hours: Math.round(hours * 10) / 10, ms: pr.timeToFirstReviewMs },
    };
  }
}

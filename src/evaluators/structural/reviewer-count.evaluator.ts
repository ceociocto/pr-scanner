import type { Evaluator, EvaluationResult } from "../evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { StandardsConfig } from "../../config/schema.js";

export class ReviewerCountEvaluator implements Evaluator {
  readonly id = "reviewer-count";
  readonly name = "Reviewer Count";
  readonly category = "structural" as const;

  isEnabled(config: StandardsConfig): boolean {
    return config.reviewerCount.enabled;
  }

  evaluate(pr: EnrichedPullRequest, config: StandardsConfig): EvaluationResult {
    const approvers = new Set(
      pr.reviews.filter((r) => r.state === "APPROVED").map((r) => r.author),
    );
    const count = approvers.size;

    if (count >= config.reviewerCount.minimum) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "pass",
        message: `${count} reviewer${count !== 1 ? "s" : ""} approved (minimum: ${config.reviewerCount.minimum})`,
        score: 2,
        metadata: { approvers: Array.from(approvers), count },
      };
    }

    return {
      evaluatorId: this.id,
      name: this.name,
      severity: "fail",
      message: `Only ${count} reviewer approved (minimum: ${config.reviewerCount.minimum})`,
      score: 0,
      metadata: { approvers: Array.from(approvers), count },
    };
  }
}

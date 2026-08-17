import type { Evaluator, EvaluationResult } from "../evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { StandardsConfig } from "../../config/schema.js";

export class RevertRateEvaluator implements Evaluator {
  readonly id = "revert-rate";
  readonly name = "Revert Detection";
  readonly category = "semi-automated" as const;

  isEnabled(config: StandardsConfig): boolean {
    return config.revertRate.enabled;
  }

  evaluate(pr: EnrichedPullRequest, _config: StandardsConfig): EvaluationResult {
    // This is a simplified check — a full implementation would search for
    // subsequent PRs that revert this one's merge commit
    const titleLower = pr.pullRequest.title.toLowerCase();
    const wasReverted = titleLower.includes("revert");

    if (wasReverted) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "warn",
        message: "This PR appears to be a revert of a previous change",
        score: 1,
        metadata: { title: pr.pullRequest.title },
      };
    }

    return {
      evaluatorId: this.id,
      name: this.name,
      severity: "pass",
      message: "No revert indicators detected",
      score: 2,
      metadata: {},
    };
  }
}

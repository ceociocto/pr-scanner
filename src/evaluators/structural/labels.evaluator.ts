import type { Evaluator, EvaluationResult } from "../evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { StandardsConfig } from "../../config/schema.js";

export class LabelsEvaluator implements Evaluator {
  readonly id = "labels";
  readonly name = "Labels";
  readonly category = "structural" as const;

  isEnabled(config: StandardsConfig): boolean {
    return config.labels.enabled;
  }

  evaluate(pr: EnrichedPullRequest, config: StandardsConfig): EvaluationResult {
    const requiredLabels = config.labels.requiredLabels;
    if (!requiredLabels || requiredLabels.length === 0) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "pass",
        message: "No required labels configured",
        score: 2,
      };
    }

    const prLabels = new Set(pr.pullRequest.labels);
    const hasRequired = requiredLabels.some((label) => prLabels.has(label));

    if (hasRequired) {
      const matching = requiredLabels.filter((l) => prLabels.has(l));
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "pass",
        message: `Has required label(s): ${matching.join(", ")}`,
        score: 2,
        metadata: { labels: pr.pullRequest.labels, matching },
      };
    }

    return {
      evaluatorId: this.id,
      name: this.name,
      severity: "fail",
      message: `Missing required label(s). Has: [${pr.pullRequest.labels.join(", ")}], needs one of: [${requiredLabels.join(", ")}]`,
      score: 0,
      metadata: { labels: pr.pullRequest.labels, required: requiredLabels },
    };
  }
}

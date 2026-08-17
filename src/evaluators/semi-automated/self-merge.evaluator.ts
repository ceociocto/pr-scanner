import type { Evaluator, EvaluationResult } from "../evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { StandardsConfig } from "../../config/schema.js";

export class SelfMergeEvaluator implements Evaluator {
  readonly id = "self-merge";
  readonly name = "Self-Merge Detection";
  readonly category = "semi-automated" as const;

  isEnabled(config: StandardsConfig): boolean {
    return config.selfMerge.enabled;
  }

  evaluate(pr: EnrichedPullRequest, _config: StandardsConfig): EvaluationResult {
    if (pr.isSelfMerge) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "fail",
        message: `PR merged by author (${pr.pullRequest.author.login}) without any review approvals`,
        score: 0,
        metadata: {
          author: pr.pullRequest.author.login,
          mergedBy: pr.pullRequest.mergedBy?.login,
          approvalCount: pr.reviews.filter((r) => r.state === "APPROVED").length,
        },
      };
    }

    return {
      evaluatorId: this.id,
      name: this.name,
      severity: "pass",
      message: "PR was merged by another reviewer or had approvals",
      score: 2,
      metadata: {
        author: pr.pullRequest.author.login,
        mergedBy: pr.pullRequest.mergedBy?.login,
      },
    };
  }
}

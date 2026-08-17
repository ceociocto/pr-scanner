import type { Evaluator, EvaluationResult } from "../evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { StandardsConfig } from "../../config/schema.js";

export class PrSizeEvaluator implements Evaluator {
  readonly id = "pr-size";
  readonly name = "PR Size";
  readonly category = "structural" as const;

  isEnabled(config: StandardsConfig): boolean {
    return config.prSize.enabled;
  }

  evaluate(pr: EnrichedPullRequest, config: StandardsConfig): EvaluationResult {
    const lines = pr.pullRequest.additions + pr.pullRequest.deletions;

    if (lines <= config.prSize.ideal) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "pass",
        message: `${lines} lines changed (within ideal threshold of ${config.prSize.ideal})`,
        score: 2,
        metadata: { lines, additions: pr.pullRequest.additions, deletions: pr.pullRequest.deletions },
      };
    }

    if (lines <= config.prSize.warning) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "warn",
        message: `${lines} lines changed (above ideal ${config.prSize.ideal}, within warning ${config.prSize.warning})`,
        score: 1,
        metadata: { lines, additions: pr.pullRequest.additions, deletions: pr.pullRequest.deletions },
      };
    }

    return {
      evaluatorId: this.id,
      name: this.name,
      severity: "fail",
      message: `${lines} lines changed (exceeds warning threshold of ${config.prSize.warning})`,
      score: 0,
      metadata: { lines, additions: pr.pullRequest.additions, deletions: pr.pullRequest.deletions },
    };
  }
}

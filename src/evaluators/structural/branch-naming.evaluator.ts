import type { Evaluator, EvaluationResult } from "../evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { StandardsConfig } from "../../config/schema.js";
import { buildRegex } from "../../utils/regex.js";

export class BranchNamingEvaluator implements Evaluator {
  readonly id = "branch-naming";
  readonly name = "Branch Naming";
  readonly category = "structural" as const;

  isEnabled(config: StandardsConfig): boolean {
    return config.branchNaming.enabled;
  }

  evaluate(pr: EnrichedPullRequest, config: StandardsConfig): EvaluationResult {
    const branchName = pr.pullRequest.headRef;
    const pattern = buildRegex(config.branchNaming.pattern);

    if (pattern.test(branchName)) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "pass",
        message: `Branch "${branchName}" follows naming convention`,
        score: 2,
        metadata: { branch: branchName },
      };
    }

    return {
      evaluatorId: this.id,
      name: this.name,
      severity: "fail",
      message: `Branch "${branchName}" does not follow naming convention pattern`,
      score: 0,
      metadata: { branch: branchName, pattern: config.branchNaming.pattern },
    };
  }
}

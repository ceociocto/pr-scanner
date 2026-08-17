import type { Evaluator, EvaluationResult } from "../evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { StandardsConfig } from "../../config/schema.js";

export class CodeChurnEvaluator implements Evaluator {
  readonly id = "code-churn";
  readonly name = "Code Churn";
  readonly category = "semi-automated" as const;

  isEnabled(config: StandardsConfig): boolean {
    return config.codeChurn.enabled;
  }

  evaluate(pr: EnrichedPullRequest, config: StandardsConfig): EvaluationResult {
    const files = pr.pullRequest.changedFiles;

    if (files <= config.codeChurn.maxFilesWarning) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "pass",
        message: `${files} files changed (within ${config.codeChurn.maxFilesWarning} threshold)`,
        score: 2,
        metadata: {
          files,
          additions: pr.pullRequest.additions,
          deletions: pr.pullRequest.deletions,
        },
      };
    }

    return {
      evaluatorId: this.id,
      name: this.name,
      severity: "warn",
      message: `${files} files changed (exceeds ${config.codeChurn.maxFilesWarning} threshold)`,
      score: 1,
      metadata: { files, additions: pr.pullRequest.additions, deletions: pr.pullRequest.deletions },
    };
  }
}

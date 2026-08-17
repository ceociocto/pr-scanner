import type { Evaluator, EvaluationResult } from "../evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { StandardsConfig } from "../../config/schema.js";
import { buildRegex, CONVENTIONAL_COMMITS_PATTERN } from "../../utils/regex.js";

export class CommitConventionEvaluator implements Evaluator {
  readonly id = "commit-convention";
  readonly name = "Commit Convention";
  readonly category = "structural" as const;

  isEnabled(config: StandardsConfig): boolean {
    return config.commitConvention.enabled;
  }

  evaluate(pr: EnrichedPullRequest, config: StandardsConfig): EvaluationResult[] {
    if (pr.commits.length === 0) {
      return [
        {
          evaluatorId: this.id,
          name: this.name,
          severity: "warn",
          message: "No commits found in PR",
          score: 1,
        },
      ];
    }

    const pattern = config.commitConvention.pattern
      ? buildRegex(config.commitConvention.pattern)
      : CONVENTIONAL_COMMITS_PATTERN;

    const results: EvaluationResult[] = [];
    let allPass = true;

    for (const commit of pr.commits) {
      const firstLine = commit.message.split("\n")[0];
      const passes = pattern.test(firstLine);

      if (!passes) {
        allPass = false;
        results.push({
          evaluatorId: this.id,
          name: this.name,
          severity: "fail",
          message: `Commit ${commit.sha.slice(0, 7)} does not follow convention: "${firstLine.slice(0, 60)}"`,
          score: 0,
          metadata: { sha: commit.sha, message: firstLine },
        });
      }
    }

    if (allPass) {
      return [
        {
          evaluatorId: this.id,
          name: this.name,
          severity: "pass",
          message: `All ${pr.commits.length} commits follow convention`,
          score: 2,
          metadata: { commitCount: pr.commits.length },
        },
      ];
    }

    return results;
  }
}

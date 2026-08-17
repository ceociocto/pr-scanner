import type { Evaluator, EvaluationResult } from "../evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { StandardsConfig } from "../../config/schema.js";
import { buildRegex } from "../../utils/regex.js";

export class LinkedIssuesEvaluator implements Evaluator {
  readonly id = "linked-issues";
  readonly name = "Linked Issues";
  readonly category = "structural" as const;

  isEnabled(config: StandardsConfig): boolean {
    return config.linkedIssues.enabled;
  }

  evaluate(pr: EnrichedPullRequest, config: StandardsConfig): EvaluationResult {
    const body = pr.pullRequest.body ?? "";
    const title = pr.pullRequest.title;
    const pattern = buildRegex(config.linkedIssues.issuePattern);

    const bodyMatches = body.match(pattern);
    const titleMatches = title.match(pattern);
    const matches = [...new Set([...(bodyMatches ?? []), ...(titleMatches ?? [])])];

    if (matches.length > 0) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "pass",
        message: `References issue(s): ${matches.join(", ")}`,
        score: 2,
        metadata: {
          issues: matches,
          source: { inBody: bodyMatches?.length ?? 0, inTitle: titleMatches?.length ?? 0 },
        },
      };
    }

    return {
      evaluatorId: this.id,
      name: this.name,
      severity: "fail",
      message: "No linked issues found in PR title or description",
      score: 0,
      metadata: { issues: [] },
    };
  }
}

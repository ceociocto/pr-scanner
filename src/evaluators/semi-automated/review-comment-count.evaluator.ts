import type { Evaluator, EvaluationResult } from "../evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { StandardsConfig } from "../../config/schema.js";

export class ReviewCommentCountEvaluator implements Evaluator {
  readonly id = "review-comment-count";
  readonly name = "Review Comment Count";
  readonly category = "semi-automated" as const;

  isEnabled(config: StandardsConfig): boolean {
    return config.reviewCommentCount.enabled;
  }

  evaluate(pr: EnrichedPullRequest, config: StandardsConfig): EvaluationResult[] {
    const comments = pr.reviews.filter((r) => r.body && r.body.trim().length > 0).length;
    const results: EvaluationResult[] = [];

    // Check for zero comments
    if (comments === 0 && config.reviewCommentCount.warnZeroComments) {
      results.push({
        evaluatorId: this.id,
        name: this.name,
        severity: "warn",
        message: "No review comments found on this PR",
        score: 1,
        metadata: { commentCount: comments },
      });
    }

    // Check for high comment count
    if (comments > config.reviewCommentCount.highCommentThreshold) {
      results.push({
        evaluatorId: this.id,
        name: this.name,
        severity: "warn",
        message: `${comments} review comments (exceeds ${config.reviewCommentCount.highCommentThreshold} threshold)`,
        score: 1,
        metadata: { commentCount: comments },
      });
    }

    // If no warnings, it passes
    if (results.length === 0) {
      return [
        {
          evaluatorId: this.id,
          name: this.name,
          severity: "pass",
          message: `${comments} review comments (within normal range)`,
          score: 2,
          metadata: { commentCount: comments },
        },
      ];
    }

    return results;
  }
}

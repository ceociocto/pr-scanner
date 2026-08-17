import { AiEvaluator } from "./ai-evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { PrScannerConfig } from "../../config/schema.js";
import type { PromptContext } from "../../ai/types.js";
import {
  REVIEW_QUALITY_SYSTEM_PROMPT,
  REVIEW_QUALITY_USER_PROMPT,
} from "./prompts/review-quality.prompt.js";

/**
 * AI evaluator that assesses review quality.
 * Distinguishes between substantive code reviews and ceremonial "LGTM" approvals.
 */
export class ReviewQualityAiEvaluator extends AiEvaluator {
  readonly id = "review-quality-ai";
  readonly name = "审核实质程度 (AI)";
  readonly category = "ai";

  protected getConfigKey(): string {
    return "reviewQuality";
  }

  protected getSystemPromptTemplate(): string {
    return REVIEW_QUALITY_SYSTEM_PROMPT;
  }

  protected getUserPromptTemplate(): string {
    return REVIEW_QUALITY_USER_PROMPT;
  }

  protected buildContext(pr: EnrichedPullRequest, _config: PrScannerConfig): PromptContext {
    const approved = pr.reviews.filter((r) => r.state === "APPROVED");
    const changesRequested = pr.reviews.filter((r) => r.state === "CHANGES_REQUESTED");
    const commented = pr.reviews.filter((r) => r.state === "COMMENTED");

    const reviewDetails = pr.reviews.map((r) => {
      const bodySnippet = r.body ? r.body.slice(0, 200) : "(no comment)";
      return `  - **${r.author}** (${r.state}): "${bodySnippet}"`;
    });

    return {
      title: pr.pullRequest.title,
      author: pr.pullRequest.author.login,
      body: pr.pullRequest.body || "(no description provided)",
      reviews: reviewDetails.join("\n") || "  (no reviews)",
      reviewCount: String(pr.reviews.length),
      approvedCount: String(approved.length),
      changesRequestedCount: String(changesRequested.length),
      commentedCount: String(commented.length),
    };
  }
}

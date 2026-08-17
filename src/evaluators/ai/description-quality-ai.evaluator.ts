import { AiEvaluator } from "./ai-evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { PrScannerConfig } from "../../config/schema.js";
import type { PromptContext } from "../../ai/types.js";
import {
  DESCRIPTION_QUALITY_SYSTEM_PROMPT,
  DESCRIPTION_QUALITY_USER_PROMPT,
} from "./prompts/description-quality.prompt.js";

/**
 * AI evaluator that assesses PR description quality.
 * Checks whether the description explains motivation, impact, testing, and rollback.
 */
export class DescriptionQualityAiEvaluator extends AiEvaluator {
  readonly id = "description-quality-ai";
  readonly name = "描述质量 (AI)";
  readonly category = "ai";

  protected getConfigKey(): string {
    return "descriptionQuality";
  }

  protected getSystemPromptTemplate(): string {
    return DESCRIPTION_QUALITY_SYSTEM_PROMPT;
  }

  protected getUserPromptTemplate(): string {
    return DESCRIPTION_QUALITY_USER_PROMPT;
  }

  protected buildContext(pr: EnrichedPullRequest, _config: PrScannerConfig): PromptContext {
    return {
      title: pr.pullRequest.title,
      body: pr.pullRequest.body || "(no description provided)",
      author: pr.pullRequest.author.login,
      headRef: pr.pullRequest.headRef,
      baseRef: pr.pullRequest.baseRef,
      changedFiles: String(pr.pullRequest.changedFiles),
      additions: String(pr.pullRequest.additions),
      deletions: String(pr.pullRequest.deletions),
      linkedIssues: this.extractLinkedIssues(pr),
    };
  }

  private extractLinkedIssues(pr: EnrichedPullRequest): string {
    const body = pr.pullRequest.body || "";
    const matches = body.match(/#\d+|[A-Z]+-\d+/g);
    return matches ? matches.join(", ") : "none";
  }
}

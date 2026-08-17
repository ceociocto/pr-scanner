import { AiEvaluator } from "./ai-evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { PrScannerConfig } from "../../config/schema.js";
import type { PromptContext } from "../../ai/types.js";
import { CODE_RISK_SYSTEM_PROMPT, CODE_RISK_USER_PROMPT } from "./prompts/code-risk.prompt.js";

/**
 * AI evaluator that assesses code change risk.
 * Checks for security vulnerabilities, performance issues, architecture deviations, and tech debt.
 */
export class CodeRiskAiEvaluator extends AiEvaluator {
  readonly id = "code-risk-ai";
  readonly name = "代码风险 (AI)";
  readonly category = "ai";

  protected getConfigKey(): string {
    return "codeRisk";
  }

  protected getSystemPromptTemplate(): string {
    return CODE_RISK_SYSTEM_PROMPT;
  }

  protected getUserPromptTemplate(): string {
    return CODE_RISK_USER_PROMPT;
  }

  protected buildContext(pr: EnrichedPullRequest, config: PrScannerConfig): PromptContext {
    // Build a summary of rule-based evaluation results to provide as context
    const evaluations = this.getRuleEvalResults?.() ?? {};

    return {
      title: pr.pullRequest.title,
      body: pr.pullRequest.body || "(no description provided)",
      changedFiles: String(pr.pullRequest.changedFiles),
      additions: String(pr.pullRequest.additions),
      deletions: String(pr.pullRequest.deletions),
      commitMessages: pr.commits.map((c) => `  - ${c.message}`).join("\n"),
      linkedIssues: this.extractLinkedIssues(pr),
      prSizeResult: evaluations["pr-size"] ?? "not evaluated",
      ciStatusResult: evaluations["ci-status"] ?? "not evaluated",
      selfMergeResult: evaluations["self-merge"] ?? "not evaluated",
    };
  }

  /**
   * Optional callback to get prior rule-based evaluation results.
   * Set by the scanner before evaluation to provide context.
   */
  getRuleEvalResults?: () => Record<string, string>;

  private extractLinkedIssues(pr: EnrichedPullRequest): string {
    const body = pr.pullRequest.body || "";
    const matches = body.match(/#\d+|[A-Z]+-\d+/g);
    return matches ? matches.join(", ") : "none";
  }
}

import type { EnrichedPullRequest } from "../../github/types.js";
import type { PrScannerConfig } from "../../config/schema.js";
import type { Evaluator, EvaluationResult } from "../evaluator.js";
import type { LlmClient } from "../../ai/llm-client.js";
import type { TokenBudget } from "../../ai/types.js";
import { LlmError, TokenBudgetExceededError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type { PromptContext } from "../../ai/types.js";
import { buildPrompt } from "../../ai/prompt-template.js";
import type { AiEvaluationResult } from "../../ai/types.js";
import { estimateTokens } from "../../ai/token-counter.js";

/**
 * Abstract base class for AI-powered evaluators.
 * Encapsulates LLM calling, result parsing, token budget checking, and caching.
 */
export abstract class AiEvaluator implements Evaluator {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly category: string;

  private llmClient: LlmClient | null = null;
  private tokenBudget: TokenBudget | null = null;

  /** Set the LLM client (injected by the scanner before evaluation) */
  setLlmClient(client: LlmClient): void {
    this.llmClient = client;
  }

  /** Set the token budget tracker */
  setTokenBudget(budget: TokenBudget): void {
    this.tokenBudget = budget;
  }

  isEnabled(config: PrScannerConfig): boolean {
    if (!config.ai.enabled) return false;
    const key = this.getConfigKey();
    if (!key) return true; // enabled by default if AI is on
    return (config.ai.evaluators as any)[key]?.enabled ?? true;
  }

  async evaluate(
    pr: EnrichedPullRequest,
    config: PrScannerConfig,
  ): Promise<EvaluationResult> {
    if (!this.llmClient) {
      return this.skipResult("LLM client not configured");
    }

    // Check token budget
    if (this.tokenBudget?.isExceeded()) {
      logger.warn(`Token budget exceeded, skipping ${this.id} for PR #${pr.pullRequest.number}`);
      return this.skipResult("Token budget exceeded");
    }

    // Check if this specific AI evaluator is enabled
    if (!this.isEnabled(config)) {
      return this.skipResult("AI evaluator disabled in config");
    }

    try {
      const context = this.buildContext(pr, config);
      const { system, user } = buildPrompt(
        this.getSystemPromptTemplate(),
        this.getUserPromptTemplate(),
        context,
      );

      // Estimate prompt tokens and check budget
      const estimatedTokens = estimateTokens(system + user);
      if (this.tokenBudget && this.tokenBudget.remaining() < estimatedTokens) {
        logger.warn(`Insufficient token budget for ${this.id}, skipping PR #${pr.pullRequest.number}`);
        return this.skipResult("Insufficient token budget");
      }

      const result = await this.llmClient.generateStructured<AiEvaluationResult>(
        system,
        user,
        AI_EVAL_SCHEMA,
      );

      // Record token usage
      if (result.usage && this.tokenBudget) {
        this.tokenBudget.record(result.usage.totalTokens);
      }

      // Warn if near budget limit
      if (this.tokenBudget?.isNearLimit()) {
        logger.warn(
          `Token budget near limit: ${this.tokenBudget.used}/${this.tokenBudget.total} used`,
        );
      }

      logger.debug(
        `${this.id} for PR #${pr.pullRequest.number}: ${result.data.severity} — ${result.data.message}`,
      );

      return {
        evaluatorId: this.id,
        name: this.name,
        severity: result.data.severity,
        message: result.data.message,
        score: result.data.severity === "pass" ? 2 : result.data.severity === "warn" ? 1 : 0,
        metadata: {
          details: result.data.details,
          suggestion: result.data.suggestion,
        },
        aiModel: result.model,
        aiTokensUsed: result.usage?.totalTokens,
      };
    } catch (error) {
      if (error instanceof LlmError) {
        logger.warn(`AI evaluation ${this.id} failed for PR #${pr.pullRequest.number}: ${error.message}`);
        return this.skipResult(`AI error: ${error.message}`);
      }
      throw error;
    }
  }

  /** Get the config key for this evaluator (e.g. "descriptionQuality") */
  protected abstract getConfigKey(): string | null;

  /** Build context variables for prompt templates */
  protected abstract buildContext(pr: EnrichedPullRequest, config: PrScannerConfig): PromptContext;

  /** Get the system prompt template */
  protected abstract getSystemPromptTemplate(): string;

  /** Get the user prompt template */
  protected abstract getUserPromptTemplate(): string;

  private skipResult(reason: string): EvaluationResult {
    return {
      evaluatorId: this.id,
      name: `${this.name} (skipped)`,
      severity: "pass",
      message: reason,
      score: 2,
      metadata: { skipped: true, reason },
    };
  }
}

/** JSON schema for structured AI evaluation output */
const AI_EVAL_SCHEMA = {
  type: "object",
  properties: {
    severity: {
      type: "string",
      enum: ["pass", "warn", "fail"],
    },
    message: {
      type: "string",
      description: "One-sentence summary of the evaluation",
    },
    details: {
      type: "object",
      additionalProperties: { type: "string" },
      description: "Optional breakdown by sub-dimension",
    },
    suggestion: {
      type: "string",
      description: "Specific actionable improvement suggestion (if applicable)",
    },
  },
  required: ["severity", "message"],
};

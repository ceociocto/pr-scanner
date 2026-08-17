import type { LlmClient, LlmResponse, LlmStructuredResponse } from "../../ai/llm-client.js";
import type { AiEvaluationResult } from "../../ai/types.js";

export interface MockLlmConfig {
  /** Pre-configured responses keyed by a substring of the system prompt */
  responses?: Record<string, AiEvaluationResult>;
  /** Default response when no match found */
  defaultResponse?: AiEvaluationResult;
  /** Simulate token usage */
  tokensUsed?: number;
  /** Simulate errors */
  shouldError?: boolean;
  /** Simulate delay */
  delayMs?: number;
}

/**
 * Mock LLM client for testing AI evaluators without real API calls.
 */
export class MockLlmClient implements LlmClient {
  readonly provider = "mock";
  readonly model = "mock-model";

  private config: MockLlmConfig;

  constructor(config: MockLlmConfig = {}) {
    this.config = config;
  }

  async generateText(systemPrompt: string, _userPrompt: string): Promise<LlmResponse> {
    if (this.config.delayMs) {
      await sleep(this.config.delayMs);
    }

    if (this.config.shouldError) {
      throw new Error("Mock LLM error");
    }

    const response = this.findResponse(systemPrompt);
    return {
      text: JSON.stringify(response),
      usage: {
        promptTokens: this.config.tokensUsed ?? 100,
        completionTokens: this.config.tokensUsed ?? 50,
        totalTokens: this.config.tokensUsed ?? 150,
      },
      model: this.model,
    };
  }

  async generateStructured<T>(
    systemPrompt: string,
    _userPrompt: string,
    _schema: Record<string, unknown>,
  ): Promise<LlmStructuredResponse<T>> {
    if (this.config.delayMs) {
      await sleep(this.config.delayMs);
    }

    if (this.config.shouldError) {
      throw new Error("Mock LLM error");
    }

    const response = this.findResponse(systemPrompt);
    return {
      text: JSON.stringify(response),
      data: response as T,
      usage: {
        promptTokens: this.config.tokensUsed ?? 100,
        completionTokens: this.config.tokensUsed ?? 50,
        totalTokens: this.config.tokensUsed ?? 150,
      },
      model: this.model,
    };
  }

  private findResponse(systemPrompt: string): AiEvaluationResult {
    // Find matching response by system prompt substring
    for (const [key, value] of Object.entries(this.config.responses ?? {})) {
      if (systemPrompt.includes(key)) {
        return value;
      }
    }

    // Default response
    return (
      this.config.defaultResponse ?? {
        severity: "pass",
        message: "Mock evaluation: looks good",
      }
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

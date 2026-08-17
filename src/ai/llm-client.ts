import type { LanguageModel } from "ai";
import type {
  LlmClientConfig,
  LlmResponse,
  LlmStructuredResponse,
  PromptContext,
} from "./types.js";

/**
 * Abstract LLM client interface.
 * Concrete implementations wrap Vercel AI SDK model instances.
 */
export interface LlmClient {
  /** Generate a text response */
  generateText(systemPrompt: string, userPrompt: string): Promise<LlmResponse>;

  /** Generate a structured JSON response */
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: Record<string, unknown>,
  ): Promise<LlmStructuredResponse<T>>;

  /** The provider type */
  readonly provider: string;

  /** The model name */
  readonly model: string;
}

/**
 * Create an LLM client from a Vercel AI SDK LanguageModel.
 */
export function createLlmClient(config: LlmClientConfig, model: LanguageModel): LlmClient {
  return new AiSdkLlmClient(config, model);
}

/** Concrete implementation using Vercel AI SDK */
class AiSdkLlmClient implements LlmClient {
  private aiModel: LanguageModel;
  private config: LlmClientConfig;

  constructor(config: LlmClientConfig, model: LanguageModel) {
    this.config = config;
    this.aiModel = model;
  }

  get provider() {
    return this.config.provider;
  }

  get model() {
    return this.config.model;
  }

  async generateText(systemPrompt: string, userPrompt: string): Promise<LlmResponse> {
    const { generateText } = await import("ai");
    const { withRetry } = await import("./retry-strategy.js");

    return withRetry(
      async () => {
        const result = await generateText({
          model: this.aiModel,
          system: systemPrompt,
          prompt: userPrompt,
          maxTokens: this.config.maxTokens,
          abortSignal: AbortSignal.timeout(this.config.timeoutMs),
        });

        return {
          text: result.text,
          usage: result.usage
            ? {
                promptTokens: result.usage.promptTokens,
                completionTokens: result.usage.completionTokens,
                totalTokens: result.usage.promptTokens + result.usage.completionTokens,
              }
            : undefined,
          model: this.config.model,
        };
      },
      { maxRetries: this.config.maxRetries },
    );
  }

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: Record<string, unknown>,
  ): Promise<LlmStructuredResponse<T>> {
    const { generateObject } = await import("ai");
    const { withRetry } = await import("./retry-strategy.js");

    return withRetry(
      async () => {
        const result = await generateObject<T>({
          model: this.aiModel,
          system: systemPrompt,
          prompt: userPrompt,
          schema: schema as any,
          maxTokens: this.config.maxTokens,
          abortSignal: AbortSignal.timeout(this.config.timeoutMs),
        });

        return {
          text: JSON.stringify(result.object),
          data: result.object,
          usage: result.usage
            ? {
                promptTokens: result.usage.promptTokens,
                completionTokens: result.usage.completionTokens,
                totalTokens: result.usage.promptTokens + result.usage.completionTokens,
              }
            : undefined,
          model: this.config.model,
        };
      },
      { maxRetries: this.config.maxRetries },
    );
  }
}

import type { LanguageModel } from "ai";
import type { LlmClient, LlmClientConfig } from "./llm-client.js";
import { createLlmClient } from "./llm-client.js";
import { LlmError } from "../utils/errors.js";

/**
 * Create an LLM client based on AI configuration.
 * Supports Anthropic, OpenAI, and Ollama providers via Vercel AI SDK.
 */
export async function createLlmFromConfig(config: {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokensPerRequest: number;
  timeoutMs: number;
  maxRetries: number;
}): Promise<LlmClient> {
  const clientConfig: LlmClientConfig = {
    provider: config.provider as any,
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    maxTokens: config.maxTokensPerRequest,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
  };

  const model = await createModel(config);

  return createLlmClient(clientConfig, model);
}

/**
 * Create a Vercel AI SDK LanguageModel based on provider configuration.
 */
async function createModel(config: {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}): Promise<LanguageModel> {
  switch (config.provider) {
    case "anthropic": {
      if (!config.apiKey) {
        throw new LlmError("Anthropic API key is required. Set ai.apiKey or ANTHROPIC_API_KEY.");
      }
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      const provider = createAnthropic({ apiKey: config.apiKey });
      return provider(config.model);
    }

    case "openai": {
      if (!config.apiKey) {
        throw new LlmError("OpenAI API key is required. Set ai.apiKey or OPENAI_API_KEY.");
      }
      const { createOpenAI } = await import("@ai-sdk/openai");
      const provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
      return provider(config.model);
    }

    case "ollama": {
      const { createOllama } = await import("ollama-ai-provider");
      const provider = createOllama({
        baseURL: config.baseUrl ?? "http://localhost:11434",
      });
      return provider(config.model);
    }

    default:
      throw new LlmError(`Unsupported AI provider: ${config.provider}. Supported: anthropic, openai, ollama.`);
  }
}

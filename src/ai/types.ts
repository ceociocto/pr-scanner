/** AI/LLM related types */

/** Supported AI providers */
export type AiProviderType = "anthropic" | "openai" | "ollama";

/** LLM response from a generate call */
export interface LlmResponse {
  /** The text content of the response */
  text: string;
  /** Tokens used (if available from provider) */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** The model that was used */
  model: string;
}

/** Structured output response (parsed from JSON) */
export interface LlmStructuredResponse<T> extends LlmResponse {
  /** The parsed structured data */
  data: T;
}

/** LLM client configuration */
export interface LlmClientConfig {
  provider: AiProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  timeoutMs: number;
  maxRetries: number;
}

/** Token budget tracker */
export interface TokenBudget {
  /** Total budget for a scan */
  total: number;
  /** Tokens used so far */
  used: number;
  /** Percentage at which to warn */
  warnPercent: number;
  /** Check if budget is exceeded */
  isExceeded(): boolean;
  /** Check if budget is near the warning threshold */
  isNearLimit(): boolean;
  /** Record token usage */
  record(tokens: number): void;
  /** Remaining tokens */
  remaining(): number;
}

/** Prompt variable context */
export type PromptContext = Record<string, string | number | boolean | undefined>;

/** AI evaluation result from LLM */
export interface AiEvaluationResult {
  severity: "pass" | "warn" | "fail";
  message: string;
  /** Optional detailed breakdown */
  details?: Record<string, string>;
  /** Optional suggestion for improvement */
  suggestion?: string;
}

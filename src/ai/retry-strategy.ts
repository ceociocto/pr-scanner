import { LlmError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Execute an async operation with exponential backoff retry.
 * Retries on rate limit errors (429) and server errors (5xx).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (except 429 rate limit)
      if (error instanceof LlmError && !isRetryable(error)) {
        throw error;
      }

      // Don't retry after last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      const delay = Math.min(opts.baseDelayMs * Math.pow(2, attempt), opts.maxDelayMs);
      logger.warn(
        `LLM request failed (attempt ${attempt + 1}/${opts.maxRetries + 1}), retrying in ${delay}ms...`,
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryable(error: LlmError): boolean {
  const msg = error.message.toLowerCase();
  // Retry on rate limit, timeout, and server errors
  return (
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("timeout") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("overloaded")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

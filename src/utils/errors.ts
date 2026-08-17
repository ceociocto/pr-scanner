import type { z } from "zod";

/** Base error class for all PR Scanner errors */
export class PrScannerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode: number = 1,
  ) {
    super(message);
    this.name = "PrScannerError";
  }
}

/** Configuration file error */
export class ConfigError extends PrScannerError {
  constructor(message: string) {
    super(message, "E4001", 1);
    this.name = "ConfigError";
  }
}

/** Configuration validation error */
export class ConfigValidationError extends ConfigError {
  constructor(public readonly errors: z.ZodError) {
    super(`Configuration validation failed: ${errors.message}`);
    this.code = "E4002";
    this.name = "ConfigValidationError";
  }
}

/** GitHub provider error */
export class ProviderError extends PrScannerError {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message, "E5001", 2);
    this.name = "ProviderError";
  }
}

/** Authentication error */
export class AuthenticationError extends ProviderError {
  constructor(platform: string) {
    super(`Authentication failed for ${platform}. Check your token.`);
    this.code = "E5002";
    this.name = "AuthenticationError";
  }
}

/** Rate limit error */
export class RateLimitError extends ProviderError {
  constructor(retryAfter: number) {
    super(`Rate limit hit. Retrying after ${retryAfter} seconds.`);
    this.code = "E5003";
    this.name = "RateLimitError";
  }
}

/** Database error */
export class DatabaseError extends PrScannerError {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message, "E6001", 3);
    this.name = "DatabaseError";
  }
}

/** LLM/AI error */
export class LlmError extends PrScannerError {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message, "E7001", 4);
    this.name = "LlmError";
  }
}

/** Token budget exceeded error */
export class TokenBudgetExceededError extends LlmError {
  constructor(budgetUsed: number, budgetTotal: number) {
    super(`Token budget exceeded: ${budgetUsed}/${budgetTotal} tokens used.`);
    this.code = "E7002";
    this.name = "TokenBudgetExceededError";
  }
}

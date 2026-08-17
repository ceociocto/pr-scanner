import {
  PrScannerError,
  ConfigError,
  ConfigValidationError,
  ProviderError,
  AuthenticationError,
  RateLimitError,
  DatabaseError,
  LlmError,
} from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const EXIT_CODES: Record<string, number> = {
  E4001: 1, // Config error
  E4002: 1, // Config validation error
  E5001: 2, // Provider error
  E5002: 2, // Authentication error
  E5003: 2, // Rate limit error
  E6001: 3, // Database error
  E7001: 4, // LLM error
  E7002: 4, // Token budget exceeded
};

/** Error recovery suggestions mapped by error code */
const SUGGESTIONS: Record<string, string[]> = {
  E4001: [
    "Check that your configuration file exists and is valid YAML.",
    "Verify all required environment variables are set.",
  ],
  E4002: ["Review the validation errors above and fix the indicated fields."],
  E5002: [
    "Verify your GitHub token is valid and not expired.",
    "Ensure the token has the required scopes (repo, read:org).",
  ],
  E5003: [
    "Wait a few minutes before retrying.",
    "Reduce scan concurrency with --concurrency flag.",
  ],
  E6001: [
    "Check that the database path is writable.",
    "Delete the database file and re-run to recreate the schema.",
  ],
  E7001: [
    "Verify your AI API key is set and valid.",
    "Check your network connection to the AI provider.",
    "Run with --no-ai to skip AI evaluation.",
  ],
  E7002: ["Increase maxTokensPerScan in your config.", "Run with --no-ai to skip AI evaluation."],
};

function getSuggestions(code: string): string[] {
  return SUGGESTIONS[code] ?? ["Check the error message above for details."];
}

/** Handle errors and exit with appropriate code */
export function handleError(error: unknown): void {
  if (error instanceof PrScannerError) {
    logger.error(`[${error.code}] ${error.message}`);

    if (error instanceof ConfigValidationError) {
      logger.error("Validation errors:");
      for (const issue of error.errors.issues) {
        logger.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
    }

    const suggestions = getSuggestions(error.code);
    logger.error("Suggestions:");
    for (const suggestion of suggestions) {
      logger.error(`  → ${suggestion}`);
    }

    process.exit(EXIT_CODES[error.code] ?? 1);
  }

  if (error instanceof Error) {
    // Commander exit override — not a real error
    // Commander throws errors with messages like "(outputHelp)" or "EEXIT:0"
    if (
      error.message.includes("EEXIT:") ||
      error.message.startsWith("(") ||
      error.message === "CommanderError"
    ) {
      return;
    }

    logger.error(error.message);
    process.exit(1);
  }

  logger.error(String(error));
  process.exit(1);
}

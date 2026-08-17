import type { TokenBudget } from "./types.js";

/**
 * Create a token budget tracker.
 */
export function createTokenBudget(total: number, warnPercent = 80): TokenBudget {
  let used = 0;

  return {
    total,
    get used() {
      return used;
    },
    warnPercent,

    isExceeded() {
      return used >= total;
    },

    isNearLimit() {
      return (used / total) * 100 >= warnPercent;
    },

    record(tokens: number) {
      used += tokens;
    },

    remaining() {
      return Math.max(0, total - used);
    },
  };
}

/**
 * Rough estimate of tokens for a string.
 * ~4 characters per token is a reasonable estimate for English text.
 * For code/diff content, it's closer to ~3.5 chars/token.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

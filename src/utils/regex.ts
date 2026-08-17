/**
 * Shared regex patterns used across evaluators.
 */

/** Conventional Commits pattern */
export const CONVENTIONAL_COMMITS_PATTERN =
  /^(feat|fix|refactor|docs|test|chore|perf|build|ci|style|revert)(\(.+\))?: .+/;

/** Issue reference pattern (GitHub #123, JIRA-456) */
export const ISSUE_REFERENCE_PATTERN = /(#\d+|[A-Z]+-\d+)/;

/** Branch naming pattern */
export const BRANCH_NAMING_PATTERN = /^(feat|fix|refactor|docs|test|chore|perf)\/.+/;

/**
 * Build a regex from a config pattern string.
 */
export function buildRegex(pattern: string): RegExp {
  return new RegExp(pattern);
}

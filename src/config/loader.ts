import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { prScannerConfigSchema } from "./schema.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import { ConfigError, ConfigValidationError } from "../utils/errors.js";

/**
 * Interpolate environment variables in a string.
 * Replaces ${VAR_NAME} patterns with the corresponding environment variable value.
 */
function interpolateEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new ConfigError(`Environment variable ${varName} is not set`);
    }
    return envValue;
  });
}

/**
 * Recursively interpolate environment variables in an object.
 */
function interpolateObject(obj: unknown): unknown {
  if (typeof obj === "string") {
    return interpolateEnvVars(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(interpolateObject);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value);
    }
    return result;
  }
  return obj;
}

/**
 * Load and validate configuration from a YAML file.
 */
export function loadConfig(configPath: string) {
  const absolutePath = resolve(configPath);

  if (!existsSync(absolutePath)) {
    throw new ConfigError(`Configuration file not found: ${absolutePath}`);
  }

  let rawContent: string;
  try {
    rawContent = readFileSync(absolutePath, "utf-8");
  } catch (error) {
    throw new ConfigError(`Failed to read configuration file: ${absolutePath}`);
  }

  let parsedYaml: unknown;
  try {
    parsedYaml = parseYaml(rawContent);
  } catch (error) {
    throw new ConfigError(`Failed to parse YAML configuration: ${(error as Error).message}`);
  }

  // Interpolate environment variables
  const interpolated = interpolateObject(parsedYaml);

  // Validate against schema (merges with defaults)
  const result = prScannerConfigSchema.safeParse(interpolated);

  if (!result.success) {
    throw new ConfigValidationError(result.error);
  }

  return result.data;
}

/**
 * Generate a starter configuration file content.
 */
export function generateStarterConfig(): string {
  return `# PR Scanner Configuration
# For more details, see: https://github.com/ceociocto/pr-scanner

github:
  platform: github.com
  token: \${GITHUB_TOKEN}
  # For GitHub Enterprise Server:
  # platform: github-enterprise
  # baseUrl: https://github.my-company.com/api/v3
  # apiVersion: "3.16"

repositories:
  - name: owner/repo
    # mergedAfter: 2025-01-01

scan:
  includeUnmerged: false
  maxPullRequests: 0
  concurrency: 5

standards:
  prSize:
    enabled: true
    warning: 400
    ideal: 300
  commitConvention:
    enabled: true
    allowedTypes: [feat, fix, refactor, docs, test, chore, perf, build, ci]
  reviewerCount:
    enabled: true
    minimum: 1
  ciStatus:
    enabled: true
    requireAllChecks: false
  timeToMerge:
    enabled: true
    warningHours: 120
    criticalHours: 240
  timeToReview:
    enabled: true
    warningHours: 24
  labels:
    enabled: false
  branchNaming:
    enabled: true
    pattern: "^(feat|fix|refactor|docs|test|chore|perf)/.+"
  linkedIssues:
    enabled: true
    issuePattern: "(#\\\\d+|[A-Z]+-\\\\d+)"
  codeChurn:
    enabled: true
    maxFilesWarning: 20
  selfMerge:
    enabled: true
  revertRate:
    enabled: true
  reviewCommentCount:
    enabled: true
    warnZeroComments: true
    highCommentThreshold: 30

output:
  format: console
  detailLevel: detailed

cache:
  dbPath: ./data/pr-scanner.db
  ttlHours: 24

ai:
  enabled: false
  provider: anthropic
  model: claude-sonnet-4-20250514
  # apiKey: \${ANTHROPIC_API_KEY}
`;
}

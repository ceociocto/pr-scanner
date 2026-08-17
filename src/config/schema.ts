import { z } from "zod";

/** GitHub connection configuration */
export const githubConnectionSchema = z.object({
  platform: z.enum(["github.com", "github-enterprise"]).default("github.com"),
  token: z.string().describe("Supports ${ENV_VAR} interpolation"),
  baseUrl: z.string().optional().describe("Required for github-enterprise"),
  apiVersion: z.string().optional().describe("Required for github-enterprise"),
});

/** Per-repository configuration */
export const repositorySchema = z.object({
  name: z.string().describe("Format: owner/repo"),
  platform: z.enum(["github.com", "github-enterprise"]).optional(),
  token: z.string().optional(),
  mergedAfter: z.string().optional().describe("ISO 8601 date"),
  mergedBefore: z.string().optional().describe("ISO 8601 date"),
  labels: z.array(z.string()).optional(),
  excludeLabels: z.array(z.string()).optional(),
  pullNumbers: z.array(z.number()).optional(),
});

/** Scan options */
export const scanSchema = z.object({
  includeUnmerged: z.boolean().default(false),
  maxPullRequests: z.number().default(0).describe("0 = unlimited"),
  concurrency: z.number().default(5),
});

/** Standards configuration */
export const standardsSchema = z.object({
  prSize: z
    .object({
      enabled: z.boolean().default(true),
      warning: z.number().default(400),
      ideal: z.number().default(300),
    })
    .default({}),
  commitConvention: z
    .object({
      enabled: z.boolean().default(true),
      pattern: z.string().optional(),
      allowedTypes: z
        .array(z.string())
        .default([
          "feat",
          "fix",
          "refactor",
          "docs",
          "test",
          "chore",
          "perf",
          "build",
          "ci",
        ]),
    })
    .default({}),
  reviewerCount: z
    .object({
      enabled: z.boolean().default(true),
      minimum: z.number().default(1),
    })
    .default({}),
  ciStatus: z
    .object({
      enabled: z.boolean().default(true),
      requireAllChecks: z.boolean().default(false),
    })
    .default({}),
  timeToMerge: z
    .object({
      enabled: z.boolean().default(true),
      warningHours: z.number().default(120),
      criticalHours: z.number().default(240),
    })
    .default({}),
  timeToReview: z
    .object({
      enabled: z.boolean().default(true),
      warningHours: z.number().default(24),
    })
    .default({}),
  labels: z
    .object({
      enabled: z.boolean().default(false),
      requiredLabels: z.array(z.string()).optional(),
    })
    .default({}),
  branchNaming: z
    .object({
      enabled: z.boolean().default(true),
      pattern: z.string().default("^(feat|fix|refactor|docs|test|chore|perf)/.+"),
    })
    .default({}),
  linkedIssues: z
    .object({
      enabled: z.boolean().default(true),
      issuePattern: z.string().default("(#\\d+|[A-Z]+-\\d+)"),
    })
    .default({}),
  codeChurn: z
    .object({
      enabled: z.boolean().default(true),
      maxFilesWarning: z.number().default(20),
    })
    .default({}),
  selfMerge: z
    .object({
      enabled: z.boolean().default(true),
    })
    .default({}),
  revertRate: z
    .object({
      enabled: z.boolean().default(true),
    })
    .default({}),
  reviewCommentCount: z
    .object({
      enabled: z.boolean().default(true),
      warnZeroComments: z.boolean().default(true),
      highCommentThreshold: z.number().default(30),
    })
    .default({}),
});

/** Output configuration */
export const outputSchema = z.object({
  format: z.enum(["json", "csv", "markdown", "console"]).default("console"),
  filePath: z.string().optional(),
  detailLevel: z.enum(["summary", "detailed", "full"]).default("detailed"),
});

/** Cache configuration */
export const cacheSchema = z.object({
  dbPath: z.string().default("./data/pr-scanner.db"),
  ttlHours: z.number().default(24),
});

/** AI configuration */
export const aiSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(["anthropic", "openai", "ollama"]).default("anthropic"),
  model: z.string().default("claude-sonnet-4-20250514"),
  apiKey: z.string().optional().describe("Supports ${ENV_VAR} interpolation"),
  baseUrl: z.string().optional(),
  maxTokensPerRequest: z.number().default(4096),
  maxTokensPerScan: z.number().default(200000),
  warnAtTokensPercent: z.number().default(80),
  concurrency: z.number().default(3),
  timeoutMs: z.number().default(30000),
  maxRetries: z.number().default(3),
  evaluators: z
    .object({
      descriptionQuality: z.object({ enabled: z.boolean().default(true) }).default({}),
      codeRisk: z.object({ enabled: z.boolean().default(true) }).default({}),
      reviewQuality: z.object({ enabled: z.boolean().default(true) }).default({}),
    })
    .default({}),
  report: z
    .object({
      enabled: z.boolean().default(true),
      sampleCount: z.number().default(5),
    })
    .default({}),
});

/** Full configuration schema */
export const prScannerConfigSchema = z.object({
  github: githubConnectionSchema,
  repositories: z.array(repositorySchema).min(1),
  scan: scanSchema.default({}),
  standards: standardsSchema.default({}),
  output: outputSchema.default({}),
  cache: cacheSchema.default({}),
  ai: aiSchema.default({}),
});

export type PrScannerConfig = z.infer<typeof prScannerConfigSchema>;

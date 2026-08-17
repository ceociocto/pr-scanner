import type { PrScannerConfig } from "./schema.js";

export const DEFAULT_CONFIG: PrScannerConfig = {
  github: {
    platform: "github.com",
    token: "${GITHUB_TOKEN}",
  },
  repositories: [],
  scan: {
    includeUnmerged: false,
    maxPullRequests: 0,
    concurrency: 5,
  },
  standards: {
    prSize: { enabled: true, warning: 400, ideal: 300 },
    commitConvention: {
      enabled: true,
      allowedTypes: ["feat", "fix", "refactor", "docs", "test", "chore", "perf", "build", "ci"],
    },
    reviewerCount: { enabled: true, minimum: 1 },
    ciStatus: { enabled: true, requireAllChecks: false },
    timeToMerge: { enabled: true, warningHours: 120, criticalHours: 240 },
    timeToReview: { enabled: true, warningHours: 24 },
    labels: { enabled: false },
    branchNaming: {
      enabled: true,
      pattern: "^(feat|fix|refactor|docs|test|chore|perf)/.+",
    },
    linkedIssues: { enabled: true, issuePattern: "(#\\d+|[A-Z]+-\\d+)" },
    codeChurn: { enabled: true, maxFilesWarning: 20 },
    selfMerge: { enabled: true },
    revertRate: { enabled: true },
    reviewCommentCount: { enabled: true, warnZeroComments: true, highCommentThreshold: 30 },
  },
  output: {
    format: "console",
    detailLevel: "detailed",
  },
  cache: {
    dbPath: "./data/pr-scanner.db",
    ttlHours: 24,
  },
  ai: {
    enabled: false,
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    maxTokensPerRequest: 4096,
    maxTokensPerScan: 200000,
    warnAtTokensPercent: 80,
    concurrency: 3,
    timeoutMs: 30000,
    maxRetries: 3,
    evaluators: {
      descriptionQuality: { enabled: true },
      codeRisk: { enabled: true },
      reviewQuality: { enabled: true },
    },
    report: { enabled: true, sampleCount: 5 },
  },
};

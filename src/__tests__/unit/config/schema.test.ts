import { describe, it, expect } from "vitest";
import { prScannerConfigSchema } from "../../../config/schema.js";

describe("Config Schema Validation", () => {
  it("should accept a minimal valid config", () => {
    const config = {
      github: {
        platform: "github.com" as const,
        token: "test-token",
      },
      repositories: [
        {
          name: "owner/repo",
        },
      ],
    };

    const result = prScannerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("should apply defaults for missing optional fields", () => {
    const config = {
      github: {
        platform: "github.com" as const,
        token: "test-token",
      },
      repositories: [{ name: "owner/repo" }],
    };

    const result = prScannerConfigSchema.parse(config);
    expect(result.scan.includeUnmerged).toBe(false);
    expect(result.scan.concurrency).toBe(5);
    expect(result.output.format).toBe("console");
    expect(result.output.detailLevel).toBe("detailed");
    expect(result.cache.dbPath).toBe("./data/pr-scanner.db");
    expect(result.standards.prSize.enabled).toBe(true);
    expect(result.standards.prSize.warning).toBe(400);
    expect(result.ai.enabled).toBe(false);
  });

  it("should reject config with no repositories", () => {
    const config = {
      github: {
        platform: "github.com" as const,
        token: "test-token",
      },
      repositories: [],
    };

    const result = prScannerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should accept a full config with all fields", () => {
    const config = {
      github: {
        platform: "github.com" as const,
        token: "${GITHUB_TOKEN}",
      },
      repositories: [
        {
          name: "owner/repo",
          mergedAfter: "2025-01-01",
          labels: ["bug", "enhancement"],
        },
        {
          name: "enterprise/repo",
          platform: "github-enterprise" as const,
          token: "${GHE_TOKEN}",
          baseUrl: "https://github.enterprise.com/api/v3",
        },
      ],
      scan: {
        includeUnmerged: true,
        maxPullRequests: 100,
        concurrency: 3,
      },
      standards: {
        prSize: { enabled: true, warning: 500, ideal: 200 },
        reviewerCount: { enabled: true, minimum: 2 },
        labels: { enabled: true, requiredLabels: ["bug", "feature"] },
      },
      output: {
        format: "json" as const,
        detailLevel: "full" as const,
        filePath: "./reports/scan.json",
      },
      cache: {
        dbPath: "./custom.db",
        ttlHours: 48,
      },
      ai: {
        enabled: true,
        provider: "anthropic" as const,
        model: "claude-sonnet-4-20250514",
        apiKey: "${ANTHROPIC_API_KEY}",
        evaluators: {
          descriptionQuality: { enabled: true },
          codeRisk: { enabled: false },
          reviewQuality: { enabled: true },
        },
      },
    };

    const result = prScannerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("should reject invalid platform values", () => {
    const config = {
      github: {
        platform: "gitlab",
        token: "test-token",
      },
      repositories: [{ name: "owner/repo" }],
    };

    const result = prScannerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should reject invalid output format", () => {
    const config = {
      github: {
        platform: "github.com" as const,
        token: "test-token",
      },
      repositories: [{ name: "owner/repo" }],
      output: {
        format: "xml",
      },
    };

    const result = prScannerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should accept repo-level platform override", () => {
    const config = {
      github: {
        platform: "github.com" as const,
        token: "test-token",
      },
      repositories: [
        {
          name: "owner/repo",
          platform: "github-enterprise" as const,
          token: "ghe-token",
        },
      ],
    };

    const result = prScannerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.repositories[0].platform).toBe("github-enterprise");
    }
  });

  it("should accept pullNumbers for targeted scan", () => {
    const config = {
      github: {
        platform: "github.com" as const,
        token: "test-token",
      },
      repositories: [
        {
          name: "owner/repo",
          pullNumbers: [123, 456, 789],
        },
      ],
    };

    const result = prScannerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
});

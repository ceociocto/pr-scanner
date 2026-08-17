import type { PrScannerConfig } from "../config/schema.js";
import type { RepositoryConfig } from "../config/schema.js";
import { buildOctokit } from "./octokit-builder.js";
import { GitHubComProvider } from "./github-com.provider.js";
import { GheProvider } from "./ghe.provider.js";
import type { GitHubProvider } from "./provider.js";

/**
 * Build an Octokit-config-like object from global + per-repo overrides.
 * Per-repo settings take precedence over global settings.
 */
function resolveRepoConnection(
  config: PrScannerConfig,
  repo: RepositoryConfig,
): { platform: "github.com" | "github-enterprise"; token: string; baseUrl?: string } {
  return {
    platform: repo.platform ?? config.github.platform,
    token: repo.token ?? config.github.token,
    baseUrl: repo.token ? undefined : config.github.baseUrl,
  };
}

/**
 * Create a provider for a specific repository.
 * If the repository has a `platform` or `token` override, a dedicated provider is created.
 * Otherwise, the shared provider (from global config) is returned.
 */
export function createRepoProvider(
  config: PrScannerConfig,
  repo: RepositoryConfig,
): GitHubProvider {
  const hasOverride = repo.platform || repo.token;

  if (!hasOverride) {
    // Use the shared provider
    return createProvider(config);
  }

  const conn = resolveRepoConnection(config, repo);
  const repoConfig: PrScannerConfig = {
    ...config,
    github: {
      platform: conn.platform,
      token: conn.token,
      baseUrl: conn.baseUrl,
      apiVersion: config.github.apiVersion,
    },
  };

  return createProvider(repoConfig);
}

/**
 * Create a provider based on the global GitHub configuration.
 */
export function createProvider(config: PrScannerConfig): GitHubProvider {
  const octokit = buildOctokit(config);

  if (config.github.platform === "github-enterprise") {
    if (!config.github.baseUrl) {
      throw new Error(
        "baseUrl is required for GitHub Enterprise Server. " +
          'Set github.baseUrl in your config, e.g. "https://github.my-company.com/api/v3".',
      );
    }
    return new GheProvider(octokit);
  }

  return new GitHubComProvider(octokit);
}

import type { PrScannerConfig } from "../config/schema.js";
import { buildOctokit } from "./octokit-builder.js";
import { GitHubComProvider } from "./github-com.provider.js";
import type { GitHubProvider } from "./provider.js";

/**
 * Create the appropriate GitHub provider based on configuration.
 */
export function createProvider(config: PrScannerConfig): GitHubProvider {
  const octokit = buildOctokit(config);

  switch (config.github.platform) {
    case "github-enterprise":
      // Phase 5: will add GHE provider
      // For now, GitHubComProvider works with GHE when baseUrl is set
      return new GitHubComProvider(octokit);

    case "github.com":
    default:
      return new GitHubComProvider(octokit);
  }
}

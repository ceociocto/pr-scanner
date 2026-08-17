import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import type { PrScannerConfig } from "../config/schema.js";
import { logger } from "../utils/logger.js";

/** Create an Octokit instance with throttling plugin */
const OctokitWithThrottling = Octokit.plugin(throttling);

export type AppOctokit = InstanceType<typeof OctokitWithThrottling>;

/** Create an Octokit instance with throttling */
export function buildOctokit(config: PrScannerConfig): AppOctokit {
  const options: ConstructorParameters<typeof OctokitWithThrottling>[0] = {
    auth: config.github.token,
    throttle: {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        logger.warn(
          `Rate limit hit for ${options.method} ${options.url}. ` +
            (retryCount < 2
              ? `Retrying after ${retryAfter}s (attempt ${retryCount + 1})`
              : "Max retries reached"),
        );
        return retryCount < 2;
      },
      onSecondaryRateLimit: (retryAfter, options) => {
        logger.warn(`Secondary rate limit for ${options.method} ${options.url}. Waiting ${retryAfter}s`);
      },
    },
  };

  // Set baseUrl for GitHub Enterprise Server
  if (config.github.platform === "github-enterprise" && config.github.baseUrl) {
    options.baseUrl = config.github.baseUrl;
  }

  return new OctokitWithThrottling(options);
}

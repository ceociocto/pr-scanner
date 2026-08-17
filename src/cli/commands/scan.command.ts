import { Command } from "commander";
import { loadConfig } from "../../config/loader.js";
import { createProvider } from "../../github/provider-factory.js";
import { logger } from "../../utils/logger.js";

export function scanCommand(): Command {
  const cmd = new Command("scan");

  cmd
    .description("Scan repositories for PR quality")
    .requiredOption("-c, --config <path>", "Path to configuration file")
    .option("--debug", "Enable debug output", false)
    .option("--no-ai", "Disable AI-powered evaluation", false)
    .option("--format <format>", "Output format: json, csv, markdown, console")
    .option("-o, --output <path>", "Output file path")
    .option("--detail-level <level>", "Detail level: summary, detailed, full")
    .action(async (options) => {
      if (options.debug) {
        logger.setDebug(true);
      }

      logger.debug("Loading configuration...");
      const config = loadConfig(options.config);
      logger.debug(`Configuration loaded: ${config.repositories.length} repositories`);

      // Override config with CLI options
      if (options.format) {
        config.output.format = options.format as any;
      }
      if (options.output) {
        config.output.filePath = options.output;
      }
      if (options.detailLevel) {
        config.output.detailLevel = options.detailLevel as any;
      }
      if (options.noAi) {
        config.ai.enabled = false;
      }

      // Create provider and test connection
      const provider = createProvider(config);
      logger.info(`Testing connection to ${provider.platform}...`);

      try {
        const conn = await provider.testConnection();
        if (conn.ok) {
          logger.success(`Authenticated as ${conn.username}`);
        } else {
          logger.error("Authentication failed. Check your token.");
          process.exit(2);
        }
      } catch (error) {
        logger.error(`Connection failed: ${(error as Error).message}`);
        process.exit(2);
      }

      // Scan each repository
      let totalMerged = 0;

      for (const repoConfig of config.repositories) {
        const [owner, repo] = repoConfig.name.split("/");

        logger.info(`Scanning ${repoConfig.name}...`);

        try {
          const response = await provider.listPullRequests(owner, repo, {
            state: config.scan.includeUnmerged ? "all" : "closed",
          });

          // Filter to merged PRs only
          const mergedPRs = response.data.filter((pr) => pr.merged);
          totalMerged += mergedPRs.length;

          logger.success(
            `${repoConfig.name}: ${mergedPRs.length} merged PR${mergedPRs.length !== 1 ? "s" : ""} found`,
          );

          // Show first few PRs as preview
          if (mergedPRs.length > 0 && config.output.format === "console") {
            for (const pr of mergedPRs.slice(0, 5)) {
              const lines = pr.additions + pr.deletions;
              logger.info(
                `  #${pr.number} ${pr.title} (${lines} lines, ${pr.changedFiles} files) by ${pr.author.login}`,
              );
            }
            if (mergedPRs.length > 5) {
              logger.info(`  ... and ${mergedPRs.length - 5} more`);
            }
          }
        } catch (error) {
          logger.error(`Failed to scan ${repoConfig.name}: ${(error as Error).message}`);
        }
      }

      logger.info(`\nTotal merged PRs across all repositories: ${totalMerged}`);
      logger.info("(Full evaluation coming in Phase 3)");
    });

  return cmd;
}

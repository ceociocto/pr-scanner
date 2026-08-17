import { Command } from "commander";
import { loadConfig } from "../../config/loader.js";
import { createProvider } from "../../github/provider-factory.js";
import { fetchPRData } from "../../scanner/pr-fetcher.js";
import { enrichPR } from "../../scanner/pr-enricher.js";
import { logger } from "../../utils/logger.js";
import { runMigrations } from "../../data/db/migrate.js";
import { RepositoryRepository } from "../../data/repositories/repository.repository.js";
import { PullRequestRepository } from "../../data/repositories/pull-request.repository.js";
import { closeDb } from "../../data/db/connection.js";

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

      // Initialize database
      logger.debug("Initializing database...");
      runMigrations(config);

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

      // Create repositories
      const repoRepo = new RepositoryRepository(config);
      const prRepo = new PullRequestRepository(config);
      const ttlMs = config.cache.ttlHours * 3_600_000;

      // Scan each repository
      let totalMerged = 0;
      const allEnrichedPRs: Array<ReturnType<typeof enrichPR>> = [];

      for (const repoConfig of config.repositories) {
        const [owner, repo] = repoConfig.name.split("/");
        const repoId = repoRepo.upsert(repoConfig.name, config.github.platform);

        logger.info(`Scanning ${repoConfig.name}...`);

        try {
          const response = await provider.listPullRequests(owner, repo, {
            state: config.scan.includeUnmerged ? "all" : "closed",
          });

          const mergedPRs = response.data.filter((pr) => pr.merged);
          totalMerged += mergedPRs.length;

          logger.info(`Found ${mergedPRs.length} merged PR${mergedPRs.length !== 1 ? "s" : ""}`);

          // Fetch, cache, and enrich each PR
          let cachedCount = 0;
          let fetchedCount = 0;

          for (const pr of mergedPRs.slice(0, config.scan.maxPullRequests || mergedPRs.length)) {
            // Check cache
            const cached = prRepo.isFresh(repoId, pr.number, ttlMs);
            let prData = pr;

            if (cached && cached.rawJson) {
              prData = prRepo.parseCachedPr(cached.rawJson);
              cachedCount++;
            } else {
              // Fetch full PR data from API
              const fetched = await fetchPRData(provider, owner, repo, pr);
              prData = fetched.pullRequest;
              fetchedCount++;

              // Cache the raw PR data
              prRepo.upsert(repoId, prData, JSON.stringify(prData));
            }

            // Enrich with computed fields
            const enriched = enrichPR(
              {
                pullRequest: prData,
                reviews: [], // Will be populated from cache or API in full scan
                commits: [],
                checkRuns: [],
              },
              repoConfig.name,
            );

            allEnrichedPRs.push(enriched);
          }

          logger.success(
            `${repoConfig.name}: ${mergedPRs.length} PRs (${cachedCount} cached, ${fetchedCount} fetched)`,
          );

          // Update last scanned timestamp
          repoRepo.updateLastScanned(repoId);

          // Show preview
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
      logger.info(
        `(Full evaluation coming in Phase 3. Data cached in ${config.cache.dbPath})`,
      );

      // Cleanup
      closeDb();
    });

  return cmd;
}

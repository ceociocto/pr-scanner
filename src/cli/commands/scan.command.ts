import { Command } from "commander";
import { loadConfig } from "../../config/loader.js";
import { createProvider } from "../../github/provider-factory.js";
import { fetchPRData } from "../../scanner/pr-fetcher.js";
import { enrichPR } from "../../scanner/pr-enricher.js";
import { evaluatePR, buildScanResult } from "../../evaluators/evaluator-registry.js";
import { logger } from "../../utils/logger.js";
import { formatDuration } from "../../utils/time.js";
import { runMigrations } from "../../data/db/migrate.js";
import { RepositoryRepository } from "../../data/repositories/repository.repository.js";
import { PullRequestRepository } from "../../data/repositories/pull-request.repository.js";
import { EvaluationRepository } from "../../data/repositories/evaluation.repository.js";
import { ScanResultRepository } from "../../data/repositories/scan-result.repository.js";
import { closeDb } from "../../data/db/connection.js";
import { pc } from "picocolors";
import { randomUUID } from "node:crypto";

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
    .option("--force-ai", "Force re-evaluation with AI (ignore cache)", false)
    .action(async (options) => {
      if (options.debug) {
        logger.setDebug(true);
      }

      const startTime = Date.now();

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
      logger.info(`Connecting to ${provider.platform}...`);

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

      // Create data repositories
      const repoRepo = new RepositoryRepository(config);
      const prRepo = new PullRequestRepository(config);
      const evalRepo = new EvaluationRepository(config);
      const scanResultRepo = new ScanResultRepository(config);
      const ttlMs = config.cache.ttlHours * 3_600_000;

      // Scan each repository
      const allEvaluations: Array<ReturnType<typeof evaluatePR>> = [];
      let totalMerged = 0;
      let totalFetched = 0;
      let totalCached = 0;

      for (const repoConfig of config.repositories) {
        const [owner, repo] = repoConfig.name.split("/");
        const repoId = repoRepo.upsert(repoConfig.name, config.github.platform);
        const scanId = randomUUID();

        logger.info(pc.bold(`\n📊 Scanning ${repoConfig.name}...`));

        try {
          // List merged PRs
          const response = await provider.listPullRequests(owner, repo, {
            state: config.scan.includeUnmerged ? "all" : "closed",
          });

          const mergedPRs = response.data.filter((pr) => pr.merged);
          totalMerged += mergedPRs.length;

          const prsToScan = mergedPRs.slice(
            0,
            config.scan.maxPullRequests || mergedPRs.length,
          );

          logger.info(`Found ${prsToScan.length} merged PR${prsToScan.length !== 1 ? "s" : ""}`);

          // Create scan run record
          scanResultRepo.create(scanId, repoId, "");

          // Fetch, cache, enrich, and evaluate each PR
          for (let i = 0; i < prsToScan.length; i++) {
            const pr = prsToScan[i];
            const progress = `[${i + 1}/${prsToScan.length}]`;

            // Check cache for PR data
            const cached = prRepo.isFresh(repoId, pr.number, ttlMs);
            let prData = pr;
            let fetchedData: Awaited<ReturnType<typeof fetchPRData>> | null = null;

            if (cached && cached.rawJson) {
              prData = prRepo.parseCachedPr(cached.rawJson);
              totalCached++;
            } else {
              // Fetch full data from API
              fetchedData = await fetchPRData(provider, owner, repo, pr);
              prData = fetchedData.pullRequest;
              totalFetched++;

              // Cache raw PR data
              prRepo.upsert(repoId, prData, JSON.stringify(prData));
            }

            // Enrich
            const enriched = enrichPR(
              fetchedData ?? { pullRequest: prData, reviews: [], commits: [], checkRuns: [] },
              repoConfig.name,
            );

            // Evaluate
            const evaluation = evaluatePR(enriched, config);
            allEvaluations.push(evaluation);

            // Store evaluation results
            const prRecord = prRepo.findByNumber(repoId, pr.number);
            if (prRecord) {
              for (const result of evaluation.results) {
                evalRepo.insert(prRecord.id, scanId, result);
              }
            }

            // Log progress for console output
            if (config.output.format === "console" && config.output.detailLevel !== "summary") {
              const emoji = evaluation.failCount > 0 ? "❌" : evaluation.warnCount > 0 ? "⚠️" : "✅";
              const score = (evaluation.aggregateScore * 50).toFixed(0);
              logger.output(`${progress} ${emoji} #${pr.number} ${pr.title} — score: ${score}%\n`);
            }
          }

          // Update scan run
          const avgScore = allEvaluations.length > 0
            ? allEvaluations.reduce((s, e) => s + e.aggregateScore, 0) / allEvaluations.length
            : 0;
          scanResultRepo.update(scanId, prsToScan.length, prsToScan.length, avgScore);
          repoRepo.updateLastScanned(repoId);

          logger.success(`${repoConfig.name}: ${prsToScan.length} PRs evaluated`);
        } catch (error) {
          logger.error(`Failed to scan ${repoConfig.name}: ${(error as Error).message}`);
        }
      }

      // Build and output summary
      const scanResult = buildScanResult(
        config.repositories.map((r) => r.name),
        allEvaluations,
      );

      const elapsed = Date.now() - startTime;
      const summary = scanResult.summary;

      logger.info(pc.bold("\n" + "═".repeat(50)));
      logger.info(pc.bold("  📋 Scan Summary"));
      logger.info(pc.bold("═".repeat(50)));
      logger.info(`Total merged PRs scanned: ${scanResult.totalPullRequests}`);
      logger.info(`Average quality score: ${(summary.averageScore * 50).toFixed(1)}%`);
      logger.info(`  ✅ All pass: ${summary.allPassCount}`);
      logger.info(`  ⚠️  Warnings: ${summary.warningCount}`);
      logger.info(`  ❌ Failures: ${summary.failureCount}`);
      logger.info(`Data source: ${totalCached} cached, ${totalFetched} fetched from API`);
      logger.info(`Scan completed in ${formatDuration(elapsed)}`);

      // Output JSON if requested
      if (config.output.format === "json" || config.output.filePath) {
        const jsonOutput = JSON.stringify(scanResult, null, 2);
        if (config.output.filePath) {
          const { writeFileSync, mkdirSync } = await import("node:fs");
          const { dirname } = await import("node:path");
          mkdirSync(dirname(config.output.filePath), { recursive: true });
          writeFileSync(config.output.filePath, jsonOutput, "utf-8");
          logger.success(`Report written to ${config.output.filePath}`);
        } else if (config.output.format === "json") {
          logger.output(jsonOutput + "\n");
        }
      }

      // Cleanup
      closeDb();
    });

  return cmd;
}

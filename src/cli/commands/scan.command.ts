import { Command } from "commander";
import { loadConfig } from "../../config/loader.js";
import { createRepoProvider } from "../../github/provider-factory.js";
import { fetchPRData } from "../../scanner/pr-fetcher.js";
import { enrichPR } from "../../scanner/pr-enricher.js";
import {
  evaluatePR,
  buildScanResult,
  initAiEvaluators,
} from "../../evaluators/evaluator-registry.js";
import type { AiEvaluator } from "../../evaluators/ai/ai-evaluator.js";
import { logger } from "../../utils/logger.js";
import { formatDuration } from "../../utils/time.js";
import { runMigrations } from "../../data/db/migrate.js";
import { RepositoryRepository } from "../../data/repositories/repository.repository.js";
import { PullRequestRepository } from "../../data/repositories/pull-request.repository.js";
import { EvaluationRepository } from "../../data/repositories/evaluation.repository.js";
import { ScanResultRepository } from "../../data/repositories/scan-result.repository.js";
import { closeDb } from "../../data/db/connection.js";
import { createReporter } from "../../reporters/reporter-factory.js";
import { createLlmFromConfig } from "../../ai/llm-factory.js";
import { createTokenBudget } from "../../ai/token-counter.js";
import pc from "picocolors";
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ScanPhase } from "../../data/db/schema.js";

export function scanCommand(): Command {
  const cmd = new Command("scan");

  cmd
    .description("Scan repositories for PR quality")
    .requiredOption("-c, --config <path>", "Path to configuration file")
    .option("--debug", "Enable debug output", false)
    .option("--no-ai", "Disable AI-powered evaluation", false)
    .option("--ai", "Enable AI-powered evaluation", false)
    .option("--format <format>", "Output format: json, csv, markdown, console, ai-insight")
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
      if (options.ai) {
        config.ai.enabled = true;
      }

      // Initialize AI evaluators
      let aiEvaluators: AiEvaluator[] = [];
      if (config.ai.enabled) {
        try {
          const llmClient = await createLlmFromConfig(config.ai);
          const tokenBudget = createTokenBudget(
            config.ai.maxTokensPerScan,
            config.ai.warnAtTokensPercent,
          );
          aiEvaluators = initAiEvaluators(config, llmClient, tokenBudget);
          logger.info(
            `AI enabled: ${config.ai.provider}/${config.ai.model} with ${aiEvaluators.length} evaluators`,
          );
        } catch (error) {
          logger.warn(`Failed to initialize AI: ${(error as Error).message}`);
          logger.warn("Continuing with rule-based evaluation only");
          config.ai.enabled = false;
        }
      }

      // Initialize database
      logger.debug("Initializing database...");
      runMigrations(config);

      // Create data repositories
      const repoRepo = new RepositoryRepository(config);
      const prRepo = new PullRequestRepository(config);
      const evalRepo = new EvaluationRepository(config);
      const scanResultRepo = new ScanResultRepository(config);
      const ttlMs = config.cache.ttlHours * 3_600_000;
      const batchId = randomUUID();
      scanResultRepo.createBatch(batchId, config.repositories.length, "");

      // Scan each repository
      const allEvaluations: Array<ReturnType<typeof evaluatePR>> = [];
      let totalFetched = 0;
      let totalCached = 0;

      for (const repoConfig of config.repositories) {
        const [owner, repo] = repoConfig.name.split("/");
        const repoId = repoRepo.upsert(repoConfig.name, config.github.platform);
        const scanId = randomUUID();
        const repoEvaluations: Array<Awaited<ReturnType<typeof evaluatePR>>> = [];
        let currentPhase: ScanPhase = "connecting";
        scanResultRepo.create(scanId, repoId, "", batchId);

        // Create per-repo provider (respects platform/token overrides)
        const provider = createRepoProvider(config, repoConfig);

        try {
          logger.info(`Connecting to ${provider.platform} for ${repoConfig.name}...`);
          const conn = await provider.testConnection();
          if (!conn.ok) {
            throw new Error("Authentication failed. Check your token.");
          }
          logger.success(`Authenticated as ${conn.username}`);

          logger.info(pc.bold(`\n📊 Scanning ${repoConfig.name}...`));

          // List merged PRs
          currentPhase = "fetching";
          const response = await provider.listPullRequests(owner, repo, {
            state: config.scan.includeUnmerged ? "all" : "closed",
          });

          const mergedPRs = response.data.filter((pr) => pr.merged);
          const prsToScan = mergedPRs.slice(0, config.scan.maxPullRequests || mergedPRs.length);
          scanResultRepo.updateProgress(scanId, prsToScan.length, 0, currentPhase);

          logger.info(`Found ${prsToScan.length} merged PR${prsToScan.length !== 1 ? "s" : ""}`);

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
            currentPhase = "evaluating";
            const evaluation = await evaluatePR(enriched, config, aiEvaluators);
            allEvaluations.push(evaluation);
            repoEvaluations.push(evaluation);

            // Store evaluation results
            const prRecord = prRepo.findByNumber(repoId, pr.number);
            if (prRecord) {
              for (const result of evaluation.results) {
                evalRepo.insert(prRecord.id, scanId, result);
              }
            }

            // Log progress for console output
            if (config.output.format === "console" && config.output.detailLevel !== "summary") {
              const emoji =
                evaluation.failCount > 0 ? "❌" : evaluation.warnCount > 0 ? "⚠️" : "✅";
              const score = (evaluation.aggregateScore * 50).toFixed(0);
              logger.output(`${progress} ${emoji} #${pr.number} ${pr.title} — score: ${score}%\n`);
            }

            scanResultRepo.updateProgress(scanId, prsToScan.length, i + 1, currentPhase);
          }

          // Update scan run
          const avgScore =
            repoEvaluations.length > 0
              ? repoEvaluations.reduce((s, e) => s + e.aggregateScore, 0) / repoEvaluations.length
              : 0;
          scanResultRepo.update(scanId, prsToScan.length, prsToScan.length, avgScore);
          repoRepo.updateLastScanned(repoId);

          logger.success(`${repoConfig.name}: ${prsToScan.length} PRs evaluated`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          scanResultRepo.fail(scanId, message, currentPhase);
          logger.error(`Failed to scan ${repoConfig.name}: ${message}`);
        }
      }

      scanResultRepo.finalizeBatch(batchId);

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

      // Output report using reporter system
      const reporter = createReporter(config.output.format);
      const output = reporter.render(scanResult);

      if (config.output.filePath) {
        mkdirSync(dirname(config.output.filePath), { recursive: true });
        writeFileSync(config.output.filePath, output, "utf-8");
        logger.success(`Report written to ${config.output.filePath}`);
      } else {
        logger.output(output + "\n");
      }

      // Cleanup
      closeDb();
    });

  return cmd;
}

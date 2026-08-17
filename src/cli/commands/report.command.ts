import { Command } from "commander";
import { loadConfig } from "../../config/loader.js";
import { JsonReporter } from "../../reporters/json.reporter.js";
import { CsvReporter } from "../../reporters/csv.reporter.js";
import { MarkdownReporter } from "../../reporters/markdown.reporter.js";
import { ConsoleReporter } from "../../reporters/console.reporter.js";
import { createReporter } from "../../reporters/reporter-factory.js";
import type { ReporterFormat } from "../../reporters/reporter.js";
import { runMigrations } from "../../data/db/migrate.js";
import { EvaluationRepository } from "../../data/repositories/evaluation.repository.js";
import { logger } from "../../utils/logger.js";
import type { ScanResult, PullRequestEvaluation } from "../../scanner/types.js";
import type { PrScannerConfig } from "../../config/schema.js";
import { computeSummary } from "../../evaluators/evaluator-registry.js";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export function reportCommand(): Command {
  const cmd = new Command("report");

  cmd
    .description("Generate report from cached scan results")
    .requiredOption("-c, --config <path>", "Path to configuration file")
    .option("--format <format>", "Output format: json, csv, markdown, console", "console")
    .option("-o, --output <path>", "Output file path")
    .option("--scan-id <scanId>", "Generate report for a specific scan ID (latest if omitted)")
    .action(async (options) => {
      const config = loadConfig(options.config);
      runMigrations(config);

      const format = (options.format || "console") as ReporterFormat;

      if (format === "ai-insight" && !config.ai.enabled) {
        logger.warn("AI Insight reports require AI to be enabled.");
        logger.info("Enable AI with --ai flag or set ai.enabled: true in config.");
      }

      const evalRepo = new EvaluationRepository(config);

      // Get evaluations from cache
      const rows = evalRepo.getByScanId(options.scanId || "latest");

      if (rows.length === 0) {
        logger.info("No cached evaluations found. Run a scan first.");
        if (!options.scanId) {
          logger.info("Use --scan-id to specify a scan ID.");
        }
        return;
      }

      // Group by scan ID
      const scanIds = [...new Set(rows.map((r) => r.scanId))];

      // Build evaluations from cached results
      // (Simplified: just use the evaluation data we have)
      const evaluations: PullRequestEvaluation[] = [];
      // Group by pullRequestId and collect all results
      const grouped = new Map<number, any[]>();
      for (const row of rows) {
        if (!grouped.has(row.pullRequestId)) {
          grouped.set(row.pullRequestId, []);
        }
        grouped.get(row.pullRequestId)!.push(row);
      }

      for (const [, results] of grouped) {
        if (results.length === 0) continue;
        const first = results[0];
        evaluations.push({
          repository: "",
          pullNumber: 0,
          pullTitle: "",
          author: "",
          mergedAt: "",
          url: "",
          results: results.map((r) => ({
            evaluatorId: r.evaluatorId,
            name: r.evaluatorId,
            severity: r.severity as any,
            message: r.message,
            score: r.score,
          })),
          aggregateScore: 0,
          passCount: results.filter((r) => r.severity === "pass").length,
          warnCount: results.filter((r) => r.severity === "warn").length,
          failCount: results.filter((r) => r.severity === "fail").length,
          evaluatedAt: results[0].evaluatedAt,
        });
      }

      // Compute summary
      const summary = computeSummary(evaluations);
      const scanResult: ScanResult = {
        repositories: [],
        startedAt: "",
        completedAt: new Date().toISOString(),
        totalPullRequests: evaluations.length,
        evaluatedPullRequests: evaluations.length,
        evaluations,
        summary,
      };

      // Generate report
      const reporter = createReporter(format);
      const output = reporter.render(scanResult);

      // Output
      if (options.output) {
        mkdirSync(dirname(options.output), { recursive: true });
        writeFileSync(options.output, output, "utf-8");
        logger.success(`Report written to ${options.output}`);
      } else if (format !== "console") {
        logger.output(output + "\n");
      } else {
        logger.output(output + "\n");
      }
    });

  return cmd;
}

import type { Reporter } from "./reporter.js";
import type { ScanResult, PullRequestEvaluation } from "../scanner/types.js";
import { pc } from "picocolors";

/** Markdown format reporter */
export class MarkdownReporter implements Reporter {
  render(result: ScanResult): string {
    const lines: string[] = [];

    // Header
    lines.push("# PR Quality Scan Report\n");
    lines.push(
      `Repositories: ${result.repositories.join(", ")} | `,
      `Date: ${result.completedAt}\n`,
    );

    // Summary
    lines.push("## Summary\n");
    lines.push("| Metric | Value |");
    lines.push("|--------|-------|");
    lines.push(
      `| Total PRs | ${result.totalPullRequests} |`,
    );
    lines.push(
      `| Average Score | ${(result.summary.averageScore * 50).toFixed(1)}% |`,
    );
    lines.push(
      `| ✅ All Pass | ${result.summary.allPassCount} |`,
    );
    lines.push(
      `| ⚠️  Warnings | ${result.summary.warningCount} |`,
    );
    lines.push(
      `| ❌ Failures | ${result.summary.failureCount} |\n`,
    );

    // Evaluator breakdown
    lines.push("## Evaluator Breakdown\n");
    lines.push("| Evaluator | Pass Rate | Warn Rate | Fail Rate |");
    lines.push("|-----------|-----------|-----------|-----------|");

    for (const es of result.summary.evaluatorSummaries) {
      lines.push(
        `| ${es.name} | ${es.passRate.toFixed(1)}% | ${es.warnRate.toFixed(1)}% | ${es.failRate.toFixed(1)}% |`,
      );
    }

    lines.push("");

    // PR details
    lines.push("## Pull Request Details\n");

    for (const eval_ of result.evaluations) {
      const emoji =
        eval_.failCount > 0 ? "❌" : eval_.warnCount > 0 ? "⚠️" : "✅";
      const score = (eval_.aggregateScore * 50).toFixed(0);
      lines.push(
        `### ${emoji} [${eval_.repository}#${eval_.pullNumber}](${eval_.url}) — ${score}%\n`,
      );
      lines.push(`**Author**: ${eval_.author} | **Merged**: ${eval_.mergedAt}\n`);
      lines.push("| Check | Result |");
      lines.push("|-------|--------|");

      for (const r of eval_.results) {
        const severityIcon =
          r.severity === "pass" ? "✅" : r.severity === "warn" ? "⚠️" : "❌";
        lines.push(`| ${r.name} | ${severityIcon} ${r.message} |`);
      }

      lines.push("");
    }

    return lines.join("\n");
  }
}

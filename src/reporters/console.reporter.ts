import type { Reporter } from "./reporter.js";
import type { ScanResult, PullRequestEvaluation } from "../scanner/types.js";
import pc from "picocolors";
import { formatDuration } from "../utils/time.js";

/** Console format reporter with colors */
export class ConsoleReporter implements Reporter {
  private useColor = true;

  disableColor(): void {
    this.useColor = false;
  }

  render(result: ScanResult): string {
    const c = (text: string, fn: (s: string) => string) => (this.useColor ? fn(text) : text);
    const lines: string[] = [];

    // Header
    lines.push(c("\n" + "═".repeat(50), pc.bold));
    lines.push(c("  📋 PR Quality Scan Report", pc.bold));
    lines.push(c("═".repeat(50), pc.bold));
    lines.push(`  Repositories: ${result.repositories.join(", ")}`);
    lines.push(`  Date: ${result.completedAt}`);

    // Summary
    const avg = (result.summary.averageScore * 50).toFixed(1);
    lines.push("");
    lines.push(c(`  Average Score: ${avg}%`, avg >= 70 ? pc.green : avg >= 50 ? pc.yellow : pc.red));
    lines.push(c(`  ✅ All Pass: ${result.summary.allPassCount}`, pc.green));
    lines.push(
      result.summary.warningCount > 0
        ? c(`  ⚠️  Warnings: ${result.summary.warningCount}`, pc.yellow)
        : `  ⚠️  Warnings: ${result.summary.warningCount}`,
    );
    lines.push(
      result.summary.failureCount > 0
        ? c(`  ❌ Failures: ${result.summary.failureCount}`, pc.red)
        : `  ❌ Failures: ${result.summary.failureCount}`,
    );
    lines.push(`  Total PRs: ${result.totalPullRequests}`);

    // Per-PR details
    for (const eval_ of result.evaluations) {
      const emoji =
        eval_.failCount > 0 ? "❌" : eval_.warnCount > 0 ? "⚠️" : "✅";
      const score = (eval_.aggregateScore * 50).toFixed(0);
      const color = eval_.failCount > 0 ? pc.red : eval_.warnCount > 0 ? pc.yellow : pc.green;

      lines.push("");
      lines.push(
        `  ${emoji} ${c(`#${eval_.pullNumber}`, pc.bold)} ${eval_.pullTitle} — ${c(score + "%", color)}`,
      );
      lines.push(`      ${eval_.repository} by ${eval_.author}`);

      // Failed checks
      for (const r of eval_.results) {
        if (r.severity === "fail") {
          lines.push(`        ${c("✗", pc.red)} ${r.name}: ${r.message}`);
        }
      }
      // Warnings
      for (const r of eval_.results) {
        if (r.severity === "warn") {
          lines.push(`        ${c("!", pc.yellow)} ${r.name}: ${r.message}`);
        }
      }
    }

    return lines.join("\n");
  }
}

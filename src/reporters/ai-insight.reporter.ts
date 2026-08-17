import type { Reporter } from "./reporter.js";
import type { ScanResult, PullRequestEvaluation } from "../scanner/types.js";

/**
 * AI Insight reporter — generates a natural language report
 * composed from AI evaluation results (details, suggestions, severity).
 *
 * The LLM-powered summary generation can be added as an enhancement
 * by making this reporter accept an optional LlmClient for a full
 * AI-generated narrative, but the base version composes insights
 * from the already-cached AI evaluator results.
 */
export class AiInsightReporter implements Reporter {
  render(result: ScanResult): string {
    const sections: string[] = [];

    // Header
    sections.push("# 🤖 PR Quality AI Insight Report\n");
    sections.push(`**Repositories**: ${result.repositories.join(", ")}`);
    sections.push(`**Date**: ${result.completedAt}`);
    sections.push(`**Total PRs**: ${result.totalPullRequests}\n`);

    // Overall Summary
    sections.push("## 📊 Overall Summary\n");
    const avg = (result.summary.averageScore * 50).toFixed(1);
    const overallEmoji = avg >= 70 ? "🟢" : avg >= 50 ? "🟡" : "🔴";
    sections.push(
      `${overallEmoji} **Average Quality Score**: ${avg}% across ${result.totalPullRequests} PRs.`,
    );
    sections.push(`- ✅ Fully passing: ${result.summary.allPassCount}`);
    sections.push(`- ⚠️  With warnings: ${result.summary.warningCount}`);
    sections.push(`- ❌ With failures: ${result.summary.failureCount}\n`);

    // AI Evaluator-specific insights
    const aiInsights = this.extractAiInsights(result.evaluations);
    if (aiInsights.length > 0) {
      sections.push("## 🔍 AI Insights\n");

      for (const insight of aiInsights) {
        sections.push(`### ${insight.evaluatorName}\n`);
        sections.push(insight.summary);
        if (insight.topIssues.length > 0) {
          sections.push("**Top issues:**");
          for (const issue of insight.topIssues.slice(0, 5)) {
            sections.push(`- ${issue}`);
          }
        }
        if (insight.suggestions.length > 0) {
          sections.push("**Suggestions:**");
          for (const suggestion of insight.suggestions.slice(0, 3)) {
            sections.push(`- ${suggestion}`);
          }
        }
        sections.push("");
      }
    } else {
      sections.push("## 🔍 AI Insights\n");
      sections.push(
        "No AI evaluation results available. Run with `--ai` flag for AI-powered insights.\n",
      );
    }

    // Best and worst PRs
    const sorted = [...result.evaluations].sort((a, b) => b.aggregateScore - a.aggregateScore);
    const best = sorted.slice(0, Math.min(3, sorted.length));
    const worst = sorted.slice(-Math.min(3, sorted.length)).reverse();

    if (best.length > 0) {
      sections.push("## 🏆 Top Scoring PRs\n");
      for (const pr of best) {
        const score = (pr.aggregateScore * 50).toFixed(0);
        sections.push(
          `- **${score}%** [#${pr.pullNumber}](${pr.url}) "${pr.pullTitle}" — by ${pr.author}`,
        );
      }
      sections.push("");
    }

    if (worst.length > 0 && worst[0].aggregateScore < best[0]?.aggregateScore) {
      sections.push("## ⚠️ PRs Needing Attention\n");
      for (const pr of worst) {
        const score = (pr.aggregateScore * 50).toFixed(0);
        const fails = pr.results
          .filter((r) => r.severity === "fail")
          .map((r) => r.name)
          .join(", ");
        sections.push(
          `- **${score}%** [#${pr.pullNumber}](${pr.url}) "${pr.pullTitle}" — ${fails || "multiple warnings"}`,
        );
      }
      sections.push("");
    }

    // Evaluator breakdown
    if (result.summary.evaluatorSummaries.length > 0) {
      sections.push("## 📈 Evaluator Breakdown\n");
      sections.push("| Evaluator | Pass | Warn | Fail |");
      sections.push("|-----------|------|------|------|");
      for (const es of result.summary.evaluatorSummaries) {
        const pass = es.passRate.toFixed(0);
        const warn = es.warnRate.toFixed(0);
        const fail = es.failRate.toFixed(0);
        sections.push(`| ${es.name} | ${pass}% | ${warn}% | ${fail}% |`);
      }
      sections.push("");
    }

    return sections.join("\n");
  }

  private extractAiInsights(evaluations: PullRequestEvaluation[]): Array<{
    evaluatorName: string;
    evaluatorId: string;
    summary: string;
    topIssues: string[];
    suggestions: string[];
  }> {
    const aiResults = new Map<
      string,
      {
        name: string;
        passes: number;
        warns: number;
        fails: number;
        issues: string[];
        suggestions: string[];
      }
    >();

    for (const eval_ of evaluations) {
      for (const result of eval_.results) {
        // Only process AI evaluator results (those with metadata.details or aiModel)
        if (!result.metadata?.details && !result.aiModel) continue;

        if (!aiResults.has(result.evaluatorId)) {
          aiResults.set(result.evaluatorId, {
            name: result.name.replace(" (skipped)", ""),
            passes: 0,
            warns: 0,
            fails: 0,
            issues: [],
            suggestions: [],
          });
        }

        const stats = aiResults.get(result.evaluatorId)!;
        if (result.severity === "pass") stats.passes++;
        else if (result.severity === "warn") stats.warns++;
        else if (result.severity === "fail") stats.fails++;

        if (result.severity !== "pass") {
          stats.issues.push(`[#${eval_.pullNumber}] ${result.message}`);
        }

        const suggestion = result.metadata?.suggestion;
        if (suggestion && typeof suggestion === "string") {
          stats.suggestions.push(suggestion);
        }
      }
    }

    const total = evaluations.length;
    return Array.from(aiResults.entries()).map(([id, stats]) => ({
      evaluatorName: stats.name,
      evaluatorId: id,
      summary: `Out of ${total} PRs: ${stats.passes} passed, ${stats.warns} warnings, ${stats.fails} failures.`,
      topIssues: stats.issues,
      suggestions: [...new Set(stats.suggestions)], // deduplicate
    }));
  }
}

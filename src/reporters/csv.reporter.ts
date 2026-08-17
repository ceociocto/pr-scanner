import Papa from "papaparse";
import type { Reporter } from "./reporter.js";
import type { ScanResult, PullRequestEvaluation } from "../scanner/types.js";

/** CSV format reporter */
export class CsvReporter implements Reporter {
  render(result: ScanResult): string {
    const summaryRows = [
      {
        Type: "Summary",
        Metric: "Total PRs",
        Value: String(result.totalPullRequests),
      },
      {
        Type: "Summary",
        Metric: "Average Score",
        Value: (result.summary.averageScore * 50).toFixed(1) + "%",
      },
      {
        Type: "Summary",
        Metric: "All Pass",
        Value: String(result.summary.allPassCount),
      },
      {
        Type: "Summary",
        Metric: "Has Warnings",
        Value: String(result.summary.warningCount),
      },
      {
        Type: "Summary",
        Metric: "Has Failures",
        Value: String(result.summary.failureCount),
      },
    ];

    const prRows = result.evaluations.map((item: PullRequestEvaluation) => ({
      Repository: item.repository,
      PR: `#${item.pullNumber}`,
      Title: item.pullTitle,
      Author: item.author,
      Score: (item.aggregateScore * 50).toFixed(1) + "%",
      Pass: String(item.passCount),
      Warn: String(item.warnCount),
      Fail: String(item.failCount),
      URL: item.url,
      MergedAt: item.mergedAt,
      Evaluators: item.results
        .map((r) => `${r.evaluatorId}:${r.severity}`)
        .join("; "),
    }));

    const summaryCsv = Papa.unparse(summaryRows);
    const prCsv = Papa.unparse(prRows);
    return [summaryCsv, prCsv].join("\n");
  }
}

import { getRegisteredEvaluators } from "../evaluators/evaluator-registry.js";
import type { PrScannerConfig } from "../config/schema.js";
import {
  DashboardRepository,
  type DashboardBatchRecord,
  type DashboardEvaluationRow,
} from "./dashboard.repository.js";
import type {
  DashboardMetricSummary,
  DashboardOverview,
  DashboardTrendPoint,
  EvaluatorRiskSummary,
  PullRequestDetails,
  RepositorySummary,
  ScanDetails,
  ScanHistoryItem,
  ScanStatusSummary,
} from "./types.js";

const STALE_AFTER_HOURS = 48;
const DEFAULT_RANGE_DAYS = 30;

interface PullRequestRollup {
  scanId: string;
  pullRequestId: number | null;
  repository: string;
  pullNumber: number;
  title: string;
  author: string;
  mergedAt: string | null;
  scores: number[];
  passCount: number;
  warnCount: number;
  failCount: number;
  issues: string[];
}

export class DashboardService {
  private readonly repository: DashboardRepository;

  constructor(private readonly config: PrScannerConfig) {
    this.repository = new DashboardRepository(config);
  }

  getOverview(rangeDays = DEFAULT_RANGE_DAYS, repositoryFilter?: string): DashboardOverview {
    const safeRangeDays = clampRangeDays(rangeDays);
    const since = new Date(Date.now() - safeRangeDays * 86_400_000).toISOString();
    const batches = this.repository.listBatches(since);
    const latestBatch = this.repository.listBatches()[0] ?? null;
    const latestRows = latestBatch ? this.repository.listEvaluations(latestBatch.runIds) : [];
    const rangeRows = this.repository.listEvaluations(batches.flatMap((batch) => batch.runIds));
    const filteredLatestRows = filterRows(latestRows, repositoryFilter);
    const filteredRangeRows = filterRows(rangeRows, repositoryFilter);
    const summary = summarizeRows(filteredLatestRows);
    const dataAsOf = latestBatch?.completedAt ?? latestBatch?.startedAt ?? null;

    return {
      generatedAt: new Date().toISOString(),
      dataAsOf,
      freshness: calculateFreshness(dataAsOf),
      staleAfterHours: STALE_AFTER_HOURS,
      filters: {
        rangeDays: safeRangeDays,
        repository: repositoryFilter,
      },
      currentScan: latestBatch ? toScanStatusSummary(latestBatch) : null,
      summary,
      trend: buildTrend(filteredRangeRows),
      repositories: buildRepositorySummaries(latestBatch, latestRows),
      evaluatorRisks: buildEvaluatorRisks(filteredLatestRows),
      riskPullRequests: buildRiskPullRequests(filteredLatestRows),
    };
  }

  getScans(limit = 20): ScanHistoryItem[] {
    return this.repository
      .listBatches()
      .slice(0, clampLimit(limit))
      .map((batch) => ({
        ...toScanStatusSummary(batch),
        repositories: this.repository
          .listRunsByBatch(batch.id)
          .map((run) => run.repository)
          .filter((name): name is string => Boolean(name)),
      }));
  }

  getScanDetails(batchId: string): ScanDetails | null {
    const batch = this.repository.findBatch(batchId);
    if (!batch) return null;

    const runs = this.repository.listRunsByBatch(batchId);
    const rows = this.repository.listEvaluations(batch.runIds);
    return {
      ...toScanStatusSummary(batch),
      repositories: runs
        .map((run) => run.repository)
        .filter((name): name is string => Boolean(name)),
      repositoryRuns: runs.map((run) => ({
        id: run.id,
        repository: run.repository,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        currentPhase: run.currentPhase,
        totalPullRequests: run.totalPullRequests,
        evaluatedCount: run.evaluatedCount,
        progressTotal: run.progressTotal,
        progressCompleted: run.progressCompleted,
        averageScore: run.averageScore,
        errorMessage: run.errorMessage,
      })),
      summary: summarizeRows(rows),
    };
  }

  getPullRequestDetails(repository: string, pullNumber: number): PullRequestDetails | null {
    const latestBatch = this.repository.listBatches()[0];
    if (!latestBatch) return null;

    const pullRequest = this.repository.findPullRequest(repository, pullNumber);
    if (!pullRequest?.pullRequest) return null;

    const rows = this.repository
      .listEvaluations(latestBatch.runIds)
      .filter((row) => row.repository === repository && row.pullNumber === pullNumber);
    if (rows.length === 0) return null;

    const evaluationRows = rows.map((row) => ({
      evaluatorId: row.evaluatorId,
      name: evaluatorName(row.evaluatorId),
      severity: normalizeSeverity(row.severity),
      message: row.message,
      score: row.score,
      metadata: parseMetadata(row.metadata),
      aiModel: row.aiModel,
      aiTokensUsed: row.aiTokensUsed,
      evaluatedAt: row.evaluatedAt,
    }));
    const rollup = rollupPullRequests(rows)[0];

    return {
      repository,
      pullNumber,
      title: pullRequest.pullRequest.title,
      author: pullRequest.pullRequest.authorLogin,
      mergedAt: pullRequest.pullRequest.mergedAt,
      createdAt: pullRequest.pullRequest.createdAt,
      url: buildPullRequestUrl(this.config, repository, pullNumber),
      changedFiles: pullRequest.pullRequest.changedFiles,
      additions: pullRequest.pullRequest.additions,
      deletions: pullRequest.pullRequest.deletions,
      evaluations: evaluationRows,
      aggregateScore: average(rollup?.scores ?? []),
      passCount: rollup?.passCount ?? 0,
      warnCount: rollup?.warnCount ?? 0,
      failCount: rollup?.failCount ?? 0,
      evaluatedAt: rows.at(-1)?.evaluatedAt ?? null,
    };
  }

  getPullRequests(options: {
    repository?: string;
    severity?: string[];
    evaluator?: string;
    page?: number;
    pageSize?: number;
  }) {
    const latestBatch = this.repository.listBatches()[0];
    if (!latestBatch) return { items: [], total: 0, page: 1, pageSize: 20 };

    const rows = filterRows(
      this.repository.listEvaluations(latestBatch.runIds),
      options.repository,
    ).filter((row) => !options.evaluator || row.evaluatorId === options.evaluator);
    const rollups = rollupPullRequests(rows).filter((item) => {
      if (!options.severity || options.severity.length === 0) {
        return item.warnCount > 0 || item.failCount > 0;
      }
      return options.severity.some(
        (severity) =>
          (severity === "fail" && item.failCount > 0) ||
          (severity === "warn" && item.warnCount > 0) ||
          (severity === "pass" && item.failCount === 0 && item.warnCount === 0),
      );
    });
    const page = Math.max(1, Math.round(options.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Math.round(options.pageSize ?? 20)));
    const items = rollups
      .sort((a, b) => b.failCount - a.failCount || average(a.scores) - average(b.scores))
      .map((item) => ({
        repository: item.repository,
        pullNumber: item.pullNumber,
        title: item.title,
        author: item.author,
        mergedAt: item.mergedAt,
        url: buildPullRequestUrl(this.config, item.repository, item.pullNumber),
        aggregateScore: average(item.scores),
        passCount: item.passCount,
        warnCount: item.warnCount,
        failCount: item.failCount,
        topIssues: item.issues.slice(0, 3),
      }));

    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total: items.length,
      page,
      pageSize,
    };
  }

  getMetadata() {
    const rows = this.repository.listEvaluations(
      this.repository.listBatches().flatMap((batch) => batch.runIds),
    );
    const evaluators = new Map<string, string>();
    for (const evaluator of getRegisteredEvaluators()) evaluators.set(evaluator.id, evaluator.name);
    for (const row of rows) evaluators.set(row.evaluatorId, evaluatorName(row.evaluatorId));

    return {
      repositories: this.repository.listRepositories().map((item) => item.fullName),
      evaluators: [...evaluators.entries()].map(([id, name]) => ({ id, name })),
      score: {
        rawRange: [0, 2],
        displayScale: 100,
        formula: "raw score × 50",
      },
      staleAfterHours: STALE_AFTER_HOURS,
    };
  }
}

export function summarizeRows(rows: DashboardEvaluationRow[]): DashboardMetricSummary {
  const rollups = rollupPullRequests(rows);
  const totalPullRequests = rollups.length;
  const allPassCount = rollups.filter(
    (item) => item.warnCount === 0 && item.failCount === 0,
  ).length;
  const warningCount = rollups.filter((item) => item.warnCount > 0 && item.failCount === 0).length;
  const failureCount = rollups.filter((item) => item.failCount > 0).length;

  return {
    averageScore: average(rollups.flatMap((item) => item.scores)),
    totalPullRequests,
    allPassCount,
    warningCount,
    failureCount,
    allPassRate: percentage(allPassCount, totalPullRequests),
    warningRate: percentage(warningCount, totalPullRequests),
    failureRate: percentage(failureCount, totalPullRequests),
  };
}

function rollupPullRequests(rows: DashboardEvaluationRow[]): PullRequestRollup[] {
  const groups = new Map<string, PullRequestRollup>();
  for (const row of rows) {
    if (!row.repository || row.pullNumber === null) continue;
    const key = `${row.scanId}:${row.pullRequestId ?? `${row.repository}:${row.pullNumber}`}`;
    const current = groups.get(key) ?? {
      scanId: row.scanId,
      pullRequestId: row.pullRequestId,
      repository: row.repository,
      pullNumber: row.pullNumber,
      title: row.pullTitle ?? "Untitled pull request",
      author: row.author ?? "Unknown",
      mergedAt: row.mergedAt,
      scores: [],
      passCount: 0,
      warnCount: 0,
      failCount: 0,
      issues: [],
    };
    current.scores.push(row.score);
    if (row.severity === "pass") current.passCount += 1;
    if (row.severity === "warn") {
      current.warnCount += 1;
      current.issues.push(row.message);
    }
    if (row.severity === "fail") {
      current.failCount += 1;
      current.issues.push(row.message);
    }
    groups.set(key, current);
  }
  return [...groups.values()];
}

function buildTrend(rows: DashboardEvaluationRow[]): DashboardTrendPoint[] {
  const byDate = new Map<string, DashboardEvaluationRow[]>();
  for (const row of rows) {
    const date = (row.evaluatedAt || "").slice(0, 10);
    if (!date) continue;
    byDate.set(date, [...(byDate.get(date) ?? []), row]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dateRows]) => ({ date, ...summarizeRows(dateRows) }));
}

function buildRepositorySummaries(
  latestBatch: DashboardBatchRecord | null,
  rows: DashboardEvaluationRow[],
): RepositorySummary[] {
  if (!latestBatch) return [];
  const groups = new Map<string, DashboardEvaluationRow[]>();
  for (const row of rows) {
    if (!row.repository) continue;
    groups.set(row.repository, [...(groups.get(row.repository) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([repository, repositoryRows]) => ({
      repository,
      ...summarizeRows(repositoryRows),
      lastScannedAt: latestBatch.completedAt ?? latestBatch.startedAt,
      status: latestBatch.status === "completed" ? "completed" : latestBatch.status,
    }))
    .sort((a, b) => a.failureRate - b.failureRate || a.repository.localeCompare(b.repository));
}

function buildEvaluatorRisks(rows: DashboardEvaluationRow[]): EvaluatorRiskSummary[] {
  const groups = new Map<string, DashboardEvaluationRow[]>();
  for (const row of rows)
    groups.set(row.evaluatorId, [...(groups.get(row.evaluatorId) ?? []), row]);
  return [...groups.entries()]
    .map(([evaluatorId, evaluatorRows]) => {
      const passCount = evaluatorRows.filter((row) => row.severity === "pass").length;
      const warnCount = evaluatorRows.filter((row) => row.severity === "warn").length;
      const failCount = evaluatorRows.filter((row) => row.severity === "fail").length;
      return {
        evaluatorId,
        name: evaluatorName(evaluatorId),
        total: evaluatorRows.length,
        passCount,
        warnCount,
        failCount,
        failRate: percentage(failCount, evaluatorRows.length),
      };
    })
    .sort((a, b) => b.failCount - a.failCount || b.failRate - a.failRate);
}

function buildRiskPullRequests(rows: DashboardEvaluationRow[]) {
  return rollupPullRequests(rows)
    .filter((item) => item.warnCount > 0 || item.failCount > 0)
    .sort((a, b) => b.failCount - a.failCount || average(a.scores) - average(b.scores))
    .slice(0, 10)
    .map((item) => ({
      repository: item.repository,
      pullNumber: item.pullNumber,
      title: item.title,
      author: item.author,
      mergedAt: item.mergedAt,
      url: buildGithubUrl(item.repository, item.pullNumber),
      aggregateScore: average(item.scores),
      passCount: item.passCount,
      warnCount: item.warnCount,
      failCount: item.failCount,
      topIssues: item.issues.slice(0, 3),
    }));
}

function toScanStatusSummary(batch: DashboardBatchRecord): ScanStatusSummary {
  return {
    id: batch.id,
    status:
      calculateFreshness(batch.completedAt ?? batch.startedAt) === "stale" ? "stale" : batch.status,
    startedAt: batch.startedAt,
    completedAt: batch.completedAt,
    currentPhase: batch.currentPhase,
    totalRepositories: batch.totalRepositories,
    completedRepositories: batch.completedRepositories,
    failedRepositories: batch.failedRepositories,
    totalPullRequests: batch.totalPullRequests,
    evaluatedCount: batch.evaluatedCount,
    averageScore: batch.averageScore === null ? null : batch.averageScore * 50,
    lastError: batch.lastError,
  };
}

function filterRows(rows: DashboardEvaluationRow[], repository?: string) {
  return repository ? rows.filter((row) => row.repository === repository) : rows;
}

function calculateFreshness(dataAsOf: string | null): "fresh" | "stale" | "empty" {
  if (!dataAsOf) return "empty";
  return Date.now() - new Date(dataAsOf).getTime() > STALE_AFTER_HOURS * 3_600_000
    ? "stale"
    : "fresh";
}

function normalizeSeverity(value: string): "pass" | "warn" | "fail" {
  return value === "warn" || value === "fail" ? value : "pass";
}

function parseMetadata(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function evaluatorName(evaluatorId: string): string {
  return (
    getRegisteredEvaluators().find((evaluator) => evaluator.id === evaluatorId)?.name ?? evaluatorId
  );
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return (
    Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 50 * 100) / 100
  );
}

function percentage(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 10000) / 100;
}

function clampRangeDays(value: number): number {
  return Number.isFinite(value)
    ? Math.min(Math.max(Math.round(value), 1), 365)
    : DEFAULT_RANGE_DAYS;
}

function clampLimit(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 1), 100) : 20;
}

function buildGithubUrl(repository: string, pullNumber: number): string {
  return `https://github.com/${repository}/pull/${pullNumber}`;
}

function buildPullRequestUrl(
  config: PrScannerConfig,
  repository: string,
  pullNumber: number,
): string {
  if (config.github.platform === "github-enterprise" && config.github.baseUrl) {
    return `${config.github.baseUrl.replace(/\/$/, "")}/${repository}/pull/${pullNumber}`;
  }
  return buildGithubUrl(repository, pullNumber);
}

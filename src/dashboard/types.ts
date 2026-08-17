import type { ScanPhase, ScanStatus } from "../data/db/schema.js";

export type DashboardFreshness = "fresh" | "stale" | "empty";

export interface DashboardFilters {
  rangeDays: number;
  repository?: string;
}

export interface DashboardMetricSummary {
  averageScore: number | null;
  totalPullRequests: number;
  allPassCount: number;
  warningCount: number;
  failureCount: number;
  allPassRate: number;
  warningRate: number;
  failureRate: number;
}

export interface DashboardTrendPoint extends DashboardMetricSummary {
  date: string;
}

export interface RepositorySummary extends DashboardMetricSummary {
  repository: string;
  lastScannedAt: string | null;
  status: ScanStatus | "stale";
}

export interface EvaluatorRiskSummary {
  evaluatorId: string;
  name: string;
  total: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  failRate: number;
}

export interface RiskPullRequest {
  repository: string;
  pullNumber: number;
  title: string;
  author: string;
  mergedAt: string | null;
  url: string;
  aggregateScore: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  topIssues: string[];
}

export interface ScanStatusSummary {
  id: string;
  status: ScanStatus | "stale";
  startedAt: string;
  completedAt: string | null;
  currentPhase: ScanPhase | null;
  totalRepositories: number;
  completedRepositories: number;
  failedRepositories: number;
  totalPullRequests: number;
  evaluatedCount: number;
  averageScore: number | null;
  lastError: string | null;
}

export interface DashboardOverview {
  generatedAt: string;
  dataAsOf: string | null;
  freshness: DashboardFreshness;
  staleAfterHours: number;
  filters: DashboardFilters;
  currentScan: ScanStatusSummary | null;
  summary: DashboardMetricSummary;
  trend: DashboardTrendPoint[];
  repositories: RepositorySummary[];
  evaluatorRisks: EvaluatorRiskSummary[];
  riskPullRequests: RiskPullRequest[];
}

export interface ScanHistoryItem extends ScanStatusSummary {
  repositories: string[];
}

export interface ScanDetails extends ScanHistoryItem {
  repositoryRuns: Array<{
    id: string;
    repository: string | null;
    status: ScanStatus;
    startedAt: string;
    completedAt: string | null;
    currentPhase: ScanPhase | null;
    totalPullRequests: number;
    evaluatedCount: number;
    progressTotal: number;
    progressCompleted: number;
    averageScore: number | null;
    errorMessage: string | null;
  }>;
  summary: DashboardMetricSummary;
}

export interface PullRequestDetails {
  repository: string;
  pullNumber: number;
  title: string;
  author: string;
  mergedAt: string | null;
  createdAt: string;
  url: string;
  changedFiles: number;
  additions: number;
  deletions: number;
  evaluations: Array<{
    evaluatorId: string;
    name: string;
    severity: "pass" | "warn" | "fail";
    message: string;
    score: number;
    metadata: Record<string, unknown> | null;
    aiModel: string | null;
    aiTokensUsed: number | null;
    evaluatedAt: string;
  }>;
  aggregateScore: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  evaluatedAt: string | null;
}

export interface DashboardApiError {
  error: {
    code: string;
    message: string;
  };
}

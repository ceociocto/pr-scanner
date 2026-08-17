export interface DashboardSummary {
  averageScore: number | null;
  totalPullRequests: number;
  allPassCount: number;
  warningCount: number;
  failureCount: number;
  allPassRate: number;
  warningRate: number;
  failureRate: number;
}

export interface DashboardOverview {
  generatedAt: string;
  dataAsOf: string | null;
  freshness: "fresh" | "stale" | "empty";
  staleAfterHours: number;
  filters: { rangeDays: number; repository?: string };
  currentScan: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    currentPhase: string | null;
    totalRepositories: number;
    completedRepositories: number;
    failedRepositories: number;
    totalPullRequests: number;
    evaluatedCount: number;
    averageScore: number | null;
    lastError: string | null;
  } | null;
  summary: DashboardSummary;
  trend: Array<DashboardSummary & { date: string }>;
  repositories: Array<
    DashboardSummary & {
      repository: string;
      lastScannedAt: string | null;
      status: string;
    }
  >;
  evaluatorRisks: Array<{
    evaluatorId: string;
    name: string;
    total: number;
    passCount: number;
    warnCount: number;
    failCount: number;
    failRate: number;
  }>;
  riskPullRequests: Array<{
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
  }>;
}

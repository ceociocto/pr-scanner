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

export interface ScanDetails {
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
  repositories: string[];
  repositoryRuns: Array<{
    id: string;
    repository: string | null;
    status: string;
    startedAt: string;
    completedAt: string | null;
    currentPhase: string | null;
    totalPullRequests: number;
    evaluatedCount: number;
    progressTotal: number;
    progressCompleted: number;
    averageScore: number | null;
    errorMessage: string | null;
  }>;
  summary: DashboardSummary;
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

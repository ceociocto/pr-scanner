import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const overview = {
  generatedAt: "2026-08-18T10:00:00.000Z",
  dataAsOf: "2026-08-18T09:50:00.000Z",
  freshness: "fresh",
  staleAfterHours: 48,
  filters: { rangeDays: 30 },
  currentScan: {
    id: "batch-12345678",
    status: "completed",
    startedAt: "2026-08-18T09:00:00.000Z",
    completedAt: "2026-08-18T09:50:00.000Z",
    currentPhase: "finalizing",
    totalRepositories: 2,
    completedRepositories: 2,
    failedRepositories: 0,
    totalPullRequests: 4,
    evaluatedCount: 4,
    averageScore: 82.5,
    lastError: null,
  },
  summary: {
    averageScore: 82.5,
    totalPullRequests: 4,
    allPassCount: 3,
    warningCount: 1,
    failureCount: 0,
    allPassRate: 75,
    warningRate: 25,
    failureRate: 0,
  },
  trend: [
    {
      date: "2026-08-18",
      averageScore: 82.5,
      totalPullRequests: 4,
      allPassCount: 3,
      warningCount: 1,
      failureCount: 0,
      allPassRate: 75,
      warningRate: 25,
      failureRate: 0,
    },
  ],
  repositories: [
    {
      repository: "owner/repo",
      lastScannedAt: "2026-08-18T09:50:00.000Z",
      status: "completed",
      averageScore: 82.5,
      totalPullRequests: 4,
      allPassCount: 3,
      warningCount: 1,
      failureCount: 0,
      allPassRate: 75,
      warningRate: 25,
      failureRate: 0,
    },
  ],
  evaluatorRisks: [
    {
      evaluatorId: "linked-issues",
      name: "Linked Issues",
      total: 4,
      passCount: 3,
      warnCount: 1,
      failCount: 0,
      failRate: 0,
    },
  ],
  riskPullRequests: [
    {
      repository: "owner/repo",
      pullNumber: 42,
      title: "improve dashboard",
      author: "alice",
      mergedAt: "2026-08-18T09:00:00.000Z",
      url: "https://github.com/owner/repo/pull/42",
      aggregateScore: 62,
      passCount: 10,
      warnCount: 1,
      failCount: 0,
      topIssues: ["Missing linked issue"],
    },
  ],
};

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("Dashboard overview", () => {
  it("renders the management summary and risk queue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => overview }));
    renderApp();
    await waitFor(() => expect(screen.getByText("总体质量分")).toBeInTheDocument());
    expect(screen.getByText("把扫描结果，变成一眼能读懂的信号。")).toBeInTheDocument();
    expect(screen.getByText("总体质量分")).toBeInTheDocument();
    expect(screen.getAllByText("82.5").length).toBeGreaterThan(0);
    expect(screen.getByText("#42 improve dashboard")).toBeInTheDocument();
  });

  it("shows an API error state instead of a broken page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    renderApp();
    await waitFor(() =>
      expect(screen.getByText("暂时无法读取 Dashboard 数据")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });
});

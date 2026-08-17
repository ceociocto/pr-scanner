import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PullRequestPage from "./pages/PullRequestPage";
import ScanDetailsPage from "./pages/ScanDetailsPage";

function renderRoute(path: string, element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Dashboard drilldown pages", () => {
  it("renders scan repository progress and failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "batch-12345678",
          status: "partial",
          startedAt: "2026-08-18T09:00:00Z",
          completedAt: "2026-08-18T09:50:00Z",
          currentPhase: "finalizing",
          totalRepositories: 2,
          completedRepositories: 1,
          failedRepositories: 1,
          totalPullRequests: 4,
          evaluatedCount: 2,
          averageScore: 75,
          lastError: "GitHub unavailable",
          repositories: ["owner/repo"],
          repositoryRuns: [
            {
              id: "run-1",
              repository: "owner/repo",
              status: "completed",
              startedAt: "2026-08-18T09:00:00Z",
              completedAt: "2026-08-18T09:50:00Z",
              currentPhase: "finalizing",
              totalPullRequests: 4,
              evaluatedCount: 2,
              progressTotal: 4,
              progressCompleted: 2,
              averageScore: 1.5,
              errorMessage: null,
            },
          ],
          summary: {
            averageScore: 75,
            totalPullRequests: 2,
            allPassCount: 1,
            warningCount: 0,
            failureCount: 1,
            allPassRate: 50,
            warningRate: 0,
            failureRate: 50,
          },
        }),
      }),
    );
    renderRoute("/scans/batch-123", <ScanDetailsPage />);
    await waitFor(() => expect(screen.getByText("扫描批次详情")).toBeInTheDocument());
    expect(screen.getAllByText("部分完成").length).toBeGreaterThan(0);
    expect(screen.getByText("GitHub unavailable")).toBeInTheDocument();
  });

  it("renders PR evidence and metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          repository: "owner/repo",
          pullNumber: 42,
          title: "fix: dashboard",
          author: "alice",
          mergedAt: "2026-08-18T09:00:00Z",
          createdAt: "2026-08-17T09:00:00Z",
          url: "https://github.com/owner/repo/pull/42",
          changedFiles: 2,
          additions: 30,
          deletions: 5,
          aggregateScore: 50,
          passCount: 1,
          warnCount: 0,
          failCount: 1,
          evaluatedAt: "2026-08-18T09:50:00Z",
          evaluations: [
            {
              evaluatorId: "linked-issues",
              name: "Linked Issues",
              severity: "fail",
              message: "No linked issue found",
              score: 0,
              metadata: { pattern: "#123" },
              aiModel: null,
              aiTokensUsed: null,
              evaluatedAt: "2026-08-18T09:50:00Z",
            },
          ],
        }),
      }),
    );
    renderRoute("/pull-requests/owner%2Frepo/42", <PullRequestPage />);
    await waitFor(() => expect(screen.getByText("规则评估证据")).toBeInTheDocument());
    expect(screen.getByText("No linked issue found")).toBeInTheDocument();
    expect(screen.getByText(/pattern/)).toBeInTheDocument();
  });
});

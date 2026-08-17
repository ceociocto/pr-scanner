import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "../../../config/defaults.js";
import type { PrScannerConfig } from "../../../config/schema.js";
import { closeDb } from "../../../data/db/connection.js";
import { runMigrations } from "../../../data/db/migrate.js";
import { EvaluationRepository } from "../../../data/repositories/evaluation.repository.js";
import { PullRequestRepository } from "../../../data/repositories/pull-request.repository.js";
import { RepositoryRepository } from "../../../data/repositories/repository.repository.js";
import { ScanResultRepository } from "../../../data/repositories/scan-result.repository.js";
import { createDashboardServer } from "../../../dashboard/server.js";

const tempDirectories: string[] = [];
const openServers: Array<{ close: () => Promise<unknown> }> = [];

function createConfig(): PrScannerConfig {
  const directory = mkdtempSync(join(tmpdir(), "pr-scanner-api-"));
  tempDirectories.push(directory);
  return {
    ...DEFAULT_CONFIG,
    repositories: [{ name: "owner/repo" }],
    cache: { ...DEFAULT_CONFIG.cache, dbPath: join(directory, "scanner.db") },
  } as PrScannerConfig;
}

afterEach(async () => {
  for (const server of openServers.splice(0)) await server.close();
  closeDb();
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Dashboard API", () => {
  it("returns health, empty overview, and safe metadata", async () => {
    const config = createConfig();
    const server = createDashboardServer(config);
    openServers.push(server);

    const health = await server.inject({ method: "GET", url: "/api/health" });
    const overview = await server.inject({ method: "GET", url: "/api/dashboard/overview" });
    const metadata = await server.inject({ method: "GET", url: "/api/metadata" });

    expect(health.statusCode).toBe(200);
    expect(health.json().ok).toBe(true);
    expect(overview.statusCode).toBe(200);
    expect(overview.json().freshness).toBe("empty");
    expect(metadata.statusCode).toBe(200);
    expect(metadata.json()).not.toHaveProperty("token");
  });

  it("aggregates a completed scan and exposes PR drilldown without raw secrets", async () => {
    const config = createConfig();
    runMigrations(config);
    const repoId = new RepositoryRepository(config).upsert("owner/repo", "github.com");
    const scanRepository = new ScanResultRepository(config);
    const pullRequests = new PullRequestRepository(config);
    const evaluations = new EvaluationRepository(config);

    scanRepository.createBatch("batch-1", 1, "");
    scanRepository.create("run-1", repoId, "", "batch-1");
    const pullRequestId = pullRequests.upsert(
      repoId,
      {
        id: 42,
        number: 42,
        title: "fix: dashboard endpoint",
        body: "Internal body should not be returned by the API",
        state: "closed",
        merged: true,
        mergedAt: "2026-08-17T10:00:00.000Z",
        closedAt: "2026-08-17T10:00:00.000Z",
        createdAt: "2026-08-16T10:00:00.000Z",
        updatedAt: "2026-08-17T10:00:00.000Z",
        author: { login: "alice", id: 1 },
        mergedBy: { login: "bob", id: 2 },
        baseRef: "main",
        headRef: "fix/dashboard",
        labels: ["internal"],
        draft: false,
        changedFiles: 2,
        additions: 30,
        deletions: 5,
        mergeCommitSha: "abc123",
        reverted: false,
      },
      '{"secret":"must stay server-side"}',
    );
    evaluations.insert(pullRequestId, "run-1", {
      evaluatorId: "pr-size",
      name: "PR Size",
      severity: "pass",
      message: "Size is within the ideal threshold",
      score: 2,
    });
    evaluations.insert(pullRequestId, "run-1", {
      evaluatorId: "linked-issues",
      name: "Linked Issues",
      severity: "fail",
      message: "No linked issue found",
      score: 0,
      metadata: { issuePattern: "#123" },
    });
    scanRepository.update("run-1", 1, 1, 1);
    scanRepository.finalizeBatch("batch-1");

    const server = createDashboardServer(config);
    openServers.push(server);
    const overview = await server.inject({ method: "GET", url: "/api/dashboard/overview" });
    const pullRequest = await server.inject({
      method: "GET",
      url: "/api/pull-requests/owner%2Frepo/42",
    });

    expect(overview.statusCode).toBe(200);
    expect(overview.json().summary).toMatchObject({
      totalPullRequests: 1,
      failureCount: 1,
      averageScore: 50,
    });
    expect(overview.json().riskPullRequests[0].url).toBe("https://github.com/owner/repo/pull/42");
    expect(pullRequest.statusCode).toBe(200);
    expect(pullRequest.json().title).toBe("fix: dashboard endpoint");
    expect(pullRequest.json()).not.toHaveProperty("body");
    expect(pullRequest.json()).not.toHaveProperty("rawJson");
    expect(pullRequest.json().evaluations[1].metadata).toEqual({ issuePattern: "#123" });
  });

  it("serves the built app and supports SPA drilldown routes", async () => {
    const config = createConfig();
    const dashboardRoot = mkdtempSync(join(tmpdir(), "pr-scanner-dashboard-"));
    tempDirectories.push(dashboardRoot);
    writeFileSync(join(dashboardRoot, "index.html"), "<!doctype html><title>PR Signal</title>");

    const server = createDashboardServer(config, { dashboardRoot });
    openServers.push(server);

    const home = await server.inject({ method: "GET", url: "/" });
    const drilldown = await server.inject({ method: "GET", url: "/scans/batch-1" });

    expect(home.statusCode).toBe(200);
    expect(home.headers["content-type"]).toContain("text/html");
    expect(drilldown.statusCode).toBe(200);
    expect(drilldown.body).toContain("PR Signal");
  });
});

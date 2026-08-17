import Fastify, { type FastifyInstance } from "fastify";
import { runMigrations } from "../data/db/migrate.js";
import { closeDb } from "../data/db/connection.js";
import type { PrScannerConfig } from "../config/schema.js";
import { DashboardService } from "./dashboard.service.js";

export function createDashboardServer(config: PrScannerConfig): FastifyInstance {
  runMigrations(config);
  const service = new DashboardService(config);
  const app = Fastify({ logger: false });

  app.get("/api/health", async () => ({
    ok: true,
    service: "pr-scanner-dashboard",
    generatedAt: new Date().toISOString(),
  }));

  app.get("/api/dashboard/overview", async (request) => {
    const query = request.query as { range?: string; rangeDays?: string; repository?: string };
    const rangeDays = Number(query.rangeDays ?? query.range ?? 30);
    return service.getOverview(rangeDays, query.repository || undefined);
  });

  app.get("/api/scans", async (request) => {
    const query = request.query as { limit?: string };
    return { items: service.getScans(Number(query.limit ?? 20)) };
  });

  app.get("/api/scans/:batchId", async (request, reply) => {
    const { batchId } = request.params as { batchId: string };
    const result = service.getScanDetails(batchId);
    if (!result) {
      return reply
        .code(404)
        .send({ error: { code: "SCAN_NOT_FOUND", message: "Scan batch not found" } });
    }
    return result;
  });

  app.get("/api/pull-requests", async (request) => {
    const query = request.query as {
      repository?: string;
      severity?: string;
      evaluator?: string;
      page?: string;
      pageSize?: string;
    };
    return service.getPullRequests({
      repository: query.repository,
      severity: query.severity?.split(",").filter(Boolean),
      evaluator: query.evaluator,
      page: Number(query.page ?? 1),
      pageSize: Number(query.pageSize ?? 20),
    });
  });

  app.get("/api/pull-requests/:repository/:number", async (request, reply) => {
    const params = request.params as { repository: string; number: string };
    const result = service.getPullRequestDetails(params.repository, Number(params.number));
    if (!result) {
      return reply
        .code(404)
        .send({ error: { code: "PULL_REQUEST_NOT_FOUND", message: "Pull request not found" } });
    }
    return result;
  });

  app.get("/api/metadata", async () => service.getMetadata());

  app.setErrorHandler((error, _request, reply) => {
    requestError(reply, error);
  });

  app.addHook("onClose", async () => {
    closeDb();
  });

  return app;
}

function requestError(
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
  error: unknown,
) {
  const message = error instanceof Error ? error.message : "Dashboard request failed";
  reply.code(500).send({ error: { code: "DASHBOARD_ERROR", message } });
}

export async function startDashboardServer(
  config: PrScannerConfig,
  options: { host: string; port: number },
): Promise<FastifyInstance> {
  const app = createDashboardServer(config);
  await app.listen({ host: options.host, port: options.port });
  return app;
}

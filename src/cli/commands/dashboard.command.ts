import { Command } from "commander";
import { loadConfig } from "../../config/loader.js";
import { logger } from "../../utils/logger.js";
import { startDashboardServer } from "../../dashboard/server.js";

export function dashboardCommand(): Command {
  return new Command("dashboard")
    .description("Serve the read-only PR Scanner dashboard")
    .requiredOption("-c, --config <path>", "Path to configuration file")
    .option("--host <host>", "Host to bind", "127.0.0.1")
    .option("--port <port>", "Port to bind", "4173")
    .action(async (options) => {
      const config = loadConfig(options.config);
      const host = options.host as string;
      const port = Number(options.port);
      if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error("Dashboard port must be an integer between 1 and 65535");
      }

      await startDashboardServer(config, { host, port });
      logger.success(`Dashboard listening at http://${host}:${port}`);
    });
}

import { Command } from "commander";
import { loadConfig } from "../../config/loader.js";
import { generateStarterConfig } from "../../config/loader.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ConfigValidationError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

export function configCommand(): Command {
  const cmd = new Command("config");

  cmd.description("Configuration management commands");

  // validate subcommand
  cmd
    .command("validate")
    .description("Validate a configuration file")
    .requiredOption("-c, --config <path>", "Path to configuration file")
    .action(async (options) => {
      try {
        const config = loadConfig(options.config);
        logger.success(
          `Configuration is valid: ${config.repositories.length} repositories configured`,
        );
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          logger.error("Configuration validation failed:");
          for (const issue of error.errors.issues) {
            logger.error(`  - ${issue.path.join(".")}: ${issue.message}`);
          }
          process.exit(1);
        }
        throw error;
      }
    });

  // init subcommand
  cmd
    .command("init")
    .description("Generate a starter configuration file")
    .option("-o, --output <path>", "Output file path", "pr-scanner.config.yaml")
    .action(async (options) => {
      const content = generateStarterConfig();
      const dir = dirname(options.output);
      if (dir !== ".") {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(options.output, content, "utf-8");
      logger.success(`Starter configuration written to ${options.output}`);
    });

  return cmd;
}

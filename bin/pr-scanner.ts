#!/usr/bin/env node
import { Command } from "commander";
import { scanCommand } from "../src/cli/commands/scan.command.js";
import { configCommand } from "../src/cli/commands/config.command.js";
import { handleError } from "../src/cli/cli-error-handler.js";
import { logger } from "../src/utils/logger.js";

const program = new Command();

program
  .name("pr-scanner")
  .description("AI-powered PR quality scanner for GitHub repositories")
  .version("0.1.0");

// Register commands
program.addCommand(scanCommand());
program.addCommand(configCommand());

// Handle errors
program.exitOverride();

const main = async () => {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    handleError(error);
  }
};

main().catch((error) => handleError(error));

export { program };

import { PrScannerError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/** Handle errors and exit with appropriate code */
export function handleError(error: unknown): void {
  if (error instanceof PrScannerError) {
    logger.error(`[${error.code}] ${error.message}`);
    process.exit(error.exitCode);
  }

  if (error instanceof Error) {
    if (error.message.includes("EEXIT:")) {
      // Commander exit override — not a real error
      return;
    }
    logger.error(error.message);
    process.exit(1);
  }

  logger.error(String(error));
  process.exit(1);
}

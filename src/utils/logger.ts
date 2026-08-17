import { dim, blue, yellow, red, green } from "picocolors";

type LogLevel = "debug" | "info" | "warn" | "error";

export class Logger {
  private debugEnabled: boolean;

  constructor(debugEnabled = false) {
    this.debugEnabled = debugEnabled;
  }

  setDebug(enabled: boolean) {
    this.debugEnabled = enabled;
  }

  debug(message: string, ...args: unknown[]) {
    if (this.debugEnabled) {
      process.stderr.write(dim(`[DEBUG] ${message}`) + "\n");
      if (args.length > 0) {
        process.stderr.write(dim(JSON.stringify(args, null, 2)) + "\n");
      }
    }
  }

  info(message: string) {
    process.stderr.write(blue(`[INFO] ${message}`) + "\n");
  }

  warn(message: string) {
    process.stderr.write(yellow(`[WARN] ${message}`) + "\n");
  }

  error(message: string) {
    process.stderr.write(red(`[ERROR] ${message}`) + "\n");
  }

  success(message: string) {
    process.stderr.write(green(`[OK] ${message}`) + "\n");
  }

  /** Write non-log output to stdout (for pipe/redirect) */
  output(data: string) {
    process.stdout.write(data);
  }
}

export const logger = new Logger();

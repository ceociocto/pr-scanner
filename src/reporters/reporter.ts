import type { ScanResult } from "../scanner/types.js";

/** Abstract interface for report output formats */
export interface Reporter {
  render(result: ScanResult): string;
}

export type ReporterFormat = "json" | "csv" | "markdown" | "console" | "ai-insight";

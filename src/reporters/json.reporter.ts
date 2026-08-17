import type { Reporter } from "./reporter.js";
import type { ScanResult } from "../scanner/types.js";

/** JSON format reporter */
export class JsonReporter implements Reporter {
  render(result: ScanResult): string {
    return JSON.stringify(result, null, 2);
  }
}

import type { Reporter } from "./reporter.js";
import type { ScanResult } from "../scanner/types.js";

/** AI Insight reporter — skeleton for Phase 6 */
export class AiInsightReporter implements Reporter {
  render(_result: ScanResult): string {
    return "AI Insight reports require AI to be enabled. Run with --ai flag or set ai.enabled: true in config.";
  }
}

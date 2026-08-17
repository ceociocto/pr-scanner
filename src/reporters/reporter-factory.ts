import type { Reporter } from "./reporter.js";
import type { ReporterFormat } from "./reporter.js";
import { JsonReporter } from "./json.reporter.js";
import { CsvReporter } from "./csv.reporter.js";
import { MarkdownReporter } from "./markdown.reporter.js";
import { ConsoleReporter } from "./console.reporter.js";
import { AiInsightReporter } from "./ai-insight.reporter.js";

/** Create a reporter based on format name */
export function createReporter(format: ReporterFormat): Reporter {
  switch (format) {
    case "json":
      return new JsonReporter();
    case "csv":
      return new CsvReporter();
    case "markdown":
      return new MarkdownReporter();
    case "ai-insight":
      return new AiInsightReporter();
    case "console":
    default:
      return new ConsoleReporter();
  }
}

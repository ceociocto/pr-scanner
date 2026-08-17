import type { Evaluator, EvaluationResult } from "../evaluator.js";
import type { EnrichedPullRequest } from "../../github/types.js";
import type { StandardsConfig } from "../../config/schema.js";

export class CiStatusEvaluator implements Evaluator {
  readonly id = "ci-status";
  readonly name = "CI Status";
  readonly category = "structural" as const;

  isEnabled(config: StandardsConfig): boolean {
    return config.ciStatus.enabled;
  }

  evaluate(pr: EnrichedPullRequest, config: StandardsConfig): EvaluationResult {
    if (pr.checkRuns.length === 0) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "warn",
        message: "No CI check runs found",
        score: 1,
        metadata: { checkRunCount: 0 },
      };
    }

    if (config.ciStatus.requireAllChecks) {
      const allRequired = pr.checkRuns.every(
        (cr) => cr.conclusion === "success" || cr.conclusion === "skipped",
      );

      if (allRequired) {
        return {
          evaluatorId: this.id,
          name: this.name,
          severity: "pass",
          message: `All ${pr.checkRuns.length} CI checks passed`,
          score: 2,
          metadata: { checkRunCount: pr.checkRuns.length },
        };
      }

      const failures = pr.checkRuns
        .filter((cr) => cr.conclusion === "failure" || cr.conclusion === "timed_out")
        .map((cr) => cr.name);

      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "fail",
        message: `${failures.length} CI check(s) failed: ${failures.join(", ")}`,
        score: 0,
        metadata: { failures, checkRunCount: pr.checkRuns.length },
      };
    }

    // Default: just check no failures among completed runs
    const failures = pr.checkRuns.filter(
      (cr) => cr.conclusion === "failure" || cr.conclusion === "timed_out",
    );

    if (failures.length === 0) {
      return {
        evaluatorId: this.id,
        name: this.name,
        severity: "pass",
        message: `No CI failures among ${pr.checkRuns.length} check runs`,
        score: 2,
        metadata: { checkRunCount: pr.checkRuns.length },
      };
    }

    return {
      evaluatorId: this.id,
      name: this.name,
      severity: "fail",
      message: `${failures.length} CI check(s) failed: ${failures.map((cr) => cr.name).join(", ")}`,
      score: 0,
      metadata: {
        failures: failures.map((cr) => cr.name),
        checkRunCount: pr.checkRuns.length,
      },
    };
  }
}

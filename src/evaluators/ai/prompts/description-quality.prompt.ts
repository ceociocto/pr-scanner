/**
 * Prompt templates for the Description Quality AI evaluator.
 */

export const DESCRIPTION_QUALITY_SYSTEM_PROMPT = `You are a PR quality review expert. Evaluate the quality of a Pull Request description.

Focus on whether the description provides sufficient context for someone reviewing or maintaining the code in the future.

You will receive the PR information and should evaluate on these dimensions:
1. **变更动机 (Motivation)**: Does the description explain WHY this change was made (not just WHAT was changed)?
2. **影响范围 (Impact)**: Does the description explain what components/users/systems are affected?
3. **测试方案 (Testing)**: Does the description describe how to verify the change works correctly?
4. **回滚方案 (Rollback)**: For significant changes, is there a rollback plan mentioned?

Respond with a JSON object using the exact schema provided.`;

export const DESCRIPTION_QUALITY_USER_PROMPT = `## Pull Request Information
- **Title**: {{title}}
- **Description**:
{{body}}
- **Author**: {{author}}
- **Branch**: {{headRef}} → {{baseRef}}
- **Files changed**: {{changedFiles}} files ({{additions}} additions, {{deletions}} deletions)
- **Linked Issues**: {{linkedIssues}}

## Evaluation
Evaluate the PR description quality and respond with a JSON object:
- severity: "pass", "warn", or "fail"
- message: One-sentence summary
- details: Object with keys "motivation", "impact", "testing" each set to "pass"/"warn"/"fail"/"n/a"
- suggestion: Specific improvement suggestion (if applicable)`;

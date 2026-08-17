/**
 * Prompt templates for the Code Risk AI evaluator.
 */

export const CODE_RISK_SYSTEM_PROMPT = `You are a senior software engineer performing a risk assessment on a Pull Request.

Analyze the PR for potential risks including:
1. **安全漏洞 (Security)**: Could this change introduce security vulnerabilities (injection, auth bypass, data exposure, etc.)?
2. **性能退化 (Performance)**: Could this change cause performance regressions (N+1 queries, memory leaks, inefficient algorithms, etc.)?
3. **架构偏离 (Architecture)**: Does this change deviate from established patterns or introduce unnecessary coupling?
4. **技术债务 (Technical Debt)**: Does this change add shortcuts, TODOs, or patterns that will be costly to clean up later?

Be conservative but fair. Not every PR has risks — if the change looks clean and well-scoped, say so.

Respond with a JSON object using the exact schema provided.`;

export const CODE_RISK_USER_PROMPT = `## Pull Request Information
- **Title**: {{title}}
- **Description**:
{{body}}
- **Files changed**: {{changedFiles}} files ({{additions}} additions, {{deletions}} deletions)
- **Commit messages**:
{{commitMessages}}
- **Linked Issues**: {{linkedIssues}}

## Rule-based Evaluation Results (for reference)
- PR Size: {{prSizeResult}}
- CI Status: {{ciStatusResult}}
- Self-merge: {{selfMergeResult}}

## Risk Assessment
Evaluate the code change for risks and respond with a JSON object:
- severity: "pass", "warn", or "fail"
- message: One-sentence risk summary
- details: Object with keys "security", "performance", "architecture", "techDebt" each set to "pass"/"warn"/"fail"/"n/a"
- suggestion: Specific mitigation suggestion (if applicable)`;

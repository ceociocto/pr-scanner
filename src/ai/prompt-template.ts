import type { PromptContext } from "./types.js";

/**
 * Simple prompt template engine.
 * Replaces {{variable}} placeholders with values from context.
 */
export function renderPrompt(template: string, context: PromptContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = context[key];
    if (value === undefined) {
      return "";
    }
    return String(value);
  });
}

/**
 * Build a prompt from system prompt template and user prompt template
 * with shared context variables.
 */
export function buildPrompt(
  systemTemplate: string,
  userTemplate: string,
  context: PromptContext,
): { system: string; user: string } {
  return {
    system: renderPrompt(systemTemplate, context),
    user: renderPrompt(userTemplate, context),
  };
}

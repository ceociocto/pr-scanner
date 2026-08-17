/**
 * Format milliseconds into a human-readable duration string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)}h`;
  return `${(ms / 86_400_000).toFixed(1)}d`;
}

/**
 * Format hours into a human-readable duration string.
 */
export function formatHours(hours: number): string {
  return formatDuration(hours * 3_600_000);
}

/**
 * Parse an ISO date string to a Date object.
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * Get the time difference in milliseconds between two ISO date strings.
 */
export function timeDiffMs(start: string, end: string): number {
  return new Date(end).getTime() - new Date(start).getTime();
}

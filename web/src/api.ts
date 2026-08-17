import type { DashboardOverview } from "./types";

export async function fetchOverview(
  rangeDays: number,
  repository: string,
): Promise<DashboardOverview> {
  const params = new URLSearchParams({ rangeDays: String(rangeDays) });
  if (repository) params.set("repository", repository);
  const response = await fetch(`/api/dashboard/overview?${params.toString()}`);
  if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);
  return response.json() as Promise<DashboardOverview>;
}

import type { DashboardOverview, PullRequestDetails, ScanDetails } from "./types";

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

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);
  return response.json() as Promise<T>;
}

export function fetchScanDetails(batchId: string): Promise<ScanDetails> {
  return fetchJson<ScanDetails>(`/api/scans/${encodeURIComponent(batchId)}`);
}

export function fetchPullRequestDetails(
  repository: string,
  pullNumber: string,
): Promise<PullRequestDetails> {
  return fetchJson<PullRequestDetails>(
    `/api/pull-requests/${encodeURIComponent(repository)}/${pullNumber}`,
  );
}

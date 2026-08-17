import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const scanStatuses = ["running", "completed", "partial", "failed"] as const;
export type ScanStatus = (typeof scanStatuses)[number];

export const scanPhases = ["connecting", "fetching", "evaluating", "finalizing"] as const;
export type ScanPhase = (typeof scanPhases)[number];

/** Tracked repositories */
export const repositories = sqliteTable("repositories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull().unique(),
  platform: text("platform").notNull(),
  lastScannedAt: text("last_scanned_at"),
});

/** Cached pull request raw data */
export const pullRequests = sqliteTable("pull_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  repoId: integer("repo_id").references(() => repositories.id),
  pullNumber: integer("pull_number").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  state: text("state").notNull(),
  merged: integer("merged", { mode: "boolean" }).notNull(),
  mergedAt: text("merged_at"),
  closedAt: text("closed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  authorLogin: text("author_login").notNull(),
  mergedByLogin: text("merged_by_login"),
  baseRef: text("base_ref").notNull(),
  headRef: text("head_ref").notNull(),
  labels: text("labels"),
  draft: integer("draft", { mode: "boolean" }).notNull(),
  changedFiles: integer("changed_files").notNull(),
  additions: integer("additions").notNull(),
  deletions: integer("deletions").notNull(),
  mergeCommitSha: text("merge_commit_sha"),
  rawJson: text("raw_json"),
  rawJsonFetchedAt: text("raw_json_fetched_at"),
});

/** Evaluation snapshots */
export const evaluations = sqliteTable("evaluations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pullRequestId: integer("pull_request_id").references(() => pullRequests.id),
  scanId: text("scan_id").notNull(),
  evaluatorId: text("evaluator_id").notNull(),
  severity: text("severity").notNull(),
  message: text("message").notNull(),
  score: real("score").notNull(),
  metadata: text("metadata"),
  evaluatedAt: text("evaluated_at").notNull(),
  aiModel: text("ai_model"),
  aiTokensUsed: integer("ai_tokens_used"),
});

/** Scan run metadata (for dashboard) */
export const scanRuns = sqliteTable("scan_runs", {
  id: text("id").primaryKey(),
  batchId: text("batch_id"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  repositoryId: integer("repository_id").references(() => repositories.id),
  totalPullRequests: integer("total_pull_requests").notNull(),
  evaluatedCount: integer("evaluated_count").notNull(),
  averageScore: real("average_score"),
  configHash: text("config_hash"),
  status: text("status", { enum: scanStatuses }).notNull().default("completed"),
  errorMessage: text("error_message"),
  progressTotal: integer("progress_total").notNull().default(0),
  progressCompleted: integer("progress_completed").notNull().default(0),
  currentPhase: text("current_phase", { enum: scanPhases }).notNull().default("finalizing"),
});

/** A group of repository scan runs started by one CLI invocation. */
export const scanBatches = sqliteTable("scan_batches", {
  id: text("id").primaryKey(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  status: text("status", { enum: scanStatuses }).notNull().default("running"),
  totalRepositories: integer("total_repositories").notNull(),
  completedRepositories: integer("completed_repositories").notNull().default(0),
  failedRepositories: integer("failed_repositories").notNull().default(0),
  totalPullRequests: integer("total_pull_requests").notNull().default(0),
  evaluatedCount: integer("evaluated_count").notNull().default(0),
  averageScore: real("average_score"),
  currentPhase: text("current_phase", { enum: scanPhases }),
  lastError: text("last_error"),
  configHash: text("config_hash"),
});

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, GitBranch, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { fetchScanDetails } from "../api";
import type { ScanDetails } from "../types";

export default function ScanDetailsPage() {
  const { batchId = "" } = useParams();
  const query = useQuery({
    queryKey: ["scan", batchId],
    queryFn: () => fetchScanDetails(batchId),
    refetchInterval: (item) => (item.state.data?.status === "running" ? 15_000 : false),
  });
  if (query.isLoading) return <DetailState text="正在读取扫描批次" />;
  if (query.isError || !query.data) return <DetailState text="找不到这个扫描批次" error />;
  return <ScanDetailsContent details={query.data} />;
}

function ScanDetailsContent({ details }: { details: ScanDetails }) {
  const progress = details.totalPullRequests
    ? Math.round((details.evaluatedCount / details.totalPullRequests) * 100)
    : details.status === "completed"
      ? 100
      : 0;
  return (
    <div className="detail-page">
      <Link className="back-link" to="/">
        <ArrowLeft size={15} />
        返回总览
      </Link>
      <header className="detail-header">
        <div>
          <p className="eyebrow">SCAN BATCH · {details.id.slice(0, 8)}</p>
          <h1>扫描批次详情</h1>
          <p className="detail-subtitle">
            {formatDateTime(details.startedAt)} 开始 · {details.repositories.length} 个仓库参与
          </p>
        </div>
        <StatusBadge status={details.status} />
      </header>
      <section className="detail-metrics">
        <DetailMetric label="批次状态" value={statusLabel(details.status)} />
        <DetailMetric
          label="PR 评估"
          value={`${details.evaluatedCount} / ${details.totalPullRequests}`}
        />
        <DetailMetric
          label="质量分"
          value={details.averageScore === null ? "—" : details.averageScore.toFixed(1)}
        />
        <DetailMetric
          label="仓库完成"
          value={`${details.completedRepositories} / ${details.totalRepositories}`}
        />
      </section>
      <section className="detail-columns">
        <article className="surface detail-card">
          <SectionHeading title="运行进度" eyebrow="RUN PROGRESS" />
          <div className="large-progress">
            <div>
              <strong>{progress}%</strong>
              <span>{details.currentPhase ? phaseLabel(details.currentPhase) : "已汇总"}</span>
            </div>
            <div className="progress-rail">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="detail-facts">
            <span>
              <Clock3 size={14} />
              开始 {formatDateTime(details.startedAt)}
            </span>
            <span>
              <GitBranch size={14} />
              {details.repositories.join(" · ") || "暂无仓库"}
            </span>
          </div>
          {details.lastError && (
            <div className="inline-error">
              <AlertTriangle size={14} />
              {details.lastError}
            </div>
          )}
        </article>
        <article className="surface detail-card">
          <SectionHeading title="本批次结果" eyebrow="QUALITY SNAPSHOT" />
          <div className="result-list">
            <ResultLine label="全部通过" value={details.summary.allPassCount} tone="good" />
            <ResultLine label="警告" value={details.summary.warningCount} tone="warn" />
            <ResultLine label="失败" value={details.summary.failureCount} tone="bad" />
          </div>
          <p className="definition-note">
            批次评分沿用 PR Scanner 现有评分口径，显示值为原始 0–2 分数 × 50。
          </p>
        </article>
      </section>
      <section className="surface detail-card repository-runs">
        <SectionHeading title="仓库运行明细" eyebrow="REPOSITORY RUNS" />
        <div className="run-table">
          <div className="run-table-head">
            <span>仓库</span>
            <span>状态</span>
            <span>进度</span>
            <span>质量分</span>
            <span>错误</span>
          </div>
          {details.repositoryRuns.map((run) => (
            <div className="run-table-row" key={run.id}>
              <strong>{run.repository ?? "未知仓库"}</strong>
              <StatusBadge status={run.status} />
              <span>
                {run.progressCompleted} / {run.progressTotal || run.totalPullRequests}
              </span>
              <span>{run.averageScore === null ? "—" : (run.averageScore * 50).toFixed(1)}</span>
              <span className="run-error">{run.errorMessage ?? "—"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ResultLine({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="result-line">
      <span className={`result-icon ${tone}`}>
        {tone === "good" ? (
          <CheckCircle2 size={15} />
        ) : tone === "bad" ? (
          <XCircle size={15} />
        ) : (
          <AlertTriangle size={15} />
        )}
      </span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-metric">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
export function SectionHeading({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <div className="panel-heading">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
    </div>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const icon =
    status === "completed" ? (
      <CheckCircle2 size={14} />
    ) : status === "failed" ? (
      <XCircle size={14} />
    ) : (
      <AlertTriangle size={14} />
    );
  return (
    <span className={`status-badge ${status}`}>
      {icon}
      {statusLabel(status)}
    </span>
  );
}
export function statusLabel(status: string) {
  return (
    (
      {
        completed: "已完成",
        partial: "部分完成",
        failed: "失败",
        running: "进行中",
        stale: "已过期",
      } as Record<string, string>
    )[status] ?? status
  );
}
export function phaseLabel(phase: string) {
  return (
    (
      {
        connecting: "连接 GitHub",
        fetching: "拉取 PR 数据",
        evaluating: "执行质量评估",
        finalizing: "汇总扫描结果",
      } as Record<string, string>
    )[phase] ?? phase
  );
}
export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
function DetailState({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <div className="state-card">
      <span className={error ? "icon-bad" : "icon-good"}>
        {error ? <XCircle size={24} /> : <Clock3 size={24} />}
      </span>
      <h2>{text}</h2>
      <Link className="back-link standalone" to="/">
        <ArrowLeft size={15} />
        返回总览
      </Link>
    </div>
  );
}

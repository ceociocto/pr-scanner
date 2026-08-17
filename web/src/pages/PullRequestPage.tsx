import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  MessageSquareQuote,
  XCircle,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { fetchPullRequestDetails } from "../api";
import type { PullRequestDetails } from "../types";
import { formatDateTime, SectionHeading, StatusBadge } from "./ScanDetailsPage";

export default function PullRequestPage() {
  const params = useParams();
  const repository = decodeURIComponent(params.repository ?? "");
  const pullNumber = params.number ?? "";
  const query = useQuery({
    queryKey: ["pull-request", repository, pullNumber],
    queryFn: () => fetchPullRequestDetails(repository, pullNumber),
  });
  if (query.isLoading)
    return (
      <div className="state-card">
        <MessageSquareQuote size={24} />
        <h2>正在读取 PR 评估</h2>
      </div>
    );
  if (query.isError || !query.data)
    return (
      <div className="state-card">
        <XCircle className="icon-bad" size={24} />
        <h2>找不到这个 PR 的评估结果</h2>
        <Link className="back-link standalone" to="/">
          <ArrowLeft size={15} />
          返回总览
        </Link>
      </div>
    );
  return <PullRequestContent details={query.data} />;
}

function PullRequestContent({ details }: { details: PullRequestDetails }) {
  const severity =
    details.failCount > 0 ? "failed" : details.warnCount > 0 ? "partial" : "completed";
  return (
    <div className="detail-page">
      <Link className="back-link" to="/">
        <ArrowLeft size={15} />
        返回总览
      </Link>
      <header className="detail-header pr-header">
        <div>
          <p className="eyebrow">
            PULL REQUEST · {details.repository} · #{details.pullNumber}
          </p>
          <h1>{details.title}</h1>
          <p className="detail-subtitle">
            {details.author} 提交 ·{" "}
            {details.mergedAt ? `合并于 ${formatDateTime(details.mergedAt)}` : "尚未合并"}
          </p>
        </div>
        <div className="pr-head-actions">
          <StatusBadge status={severity} />
          <a className="external-link" href={details.url} target="_blank" rel="noreferrer">
            打开 GitHub <ExternalLink size={14} />
          </a>
        </div>
      </header>
      <section className="detail-metrics">
        <DetailMetric label="质量分" value={`${details.aggregateScore.toFixed(1)} / 100`} />
        <DetailMetric label="通过规则" value={String(details.passCount)} />
        <DetailMetric label="警告规则" value={String(details.warnCount)} />
        <DetailMetric label="失败规则" value={String(details.failCount)} />
      </section>
      <section className="pr-context">
        <div>
          <FileCode2 size={15} />
          {details.changedFiles} 个文件
        </div>
        <div>
          <span className="plus">+{details.additions}</span> /{" "}
          <span className="minus">-{details.deletions}</span> 行变更
        </div>
        <div>评估于 {details.evaluatedAt ? formatDateTime(details.evaluatedAt) : "—"}</div>
      </section>
      <section className="surface detail-card evaluation-card">
        <SectionHeading title="规则评估证据" eyebrow="EVALUATION EVIDENCE" />
        <div className="evaluation-list">
          {details.evaluations.map((evaluation) => (
            <EvaluationRow
              evaluation={evaluation}
              key={`${evaluation.evaluatorId}-${evaluation.evaluatedAt}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function EvaluationRow({ evaluation }: { evaluation: PullRequestDetails["evaluations"][number] }) {
  const Icon =
    evaluation.severity === "pass"
      ? CheckCircle2
      : evaluation.severity === "fail"
        ? XCircle
        : AlertTriangle;
  return (
    <article className={`evaluation-row ${evaluation.severity}`}>
      <div className="evaluation-title">
        <Icon size={17} />
        <div>
          <strong>{evaluation.name}</strong>
          <small>{evaluation.evaluatorId}</small>
        </div>
        <StatusBadge
          status={
            evaluation.severity === "pass"
              ? "completed"
              : evaluation.severity === "fail"
                ? "failed"
                : "partial"
          }
        />
      </div>
      <p>{evaluation.message}</p>
      {evaluation.metadata && <pre>{JSON.stringify(evaluation.metadata, null, 2)}</pre>}
      {evaluation.aiModel && (
        <small className="ai-meta">
          AI · {evaluation.aiModel}
          {evaluation.aiTokensUsed ? ` · ${evaluation.aiTokensUsed} tokens` : ""}
        </small>
      )}
    </article>
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

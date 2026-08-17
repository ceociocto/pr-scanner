import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Database,
  Filter,
  Gauge,
  GitPullRequest,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchOverview } from "./api";
import type { DashboardOverview } from "./types";

const RANGE_OPTIONS = [7, 30, 90];

export default function App() {
  const [rangeDays, setRangeDays] = useState(30);
  const [repository, setRepository] = useState("");
  const overview = useQuery({
    queryKey: ["overview", rangeDays, repository],
    queryFn: () => fetchOverview(rangeDays, repository),
    refetchInterval: (query) =>
      query.state.data?.currentScan?.status === "running" ? 15_000 : 60_000,
  });

  return (
    <main className="app-shell">
      <TopBar
        overview={overview.data}
        onRefresh={() => void overview.refetch()}
        isRefreshing={overview.isFetching}
      />
      <div className="page-frame">
        <header className="page-intro">
          <div>
            <p className="eyebrow">PR / SIGNAL · ENGINEERING QUALITY</p>
            <h1>把扫描结果，变成一眼能读懂的信号。</h1>
            <p className="intro-copy">
              面向管理层的工程质量驾驶舱：先看整体健康度，再追溯仓库、规则和具体 PR。
            </p>
          </div>
          <div className="filter-bar" aria-label="Dashboard filters">
            <div className="filter-label">
              <Filter size={15} />
              筛选
            </div>
            <select
              value={repository}
              onChange={(event) => setRepository(event.target.value)}
              aria-label="仓库"
            >
              <option value="">全部仓库</option>
              {overview.data?.repositories.map((item) => (
                <option key={item.repository} value={item.repository}>
                  {item.repository}
                </option>
              ))}
            </select>
            <div className="range-switcher" role="group" aria-label="时间范围">
              {RANGE_OPTIONS.map((option) => (
                <button
                  className={rangeDays === option ? "active" : ""}
                  key={option}
                  onClick={() => setRangeDays(option)}
                >
                  {option} 天
                </button>
              ))}
            </div>
          </div>
        </header>

        {overview.isLoading && <LoadingState />}
        {overview.isError && <ErrorState onRetry={() => void overview.refetch()} />}
        {overview.data && <DashboardContent overview={overview.data} />}
      </div>
    </main>
  );
}

function TopBar({
  overview,
  onRefresh,
  isRefreshing,
}: {
  overview?: DashboardOverview;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const status = overview?.currentScan?.status ?? "empty";
  const statusLabel =
    status === "completed"
      ? "最近扫描完成"
      : status === "running"
        ? "扫描进行中"
        : status === "partial"
          ? "部分完成"
          : status === "stale"
            ? "数据已过期"
            : "等待首次扫描";
  return (
    <nav className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <span>PR</span>
          <span>↗</span>
        </div>
        <div>
          <strong>PR Signal</strong>
          <small>工程质量驾驶舱</small>
        </div>
      </div>
      <div className="topbar-meta">
        <span className={`status-dot status-${status}`}>
          <span className="dot" />
          {statusLabel}
        </span>
        <span className="updated-at">
          {overview?.dataAsOf ? `数据截至 ${formatDateTime(overview.dataAsOf)}` : "暂无扫描数据"}
        </span>
        <button className="icon-button" onClick={onRefresh} aria-label="刷新数据" title="刷新数据">
          <RefreshCw size={16} className={isRefreshing ? "spin" : ""} />
        </button>
      </div>
    </nav>
  );
}

function DashboardContent({ overview }: { overview: DashboardOverview }) {
  if (overview.freshness === "empty") return <EmptyState />;
  const score = overview.summary.averageScore ?? 0;
  return (
    <>
      {overview.freshness === "stale" && (
        <div className="notice notice-warning">
          <Clock3 size={17} />
          <span>
            当前数据已超过 {overview.staleAfterHours} 小时未更新，请确认扫描任务是否正常运行。
          </span>
        </div>
      )}
      {overview.currentScan?.status === "partial" && (
        <div className="notice notice-warning">
          <AlertTriangle size={17} />
          <span>
            最近批次部分完成：{overview.currentScan.failedRepositories} 个仓库未能完成扫描。
          </span>
        </div>
      )}
      <section className="signal-grid" aria-label="总体指标">
        <article className="score-panel">
          <div className="panel-kicker">
            <Gauge size={16} />
            总体质量分
          </div>
          <div className="score-value">
            {score.toFixed(1)}
            <span>/ 100</span>
          </div>
          <div className="score-rail">
            <span style={{ width: `${Math.min(score, 100)}%` }} />
          </div>
          <p>基于最近一次扫描的 {overview.summary.totalPullRequests} 个 PR，原始评分 × 50。</p>
        </article>
        <Metric
          label="扫描 PR"
          value={overview.summary.totalPullRequests}
          detail={`${overview.currentScan?.totalRepositories ?? 0} 个仓库`}
          icon={<GitPullRequest size={17} />}
        />
        <Metric
          label="全部通过"
          value={`${overview.summary.allPassRate.toFixed(1)}%`}
          detail={`${overview.summary.allPassCount} 个 PR`}
          icon={<CheckCircle2 size={17} />}
          tone="good"
        />
        <Metric
          label="需要关注"
          value={overview.summary.warningCount + overview.summary.failureCount}
          detail={`${overview.summary.failureRate.toFixed(1)}% 失败`}
          icon={<ShieldAlert size={17} />}
          tone="risk"
        />
      </section>

      <section className="main-grid">
        <article className="surface trend-panel">
          <PanelHeading
            eyebrow="QUALITY OVER TIME"
            title="质量趋势"
            detail={`${overview.filters.rangeDays} 天窗口`}
          />
          <div className="chart-wrap">
            {overview.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={overview.trend}
                  margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#477b66" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#477b66" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#dedbd2" vertical={false} strokeDasharray="4 5" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDate}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#77766f", fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#77766f", fontSize: 11 }}
                  />
                  <Tooltip content={<TrendTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="averageScore"
                    stroke="#3d735f"
                    strokeWidth={2.5}
                    fill="url(#scoreFill)"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty />
            )}
          </div>
        </article>
        <ScanStatusPanel scan={overview.currentScan} />
      </section>

      <section className="section-grid">
        <article className="surface repository-panel">
          <PanelHeading eyebrow="REPOSITORY PULSE" title="仓库横向对比" detail="最近一次扫描" />
          <RepositoryTable items={overview.repositories} />
        </article>
        <article className="surface rules-panel">
          <PanelHeading eyebrow="TOP FINDINGS" title="规则风险排行" detail="失败 PR 数" />
          <RuleList items={overview.evaluatorRisks} />
        </article>
      </section>

      <section className="surface risk-panel">
        <PanelHeading
          eyebrow="REVIEW QUEUE"
          title="重点风险 PR"
          detail={`${overview.riskPullRequests.length} 个需要关注`}
        />
        <RiskTable items={overview.riskPullRequests} />
      </section>
      <footer className="page-footer">
        <Database size={14} />
        指标来自已完成的 PR 评估快照 · 页面自动刷新 · 状态同时使用颜色、图标和文字表达
      </footer>
    </>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <article className={`metric-panel tone-${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ScanStatusPanel({ scan }: { scan: DashboardOverview["currentScan"] }) {
  if (!scan)
    return (
      <article className="surface scan-panel empty-panel">
        <CircleDashed size={24} />
        <h2>等待第一次扫描</h2>
        <p>运行 CLI 扫描后，这里会显示批次进度和数据新鲜度。</p>
      </article>
    );
  const progress = scan.totalPullRequests
    ? Math.round((scan.evaluatedCount / scan.totalPullRequests) * 100)
    : scan.status === "completed"
      ? 100
      : 0;
  return (
    <article className="surface scan-panel">
      <PanelHeading eyebrow="LATEST RUN" title="扫描状态" detail={scan.id.slice(0, 8)} />
      <div className="scan-status-line">
        <StatusIcon status={scan.status} />
        <div>
          <strong>{scanStatusLabel(scan.status)}</strong>
          <small>{scan.currentPhase ? phaseLabel(scan.currentPhase) : "已汇总"}</small>
        </div>
      </div>
      <div className="progress-row">
        <span>PR 评估进度</span>
        <strong>
          {scan.evaluatedCount} / {scan.totalPullRequests}
        </strong>
      </div>
      <div className="progress-rail">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="scan-facts">
        <span>
          <b>{scan.completedRepositories}</b> 已完成
        </span>
        <span>
          <b>{scan.failedRepositories}</b> 失败
        </span>
        <span>
          <b>{scan.totalRepositories}</b> 仓库
        </span>
      </div>
      {scan.lastError && (
        <div className="inline-error">
          <AlertTriangle size={14} />
          {scan.lastError}
        </div>
      )}
    </article>
  );
}

function RepositoryTable({ items }: { items: DashboardOverview["repositories"] }) {
  if (!items.length) return <ChartEmpty />;
  return (
    <div className="repository-list">
      {items.map((item) => (
        <div className="repository-row" key={item.repository}>
          <div className="repo-name">
            <span className="repo-avatar">{item.repository.slice(0, 1).toUpperCase()}</span>
            <strong>{item.repository}</strong>
          </div>
          <span className="repo-prs">{item.totalPullRequests} PR</span>
          <span
            className={`mini-score ${item.failureRate > 20 ? "bad" : item.warningRate > 20 ? "warn" : "good"}`}
          >
            {(item.averageScore ?? 0).toFixed(1)}
          </span>
          <span className="repo-rate">{item.failureRate.toFixed(1)}% 失败</span>
        </div>
      ))}
    </div>
  );
}

function RuleList({ items }: { items: DashboardOverview["evaluatorRisks"] }) {
  if (!items.length) return <ChartEmpty />;
  return (
    <div className="rule-list">
      {items.slice(0, 6).map((item, index) => (
        <div className="rule-row" key={item.evaluatorId}>
          <span className="rule-rank">0{index + 1}</span>
          <div className="rule-copy">
            <strong>{item.name}</strong>
            <div className="rule-bar">
              <span style={{ width: `${Math.min(item.failRate, 100)}%` }} />
            </div>
          </div>
          <span className="rule-count">
            {item.failCount}
            <small> fail</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function RiskTable({ items }: { items: DashboardOverview["riskPullRequests"] }) {
  if (!items.length)
    return (
      <div className="no-risk">
        <CheckCircle2 size={22} />
        <div>
          <strong>当前没有需要关注的 PR</strong>
          <span>最近一次扫描中的 PR 均通过了启用的规则。</span>
        </div>
      </div>
    );
  return (
    <div className="risk-list">
      {items.map((item) => (
        <Link
          className="risk-row"
          to={`/pull-requests/${encodeURIComponent(item.repository)}/${item.pullNumber}`}
          key={`${item.repository}-${item.pullNumber}`}
        >
          <div className="risk-severity">
            <span className={item.failCount ? "fail-dot" : "warn-dot"} />
            {item.failCount ? "失败" : "警告"}
          </div>
          <div className="risk-main">
            <strong>
              #{item.pullNumber} {item.title}
            </strong>
            <span>
              {item.repository} · {item.author}
            </span>
          </div>
          <div className="risk-issues">
            {item.topIssues.slice(0, 1).map((issue) => (
              <span key={issue}>{issue}</span>
            ))}
          </div>
          <div className="risk-score">
            <strong>{item.aggregateScore.toFixed(0)}</strong>
            <small>/100</small>
            <ArrowUpRight size={16} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function PanelHeading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="panel-heading">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <small>{detail}</small>
    </div>
  );
}
function LoadingState() {
  return (
    <div className="state-card">
      <RefreshCw className="spin" size={22} />
      <h2>正在读取扫描数据</h2>
      <p>Dashboard 正在连接本地扫描数据库。</p>
    </div>
  );
}
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="state-card error-state">
      <XCircle size={22} />
      <h2>暂时无法读取 Dashboard 数据</h2>
      <p>请确认 Dashboard 服务和数据库路径正常。</p>
      <button className="button-primary" onClick={onRetry}>
        重试
      </button>
    </div>
  );
}
function EmptyState() {
  return (
    <div className="state-card">
      <CircleDashed size={24} />
      <h2>还没有可展示的扫描结果</h2>
      <p>
        先运行一次 <code>pr-scanner scan</code>，完成后这里会自动出现总体健康度、趋势和风险 PR。
      </p>
    </div>
  );
}
function ChartEmpty() {
  return (
    <div className="chart-empty">
      <CircleDashed size={19} />
      <span>当前窗口没有足够的历史数据</span>
    </div>
  );
}
function StatusIcon({ status }: { status: string }) {
  return status === "completed" ? (
    <CheckCircle2 className="icon-good" size={22} />
  ) : status === "failed" ? (
    <XCircle className="icon-bad" size={22} />
  ) : (
    <AlertTriangle className="icon-warn" size={22} />
  );
}
function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <small>{label}</small>
      <strong>{Number(payload[0].value).toFixed(1)} / 100</strong>
    </div>
  );
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
function formatShortDate(value: string) {
  return value.slice(5).replace("-", "/");
}
function scanStatusLabel(status: string) {
  return (
    (
      {
        completed: "扫描完成",
        partial: "部分完成",
        failed: "扫描失败",
        running: "扫描进行中",
        stale: "数据已过期",
      } as Record<string, string>
    )[status] ?? status
  );
}
function phaseLabel(phase: string) {
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

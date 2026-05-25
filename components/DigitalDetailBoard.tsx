"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { LOCKS, type CanalBoat } from "@/lib/canal";
import type { GitHubWorkflowRun, Stop } from "@/lib/town";

type Props = {
  stop: Stop | null;
  boats: CanalBoat[];
  onClear: () => void;
};

export function DigitalDetailBoard({ stop, boats, onClear }: Props) {
  const repoUrl = stop?.repo ? repoHref(stop.repo) : null;
  const linkOut = stop ? (stop.homepage ?? repoUrl) : null;
  const prs = stop
    ? boats.filter(
        (boat) =>
          boat.repo === stop.repo ||
          (boat.stopId === stop.id && boat.district === stop.district),
      )
    : [];
  const openPrs = prs.filter((pr) => pr.lock !== "open-sea");
  const openPrCount = stop?.openPrCount ?? openPrs.length;

  return (
    <section aria-label="Willville site detail display" style={shellStyle}>
      {!stop ? (
        <div style={emptyStateStyle}>
          <span style={eyebrowStyle}>Digital detail board</span>
          <strong style={emptyTitleStyle}>Select a site in Willville</strong>
          <span style={emptyCopyStyle}>
            Project metadata, links, blockers, next steps, and live signals
            appear here.
          </span>
        </div>
      ) : (
        <>
          <div style={topGridStyle}>
            <Panel title="Primary Metrics">
              <div style={metricClusterStyle}>
                <Metric label="Repo" value={repoShortName(stop.repo)} />
                <Metric label="Language" value={stop.language ?? "Mixed"} />
                <BranchSignal stop={stop} />
                <Metric label="Branches" value={countLabel(stop.branchCount)} />
                <Metric
                  label="Issues"
                  value={
                    stop.openIssues != null ? String(stop.openIssues) : "n/a"
                  }
                />
                <Metric label="Open PRs" value={String(openPrCount)} />
              </div>
            </Panel>

            <Panel title="Temporal Data">
              <div style={metricClusterStyle}>
                <Metric
                  label="Commits 3d/7d/21d"
                  value={`${stop.commits3d ?? 0} / ${stop.commits7d ?? 0} / ${
                    stop.commits21d ?? 0
                  }`}
                  wide
                />
                <Metric
                  label="Last Commit"
                  value={timeAgo(stop.lastCommitAt)}
                />
                <Metric label="Oldest PR" value={oldestPrAge(openPrs)} />
                <Metric label="Last Merge" value={timeAgo(stop.lastMergeAt)} />
                <Metric label="Release" value={releaseLabel(stop)} />
              </div>
            </Panel>

            <Panel title="Canal">
              <div style={canalPanelStyle}>
                {prs.length > 0 ? (
                  prs.slice(0, 3).map((pr) => {
                    const lock = LOCKS.find(
                      (candidate) => candidate.id === pr.lock,
                    );
                    return (
                      <a
                        key={`${pr.repo}-${pr.prNumber}`}
                        href={pr.url}
                        onClick={followLink}
                        style={softLinkStyle}
                      >
                        {pr.title}
                        <span style={mutedInlineStyle}>
                          {" "}
                          / {lock?.displayName ?? pr.lock}
                        </span>
                      </a>
                    );
                  })
                ) : (
                  <p style={noteTextStyle}>No active canal traffic.</p>
                )}
              </div>
            </Panel>
          </div>

          <div style={bottomGridStyle}>
            <Panel title="Status">
              <TextBlock
                value={stop.status.doing}
                fallback="No active work logged."
              />
            </Panel>
            <Panel title="Direction">
              <TextBlock
                value={stop.status.next}
                fallback="No direction logged."
              />
            </Panel>
            <Panel title="GitHub Actions">
              <WorkflowRunList stop={stop} />
            </Panel>
          </div>

          <div style={buttonRowStyle}>
            <div style={buttonSpacerStyle} />
            <div style={buttonGroupStyle}>
              {repoUrl && (
                <a href={repoUrl} onClick={followLink} style={buttonStyle}>
                  Repo
                </a>
              )}
              {linkOut && linkOut !== repoUrl && (
                <a href={linkOut} onClick={followLink} style={buttonStyle}>
                  Site
                </a>
              )}
              <button type="button" onClick={onClear} style={buttonStyle}>
                Clear
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={panelStyle}>
      <span style={panelTitleStyle}>{title}</span>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div style={wide ? wideMetricStyle : metricStyle}>
      <span style={smallLabelStyle}>{label}</span>
      <strong style={metricValueStyle}>{value}</strong>
    </div>
  );
}

function BranchSignal({ stop }: { stop: Stop }) {
  const branch = stop.activeBranch;
  return (
    <div style={metricStyle}>
      <span style={smallLabelStyle}>Branch</span>
      {branch ? (
        <a
          href={branch.compareUrl}
          onClick={followLink}
          style={branchLinkStyle}
          title={`Compare main to ${branch.name}`}
        >
          {branch.name}
        </a>
      ) : (
        <span style={metricValueStyle}>n/a</span>
      )}
    </div>
  );
}

function TextBlock({
  value,
  fallback,
}: {
  value: string | undefined;
  fallback: string;
}) {
  return <p style={noteTextStyle}>{normalizePanelText(value, fallback)}</p>;
}

function WorkflowRunList({ stop }: { stop: Stop }) {
  const runs = stop.workflowRuns ?? [];
  if (runs.length === 0) {
    return <p style={noteTextStyle}>No recent GitHub Actions runs.</p>;
  }
  return (
    <ul style={actionListStyle}>
      {runs.slice(0, 3).map((run, index) => (
        <li key={`${run.url}-${index}`} style={actionItemStyle}>
          <span style={workflowRunStatusStyle(run.status)}>
            {workflowRunStatusLabel(run.status)}
          </span>
          <a href={run.url} onClick={followLink} style={actionLinkStyle}>
            {run.name}
          </a>
        </li>
      ))}
    </ul>
  );
}

function followLink(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  window.location.assign(e.currentTarget.href);
}

function repoHref(repo: string): string {
  const trimmed = repo.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://github.com/${trimmed.replace(/^\/+/, "")}`;
}

function repoShortName(repo: string | undefined): string {
  return repo?.split("/").at(-1) ?? "n/a";
}

function countLabel(value: number | undefined): string {
  return Number.isFinite(value ?? NaN) ? String(value) : "n/a";
}

function releaseLabel(stop: Stop): string {
  return stop.latestRelease?.tagName ?? stop.latestRelease?.name ?? "n/a";
}

function oldestPrAge(prs: CanalBoat[]): string {
  if (prs.length === 0) return "n/a";
  const oldest = prs.reduce((min, pr) =>
    Date.parse(pr.createdAt) < Date.parse(min.createdAt) ? pr : min,
  );
  return timeAgo(oldest.createdAt);
}

function timeAgo(value: string | undefined): string {
  if (!value) return "n/a";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "n/a";
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 90) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}mo`;
}

function normalizePanelText(
  value: string | undefined,
  fallback: string,
): string {
  if (!value || value.trim().toLowerCase() === "none") return fallback;
  return value;
}

function workflowRunStatusLabel(status: GitHubWorkflowRun["status"]): string {
  if (status === "success") return "success";
  if (status === "running") return "running";
  if (status === "failed") return "failed";
  return "neutral";
}

function workflowRunStatusStyle(
  status: GitHubWorkflowRun["status"],
): CSSProperties {
  if (status === "success") {
    return {
      ...actionStatusStyle,
      color: "#9bffb4",
      borderColor: "rgba(155, 255, 180, 0.38)",
      background: "rgba(28, 96, 42, 0.45)",
    };
  }
  if (status === "running") {
    return {
      ...actionStatusStyle,
      color: "#ffe27d",
      borderColor: "rgba(255, 226, 125, 0.34)",
      background: "rgba(97, 74, 18, 0.45)",
    };
  }
  if (status === "failed") {
    return {
      ...actionStatusStyle,
      color: "#ff9c9c",
      borderColor: "rgba(255, 156, 156, 0.34)",
      background: "rgba(115, 28, 28, 0.42)",
    };
  }
  return {
    ...actionStatusStyle,
    color: "rgba(51, 255, 87, 0.72)",
    borderColor: "rgba(51, 255, 87, 0.22)",
    background: "rgba(51, 255, 87, 0.08)",
  };
}

const shellStyle: CSSProperties = {
  position: "relative",
  zIndex: 2,
  width: "min(960px, calc(100vw - 20px))",
  minHeight: 220,
  margin: "0 auto 10px",
  display: "grid",
  gap: 8,
  padding: "12px 18px 12px",
  borderRadius: 3,
  border: "1px solid rgba(51, 255, 87, 0.28)",
  background:
    "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 3px), linear-gradient(180deg, #020d02 0%, #000400 100%)",
  boxShadow:
    "0 0 32px rgba(51, 255, 87, 0.09), inset 0 0 60px rgba(51, 255, 87, 0.05)",
  color: "#33ff57",
  fontFamily: '"Courier New", Courier, monospace',
};

const emptyStateStyle: CSSProperties = {
  gridColumn: "1 / -1",
  display: "grid",
  alignContent: "center",
  justifyItems: "center",
  gap: 8,
  textAlign: "center",
  minHeight: 116,
};

const emptyTitleStyle: CSSProperties = {
  fontSize: 20,
  letterSpacing: 0.5,
  textShadow: "0 0 10px rgba(51, 255, 87, 0.5)",
};

const emptyCopyStyle: CSSProperties = {
  maxWidth: 520,
  color: "rgba(51, 255, 87, 0.6)",
  fontSize: 13,
  lineHeight: 1.4,
};

const eyebrowStyle: CSSProperties = {
  color: "rgba(51, 255, 87, 0.5)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const topGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 10,
};

const bottomGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 10,
};

const panelStyle: CSSProperties = {
  position: "relative",
  minWidth: 0,
  minHeight: 68,
  padding: "23px 10px 10px",
  borderRadius: 2,
  background:
    "linear-gradient(180deg, rgba(51,255,87,0.055), rgba(51,255,87,0.025))",
  border: "1px solid rgba(51, 255, 87, 0.42)",
  boxShadow: "inset 0 0 22px rgba(51, 255, 87, 0.035)",
};

const panelTitleStyle: CSSProperties = {
  position: "absolute",
  top: 9,
  left: 10,
  maxWidth: "calc(100% - 20px)",
  padding: "2px 8px",
  borderRadius: 2,
  background: "rgba(190, 255, 196, 0.95)",
  color: "#052505",
  fontSize: 10,
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: 1.6,
  textTransform: "uppercase",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metricClusterStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, max-content))",
  alignContent: "start",
  gap: 6,
};

const metricStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: 124,
  padding: "7px 8px",
  borderRadius: 2,
  background: "rgba(51, 255, 87, 0.04)",
  border: "1px solid rgba(51, 255, 87, 0.18)",
};

const wideMetricStyle: CSSProperties = {
  ...metricStyle,
  gridColumn: "span 2",
  maxWidth: 190,
};

const smallLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: 3,
  color: "rgba(51, 255, 87, 0.5)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: "uppercase",
};

const metricValueStyle: CSSProperties = {
  display: "block",
  color: "#33ff57",
  fontSize: 13,
  lineHeight: 1.2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textShadow: "0 0 8px rgba(51, 255, 87, 0.55)",
};

const noteTextStyle: CSSProperties = {
  margin: 0,
  color: "rgba(51, 255, 87, 0.82)",
  fontSize: 12,
  lineHeight: 1.45,
};

const branchLinkStyle: CSSProperties = {
  ...metricValueStyle,
  display: "block",
  color: "#33ff57",
  textDecoration: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const actionListStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: 5,
};

const actionItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "70px minmax(0, 1fr)",
  alignItems: "center",
  gap: 5,
  paddingBottom: 5,
  borderBottom: "1px solid rgba(51, 255, 87, 0.13)",
  color: "rgba(51, 255, 87, 0.82)",
  fontSize: 12,
  lineHeight: 1.35,
};

const actionStatusStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2px 6px",
  border: "1px solid rgba(51, 255, 87, 0.22)",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.8,
  lineHeight: 1.1,
  textTransform: "uppercase",
};

const actionLinkStyle: CSSProperties = {
  minWidth: 0,
  color: "rgba(51, 255, 87, 0.82)",
  fontSize: 12,
  lineHeight: 1.35,
  textDecoration: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const canalPanelStyle: CSSProperties = {
  display: "grid",
  gap: 3,
  minWidth: 0,
};

const mutedInlineStyle: CSSProperties = {
  color: "rgba(51, 255, 87, 0.45)",
};

const softLinkStyle: CSSProperties = {
  minWidth: 0,
  color: "rgba(51, 255, 87, 0.8)",
  fontSize: 12,
  lineHeight: 1.35,
  textDecoration: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const buttonSpacerStyle: CSSProperties = {
  flex: "1 1 260px",
  minWidth: 0,
};

const buttonGroupStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const buttonStyle: CSSProperties = {
  border: "1px solid rgba(51, 255, 87, 0.35)",
  borderRadius: 2,
  background: "rgba(51, 255, 87, 0.08)",
  color: "#33ff57",
  padding: "7px 11px",
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
  cursor: "pointer",
  fontFamily: '"Courier New", Courier, monospace',
  letterSpacing: 0.5,
  textShadow: "0 0 6px rgba(51, 255, 87, 0.35)",
};

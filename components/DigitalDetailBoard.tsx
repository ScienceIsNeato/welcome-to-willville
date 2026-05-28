"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  countLabel,
  detailBoardDirection,
  detailBoardStatus,
  followLink,
  normalizeDetailText as normalizePanelText,
  repoShortName,
  shortWorkflowName,
  timeAgo,
  tooltipText,
  workflowRunStatusLabel,
} from "./detailBoardUtils";
import type { CanalBoat } from "@/lib/canal";
import type { GitHubWorkflowRun, Stop } from "@/lib/town";

type Props = {
  stop: Stop | null;
  boats: CanalBoat[];
  panelOpacity?: number;
};

export function DigitalDetailBoard({ stop, boats, panelOpacity = 1 }: Props) {
  const stopPrs = stop
    ? boats.filter(
        (boat) =>
          boat.repo === stop.repo ||
          (boat.stopId === stop.id && boat.district === stop.district),
      )
    : [];
  const openPrs = stopPrs.filter((pr) => pr.lock !== "open-sea");
  const openPrCount = stop?.openPrCount ?? openPrs.length;

  return (
    <section
      aria-label="Willville site detail display"
      className="digital-detail-board"
      style={
        {
          ...shellStyle,
          "--panel-opacity": String(panelOpacity),
        } as CSSProperties
      }
    >
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
          <section style={overviewColumnStyle}>
            <span style={sectionLabelStyle}>Project</span>
            <h2 style={projectTitleStyle}>
              <a
                href={stop.repo ? `https://github.com/${stop.repo}` : "#"}
                onClick={stop.repo ? followLink : undefined}
                style={projectTitleLinkStyle}
                title={tooltipText(stop.repo)}
              >
                {repoShortName(stop.repo)}
              </a>
            </h2>
            <BranchSignal stop={stop} />
            <FactGrid
              facts={[
                ["Language", stop.language ?? "Mixed"],
                ["Branches", countLabel(stop.branchCount)],
                ["Issues", countLabel(stop.openIssues)],
                ["Open PRs", String(openPrCount)],
                [
                  "Commits 3/7/21d",
                  `${stop.commits3d ?? 0}/${stop.commits7d ?? 0}/${
                    stop.commits21d ?? 0
                  }`,
                ],
                ["Last Commit", timeAgo(stop.lastCommitAt)],
                ["Last Merged", timeAgo(stop.lastMergeAt)],
              ]}
            />
          </section>

          <section style={workColumnStyle}>
            <TextSection
              label="Status"
              value={detailBoardStatus(stop)}
              fallback="No active work logged."
            />
            <TextSection
              label="Direction"
              value={detailBoardDirection(stop)}
              fallback="No direction logged."
            />
          </section>

          <section style={activityColumnStyle}>
            <ActivitySection label="Recent Commits">
              <RecentCommitList stop={stop} />
            </ActivitySection>
            <ActivitySection label="GitHub Actions">
              <WorkflowRunList stop={stop} />
            </ActivitySection>
          </section>
        </>
      )}
    </section>
  );
}

function FactGrid({ facts }: { facts: Array<[string, string]> }) {
  return (
    <dl style={factGridStyle}>
      {facts.map(([label, value]) => (
        <div key={label} style={factItemStyle}>
          <dt style={factLabelStyle}>{label}</dt>
          <dd style={factValueStyle} title={tooltipText(value)}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TextSection({
  label,
  value,
  fallback,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
}) {
  const text = normalizePanelText(value, fallback);
  return (
    <div style={textSectionStyle}>
      <span style={sectionLabelStyle}>{label}</span>
      <p style={noteTextStyle} title={tooltipText(text)}>
        {text}
      </p>
    </div>
  );
}

function ActivitySection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={activitySectionStyle}>
      <span style={sectionLabelStyle}>{label}</span>
      {children}
    </div>
  );
}

function BranchSignal({ stop }: { stop: Stop }) {
  const branch = stop.activeBranch;
  return (
    <div style={branchRowStyle}>
      <span style={sectionLabelStyle}>Branch</span>
      {branch ? (
        <a
          href={branch.compareUrl}
          onClick={followLink}
          style={branchLinkStyle}
          title={tooltipText(`Compare main to ${branch.name}`)}
        >
          {branch.name}
        </a>
      ) : (
        <span style={branchValueStyle} title="n/a">
          n/a
        </span>
      )}
    </div>
  );
}

function WorkflowRunList({ stop }: { stop: Stop }) {
  const runs = stop.workflowRuns ?? [];
  if (runs.length === 0) {
    return (
      <p style={noteTextStyle} title="No recent GitHub Actions runs.">
        No recent GitHub Actions runs.
      </p>
    );
  }
  return (
    <ul style={actionListStyle}>
      {runs.slice(0, 3).map((run, index) => (
        <li key={`${run.url}-${index}`} style={actionItemStyle}>
          <span style={workflowRunStatusStyle(run.status)}>
            {workflowRunStatusLabel(run.status)}
          </span>
          <a
            href={run.url}
            onClick={followLink}
            style={actionLinkStyle}
            title={tooltipText(run.name)}
          >
            {shortWorkflowName(run.name)}
          </a>
        </li>
      ))}
    </ul>
  );
}

function RecentCommitList({ stop }: { stop: Stop }) {
  const commits = stop.recentCommits ?? [];
  if (commits.length === 0) {
    return (
      <p style={noteTextStyle} title="No recent commits.">
        No recent commits.
      </p>
    );
  }
  return (
    <ul style={actionListStyle}>
      {commits.slice(0, 3).map((commit, index) => (
        <li key={`${commit.url}-${index}`} style={actionItemStyle}>
          <span style={recentCommitAgeStyle}>
            {timeAgo(commit.committedAt)}
          </span>
          <a
            href={commit.url}
            onClick={followLink}
            style={actionLinkStyle}
            title={tooltipText(commit.message)}
          >
            {commit.message}
          </a>
        </li>
      ))}
    </ul>
  );
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
  pointerEvents: "auto",
  width: "calc(100vw - 20px)",
  height: "clamp(260px, 31vh, 340px)",
  margin: "0 auto 10px",
  display: "grid",
  gridTemplateColumns:
    "minmax(250px, 1fr) minmax(270px, 1.05fr) minmax(250px, 0.95fr)",
  gap: 12,
  padding: "14px 16px 12px",
  boxSizing: "border-box",
  overflow: "hidden",
  borderRadius: 3,
  border: "1px solid rgb(51 255 87 / calc(0.28 * var(--panel-opacity, 1)))",
  background:
    "repeating-linear-gradient(0deg, transparent, transparent 2px, rgb(0 0 0 / calc(0.06 * var(--panel-opacity, 1))) 2px, rgb(0 0 0 / calc(0.06 * var(--panel-opacity, 1))) 3px), linear-gradient(180deg, rgb(2 13 2 / var(--panel-opacity, 1)) 0%, rgb(0 4 0 / var(--panel-opacity, 1)) 100%)",
  boxShadow:
    "0 0 32px rgb(51 255 87 / calc(0.09 * var(--panel-opacity, 1))), inset 0 0 60px rgb(51 255 87 / calc(0.05 * var(--panel-opacity, 1)))",
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
  fontSize: 23,
  letterSpacing: 0.5,
  textShadow: "0 0 10px rgba(51, 255, 87, 0.5)",
};

const emptyCopyStyle: CSSProperties = {
  maxWidth: 520,
  color: "rgba(51, 255, 87, 0.6)",
  fontSize: 15,
  lineHeight: 1.2,
};

const eyebrowStyle: CSSProperties = {
  color: "rgba(51, 255, 87, 0.5)",
  fontSize: 12.8,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const overviewColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto minmax(0, 1fr)",
  alignContent: "start",
  gap: 7,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
};

const workColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 10,
  minHeight: 0,
  overflow: "hidden",
};

const activityColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "minmax(0, 1.15fr) minmax(0, 1fr)",
  gap: 10,
  minHeight: 0,
  paddingRight: 58,
  overflow: "hidden",
};

const sectionLabelStyle: CSSProperties = {
  display: "block",
  color: "rgba(190, 255, 196, 0.76)",
  fontSize: 11,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 1.1,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const projectTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  lineHeight: 1.05,
  fontWeight: 900,
};

const projectTitleLinkStyle: CSSProperties = {
  color: "#baffc2",
  textDecoration: "none",
  display: "block",
  overflowWrap: "anywhere",
  whiteSpace: "normal",
  textShadow: "0 0 10px rgba(51, 255, 87, 0.45)",
};

const branchRowStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const factGridStyle: CSSProperties = {
  margin: 0,
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 4,
  minWidth: 0,
  overflow: "hidden",
};

const factItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "128px minmax(0, 1fr)",
  alignItems: "baseline",
  gap: 8,
  minWidth: 0,
  paddingTop: 4,
  borderTop: "1px solid rgb(51 255 87 / calc(0.16 * var(--panel-opacity, 1)))",
};

const factLabelStyle: CSSProperties = {
  display: "block",
  color: "rgba(51, 255, 87, 0.5)",
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 700,
  letterSpacing: 0.7,
  textTransform: "uppercase",
};

const factValueStyle: CSSProperties = {
  margin: 0,
  display: "block",
  color: "#33ff57",
  fontSize: 14,
  lineHeight: 1.08,
  fontWeight: 800,
  overflowWrap: "anywhere",
  whiteSpace: "normal",
  textShadow: "0 0 8px rgba(51, 255, 87, 0.55)",
};

const textSectionStyle: CSSProperties = {
  minHeight: 0,
  paddingTop: 2,
  overflowY: "auto",
  overflowX: "hidden",
};

const noteTextStyle: CSSProperties = {
  margin: "7px 0 0",
  color: "rgba(51, 255, 87, 0.82)",
  fontSize: 13,
  lineHeight: 1.28,
  overflow: "visible",
  overflowWrap: "anywhere",
};

const branchLinkStyle: CSSProperties = {
  ...factValueStyle,
  display: "block",
  color: "#33ff57",
  fontSize: 14,
  textDecoration: "none",
};

const branchValueStyle: CSSProperties = {
  ...factValueStyle,
  fontSize: 14,
};

const activitySectionStyle: CSSProperties = {
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
};

const actionListStyle: CSSProperties = {
  margin: "7px 0 0",
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: 4,
  minHeight: 0,
  overflow: "visible",
};

const actionItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "70px minmax(0, 1fr)",
  alignItems: "start",
  gap: 8,
  minWidth: 0,
  paddingBottom: 4,
  borderBottom:
    "1px solid rgb(51 255 87 / calc(0.13 * var(--panel-opacity, 1)))",
  color: "rgba(51, 255, 87, 0.82)",
  fontSize: 14,
  lineHeight: 1.18,
};

const actionStatusStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 62,
  padding: "2px 6px",
  border: "1px solid rgb(51 255 87 / calc(0.22 * var(--panel-opacity, 1)))",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0,
  lineHeight: 1.1,
  textTransform: "uppercase",
};

const recentCommitAgeStyle: CSSProperties = {
  ...actionStatusStyle,
  color: "rgba(51, 255, 87, 0.78)",
  borderColor: "rgb(51 255 87 / calc(0.2 * var(--panel-opacity, 1)))",
  background: "rgb(51 255 87 / calc(0.08 * var(--panel-opacity, 1)))",
};

const actionLinkStyle: CSSProperties = {
  minWidth: 0,
  color: "rgba(51, 255, 87, 0.82)",
  fontSize: 14,
  lineHeight: 1.18,
  textDecoration: "none",
  display: "block",
  overflowWrap: "anywhere",
  whiteSpace: "normal",
};

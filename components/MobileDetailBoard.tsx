"use client";

import type { CSSProperties } from "react";
import {
  countLabel,
  detailBoardDirection,
  detailBoardStatus,
  followLink,
  normalizeDetailText as normalizeText,
  repoShortName,
  shortWorkflowName,
  timeAgo,
  tooltipText,
  workflowRunStatusLabel,
} from "./detailBoardUtils";
import type { CanalBoat } from "@/lib/canal";
import type { GitHubWorkflowRun, Stop } from "@/lib/town";

type Props = {
  stop: Stop;
  boats: CanalBoat[];
  panelOpacity?: number;
};

export function MobileDetailBoard({ stop, boats, panelOpacity = 1 }: Props) {
  const stopPrs = boats.filter(
    (boat) =>
      boat.repo === stop.repo ||
      (boat.stopId === stop.id && boat.district === stop.district),
  );
  const openPrs = stopPrs.filter((boat) => boat.lock !== "open-sea");
  const openPrCount = stop.openPrCount ?? openPrs.length;
  const recentCommits = stop.recentCommits ?? [];
  const workflowRuns = stop.workflowRuns ?? [];
  const facts: Array<[string, string]> = [
    ["Language", stop.language ?? "Mixed"],
    ["Branches", countLabel(stop.branchCount)],
    ["Issues", countLabel(stop.openIssues)],
    ["Open PRs", String(openPrCount)],
    [
      "Commits 3/7/21d",
      `${stop.commits3d ?? 0}/${stop.commits7d ?? 0}/${stop.commits21d ?? 0}`,
    ],
    ["Last Commit", timeAgo(stop.lastCommitAt)],
    ["Last Merged", timeAgo(stop.lastMergeAt)],
  ];

  return (
    <section
      aria-label="Willville mobile site detail display"
      style={
        {
          ...shellStyle,
          "--panel-opacity": String(panelOpacity),
        } as CSSProperties
      }
    >
      <section style={heroCardStyle}>
        <span style={eyebrowStyle}>Project</span>
        <h2 style={titleStyle}>
          <a
            href={stop.repo ? `https://github.com/${stop.repo}` : "#"}
            onClick={stop.repo ? followLink : undefined}
            style={titleLinkStyle}
            title={tooltipText(stop.repo)}
          >
            {repoShortName(stop.repo)}
          </a>
        </h2>
        <div style={branchStyle}>
          <span style={sectionLabelStyle}>Branch</span>
          {stop.activeBranch ? (
            <a
              href={stop.activeBranch.compareUrl}
              onClick={followLink}
              style={branchLinkStyle}
              title={tooltipText(`Compare main to ${stop.activeBranch.name}`)}
            >
              {stop.activeBranch.name}
            </a>
          ) : (
            <span style={branchValueStyle}>n/a</span>
          )}
        </div>
      </section>

      <section style={cardStyle}>
        <span style={sectionLabelStyle}>Snapshot</span>
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
      </section>

      <section style={cardStyle}>
        <div style={textSectionStyle}>
          <span style={sectionLabelStyle}>Status</span>
          <p
            style={textValueStyle}
            title={tooltipText(
              normalizeText(detailBoardStatus(stop), "No active work logged."),
            )}
          >
            {normalizeText(detailBoardStatus(stop), "No active work logged.")}
          </p>
        </div>

        <div style={textSectionStyle}>
          <span style={sectionLabelStyle}>Direction</span>
          <p
            style={textValueStyle}
            title={tooltipText(
              normalizeText(detailBoardDirection(stop), "No direction logged."),
            )}
          >
            {normalizeText(detailBoardDirection(stop), "No direction logged.")}
          </p>
        </div>
      </section>

      <section style={cardStyle}>
        <span style={sectionLabelStyle}>Recent Commits</span>
        <ul style={activityListStyle}>
          {recentCommits.map((commit, index) => (
            <li key={`${commit.url}-${index}`} style={activityItemStyle}>
              <span style={badgeStyle}>{timeAgo(commit.committedAt)}</span>
              <a
                href={commit.url}
                onClick={followLink}
                style={activityLinkStyle}
                title={tooltipText(commit.message)}
              >
                {commit.message}
              </a>
            </li>
          ))}
          {recentCommits.length === 0 && (
            <li style={emptyItemStyle}>No recent commits.</li>
          )}
        </ul>
      </section>

      <section style={cardStyle}>
        <span style={sectionLabelStyle}>GitHub Actions</span>
        <ul style={activityListStyle}>
          {workflowRuns.map((run, index) => (
            <li key={`${run.url}-${index}`} style={activityItemStyle}>
              <span style={workflowRunStatusStyle(run.status)}>
                {workflowRunStatusLabel(run.status)}
              </span>
              <a
                href={run.url}
                onClick={followLink}
                style={activityLinkStyle}
                title={tooltipText(run.name)}
              >
                {shortWorkflowName(run.name)}
              </a>
            </li>
          ))}
          {workflowRuns.length === 0 && (
            <li style={emptyItemStyle}>No recent GitHub Actions runs.</li>
          )}
        </ul>
      </section>
    </section>
  );
}

function workflowRunStatusStyle(
  status: GitHubWorkflowRun["status"],
): CSSProperties {
  if (status === "success") {
    return {
      ...badgeStyle,
      color: "#9bffb4",
      borderColor: "rgba(155, 255, 180, 0.38)",
      background: "rgba(28, 96, 42, 0.45)",
    };
  }
  if (status === "running") {
    return {
      ...badgeStyle,
      color: "#ffe27d",
      borderColor: "rgba(255, 226, 125, 0.34)",
      background: "rgba(97, 74, 18, 0.45)",
    };
  }
  if (status === "failed") {
    return {
      ...badgeStyle,
      color: "#ff9c9c",
      borderColor: "rgba(255, 156, 156, 0.34)",
      background: "rgba(115, 28, 28, 0.42)",
    };
  }
  return {
    ...badgeStyle,
    color: "rgba(51, 255, 87, 0.72)",
    borderColor: "rgba(51, 255, 87, 0.22)",
    background: "rgba(51, 255, 87, 0.08)",
  };
}

const shellStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  width: "100%",
  minWidth: 0,
  paddingBottom: 6,
  color: "#33ff57",
  fontFamily: '"Courier New", Courier, monospace',
};

const heroCardStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
  alignContent: "start",
  padding: "12px 12px 14px",
  borderRadius: 14,
  border: "1px solid rgb(51 255 87 / calc(0.2 * var(--panel-opacity, 1)))",
  background:
    "linear-gradient(180deg, rgb(4 22 6 / calc(0.92 * var(--panel-opacity, 1))) 0%, rgb(1 8 2 / calc(0.96 * var(--panel-opacity, 1))) 100%)",
  boxShadow:
    "inset 0 0 28px rgb(51 255 87 / calc(0.05 * var(--panel-opacity, 1)))",
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  minWidth: 0,
  alignContent: "start",
  padding: "12px 12px 14px",
  borderRadius: 14,
  border: "1px solid rgb(51 255 87 / calc(0.18 * var(--panel-opacity, 1)))",
  background:
    "linear-gradient(180deg, rgb(3 18 4 / calc(0.84 * var(--panel-opacity, 1))) 0%, rgb(0 8 1 / calc(0.9 * var(--panel-opacity, 1))) 100%)",
};

const eyebrowStyle: CSSProperties = {
  color: "rgba(51, 255, 87, 0.5)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1.2,
  textTransform: "uppercase",
};

const sectionLabelStyle: CSSProperties = {
  color: "rgba(190, 255, 196, 0.76)",
  fontSize: 11,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 1.1,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 21,
  lineHeight: 1.02,
  fontWeight: 900,
};

const titleLinkStyle: CSSProperties = {
  color: "#baffc2",
  textDecoration: "none",
  display: "block",
  overflowWrap: "anywhere",
  whiteSpace: "normal",
  textShadow: "0 0 10px rgba(51, 255, 87, 0.45)",
};

const branchStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const branchLinkStyle: CSSProperties = {
  color: "#33ff57",
  fontSize: 15,
  lineHeight: 1.12,
  textDecoration: "none",
  overflowWrap: "anywhere",
};

const branchValueStyle: CSSProperties = {
  color: "#33ff57",
  fontSize: 15,
  lineHeight: 1.12,
};

const factGridStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  margin: 0,
  minWidth: 0,
};

const factItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  alignItems: "start",
  gap: 4,
  minWidth: 0,
  paddingBottom: 8,
  borderBottom:
    "1px solid rgb(51 255 87 / calc(0.13 * var(--panel-opacity, 1)))",
};

const factLabelStyle: CSSProperties = {
  color: "rgba(51, 255, 87, 0.5)",
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 700,
  letterSpacing: 0.7,
  textTransform: "uppercase",
};

const factValueStyle: CSSProperties = {
  margin: 0,
  color: "#33ff57",
  fontSize: 15,
  lineHeight: 1.12,
  fontWeight: 800,
  overflowWrap: "anywhere",
  whiteSpace: "normal",
  textShadow: "0 0 8px rgba(51, 255, 87, 0.55)",
};

const textSectionStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minHeight: 0,
};

const textValueStyle: CSSProperties = {
  margin: 0,
  color: "rgba(51, 255, 87, 0.86)",
  fontSize: 14,
  lineHeight: 1.32,
  overflowWrap: "anywhere",
};

const activityListStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: 8,
  minHeight: 0,
};

const activityItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  alignItems: "start",
  gap: 6,
  minWidth: 0,
  paddingBottom: 8,
  borderBottom:
    "1px solid rgb(51 255 87 / calc(0.13 * var(--panel-opacity, 1)))",
  color: "rgba(51, 255, 87, 0.82)",
  fontSize: 14,
  lineHeight: 1.24,
};

const activityLinkStyle: CSSProperties = {
  minWidth: 0,
  color: "rgba(51, 255, 87, 0.82)",
  fontSize: 14,
  lineHeight: 1.24,
  textDecoration: "none",
  display: "block",
  overflowWrap: "anywhere",
  whiteSpace: "normal",
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 62,
  width: "fit-content",
  padding: "2px 6px",
  border: "1px solid rgb(51 255 87 / calc(0.22 * var(--panel-opacity, 1)))",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0,
  lineHeight: 1.1,
  textTransform: "uppercase",
  color: "rgba(51, 255, 87, 0.78)",
  background: "rgb(51 255 87 / calc(0.08 * var(--panel-opacity, 1)))",
};

const emptyItemStyle: CSSProperties = {
  color: "rgba(51, 255, 87, 0.64)",
  fontSize: 14,
  lineHeight: 1.24,
};

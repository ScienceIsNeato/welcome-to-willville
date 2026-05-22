"use client";

import type { CSSProperties, MouseEvent } from "react";
import { LOCKS, type CanalBoat } from "@/lib/canal";
import { expressRank, type Stop } from "@/lib/town";

const STATE_LABEL: Record<Stop["status"]["state"], string> = {
  idea: "Idea",
  wip: "Work in progress",
  shipping: "Shipping",
  maintenance: "Maintenance",
  dormant: "Dormant",
  unknown: "No manifest",
};

type Props = {
  stop: Stop | null;
  allStops: Stop[];
  boats: CanalBoat[];
  onClear: () => void;
};

export function DigitalDetailBoard({ stop, allStops, boats, onClear }: Props) {
  const rank = stop ? expressRank(stop, allStops) : null;
  const repoUrl = stop?.repo ? repoHref(stop.repo) : null;
  const linkOut = stop ? (stop.homepage ?? repoUrl) : null;
  const prs = stop
    ? boats.filter(
        (boat) =>
          boat.repo === stop.repo ||
          (boat.stopId === stop.id && boat.district === stop.district),
      )
    : [];

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
          <div style={metricsGridStyle}>
            <Metric label="Status" value={STATE_LABEL[stop.status.state]} />
            <Metric label="Express" value={rank ? `#${rank}` : "Not queued"} />
            <Metric label="ETA" value={etaLabel(stop.queue?.etaDays)} />
            <Metric label="Milestone" value={stop.queue?.milestone ?? "TBD"} />
          </div>

          <div style={notesColumnStyle}>
            <NoteList
              title="Status"
              items={stop.status.doing ? [stop.status.doing] : []}
              fallback="No active work logged."
            />
            <NoteList
              title="Direction"
              items={stop.status.next ? [stop.status.next] : []}
              fallback="No direction logged."
            />
            <NoteList
              title="Difficulties"
              items={stop.agent?.difficulties ? [stop.agent.difficulties] : []}
              fallback="None"
            />
            <NoteList
              title="Needs human"
              items={stop.agent?.needsHuman ? [stop.agent.needsHuman] : []}
              fallback="None"
            />
          </div>

          <div style={actionsColumnStyle}>
            <div style={signalGridStyle}>
              <Signal label="Language" value={stop.language ?? "Mixed"} />
              <BranchSignal stop={stop} />
              <Signal
                label="7d commits"
                value={stop.commits7d != null ? String(stop.commits7d) : "n/a"}
              />
              <Signal
                label="Open"
                value={
                  stop.openIssues != null ? String(stop.openIssues) : "n/a"
                }
              />
              <Signal
                label="Stars"
                value={stop.stars != null ? stop.stars.toLocaleString() : "n/a"}
              />
            </div>
            {prs.length > 0 && (
              <div style={prStyle}>
                <span style={smallLabelStyle}>Canal</span>
                {prs.slice(0, 2).map((pr) => {
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
                })}
              </div>
            )}
            <NoteList
              title="Activity Log"
              items={
                stop.agent?.actions?.map(
                  (action) => `${action.status}: ${action.name}`,
                ) ?? []
              }
              fallback="No recent agent actions."
            />
            <div style={buttonRowStyle}>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricStyle}>
      <span style={smallLabelStyle}>{label}</span>
      <strong style={metricValueStyle}>{value}</strong>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div style={signalStyle}>
      <span style={smallLabelStyle}>{label}</span>
      <span style={signalValueStyle}>{value}</span>
    </div>
  );
}

function BranchSignal({ stop }: { stop: Stop }) {
  const branch = stop.activeBranch;
  return (
    <div style={signalStyle}>
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
        <span style={signalValueStyle}>n/a</span>
      )}
    </div>
  );
}

function followLink(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  window.location.assign(e.currentTarget.href);
}

function NoteList({
  title,
  items,
  fallback,
}: {
  title: string;
  items: string[];
  fallback: string;
}) {
  return (
    <div style={noteStyle}>
      <span style={smallLabelStyle}>{title}</span>
      <p style={noteTextStyle}>{items.slice(0, 2).join(" / ") || fallback}</p>
    </div>
  );
}

function repoHref(repo: string): string {
  const trimmed = repo.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://github.com/${trimmed.replace(/^\/+/, "")}`;
}

function etaLabel(days: number | undefined): string {
  if (!Number.isFinite(days ?? NaN)) return "TBD";
  const safeDays = days!;
  if (safeDays <= 0) return "Today";
  if (safeDays === 1) return "1 day";
  if (safeDays < 14) return `${safeDays} days`;
  if (safeDays < 60) return `${Math.round(safeDays / 7)} weeks`;
  return `${Math.round(safeDays / 30)} months`;
}

const shellStyle: CSSProperties = {
  position: "relative",
  zIndex: 2,
  width: "min(880px, calc(100vw - 20px))",
  minHeight: 188,
  margin: "0 auto 10px",
  display: "grid",
  gridTemplateColumns:
    "minmax(230px, 0.85fr) minmax(260px, 1fr) minmax(220px, 0.8fr)",
  gap: 14,
  padding: "15px 16px",
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

const metricsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
};

const metricStyle: CSSProperties = {
  minWidth: 0,
  padding: "9px 10px",
  borderRadius: 2,
  background: "rgba(51, 255, 87, 0.04)",
  border: "1px solid rgba(51, 255, 87, 0.18)",
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
  fontSize: 14,
  lineHeight: 1.2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textShadow: "0 0 8px rgba(51, 255, 87, 0.55)",
};

const notesColumnStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 8,
};

const noteStyle: CSSProperties = {
  minWidth: 0,
  padding: "9px 10px",
  borderRadius: 2,
  background: "rgba(51, 255, 87, 0.03)",
  border: "1px solid rgba(51, 255, 87, 0.14)",
};

const noteTextStyle: CSSProperties = {
  margin: 0,
  color: "rgba(51, 255, 87, 0.82)",
  fontSize: 12,
  lineHeight: 1.35,
};

const actionsColumnStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 8,
};

const signalGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 6,
};

const signalStyle: CSSProperties = {
  minWidth: 0,
  padding: "7px 8px",
  borderRadius: 2,
  background: "rgba(51, 255, 87, 0.03)",
  border: "1px solid rgba(51, 255, 87, 0.12)",
};

const signalValueStyle: CSSProperties = {
  color: "#33ff57",
  fontSize: 13,
  fontWeight: 700,
  textShadow: "0 0 6px rgba(51, 255, 87, 0.5)",
};

const branchLinkStyle: CSSProperties = {
  ...signalValueStyle,
  display: "block",
  color: "#33ff57",
  textDecoration: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const prStyle: CSSProperties = {
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
  gap: 8,
  flexWrap: "wrap",
  alignSelf: "end",
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

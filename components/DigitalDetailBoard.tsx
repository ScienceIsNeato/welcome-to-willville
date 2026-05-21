"use client";

import type { CSSProperties, MouseEvent } from "react";
import { LOCKS, type CanalBoat } from "@/lib/canal";
import { mostActiveStops, type Stop } from "@/lib/town";

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
              title="Doing"
              items={stop.status.doing ? [stop.status.doing] : []}
              fallback="No active work logged."
            />
            <NoteList
              title="Next"
              items={stop.status.next ? [stop.status.next] : []}
              fallback="No next steps logged."
            />
            <NoteList
              title="Blocked"
              items={stop.status.blocked ? [stop.status.blocked] : []}
              fallback=""
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

function expressRank(stop: Stop, allStops: Stop[]): number | null {
  const queue = mostActiveStops(allStops, Infinity);
  const idx = queue.findIndex(
    (candidate) =>
      candidate.id === stop.id && candidate.district === stop.district,
  );
  return idx >= 0 ? idx + 1 : null;
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
  minHeight: 150,
  margin: "0 auto 10px",
  display: "grid",
  gridTemplateColumns:
    "minmax(230px, 0.85fr) minmax(260px, 1fr) minmax(220px, 0.8fr)",
  gap: 14,
  padding: "15px 16px",
  borderRadius: 12,
  border: "1px solid rgba(157, 216, 255, 0.28)",
  background:
    "linear-gradient(180deg, rgba(20,45,62,0.86) 0%, rgba(11,24,35,0.9) 100%)",
  boxShadow:
    "0 -12px 42px rgba(61,183,255,0.14), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 0 38px rgba(82,188,255,0.08)",
  color: "#eaf7ff",
  fontFamily: "var(--font-sans), Arial, Helvetica, sans-serif",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
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
  letterSpacing: 0,
};

const emptyCopyStyle: CSSProperties = {
  maxWidth: 520,
  color: "rgba(234,247,255,0.7)",
  fontSize: 13,
  lineHeight: 1.4,
};

const eyebrowStyle: CSSProperties = {
  color: "rgba(178,225,255,0.78)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.1,
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
  borderRadius: 9,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(190,230,255,0.14)",
};

const smallLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: 3,
  color: "rgba(178,225,255,0.68)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 1,
  textTransform: "uppercase",
};

const metricValueStyle: CSSProperties = {
  display: "block",
  color: "#f8fcff",
  fontSize: 14,
  lineHeight: 1.2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const notesColumnStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 8,
};

const noteStyle: CSSProperties = {
  minWidth: 0,
  padding: "9px 10px",
  borderRadius: 9,
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(190,230,255,0.12)",
};

const noteTextStyle: CSSProperties = {
  margin: 0,
  color: "rgba(234,247,255,0.82)",
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
  borderRadius: 8,
  background: "rgba(10,24,36,0.48)",
};

const signalValueStyle: CSSProperties = {
  color: "#f8fcff",
  fontSize: 13,
  fontWeight: 700,
};

const branchLinkStyle: CSSProperties = {
  ...signalValueStyle,
  display: "block",
  color: "#bfe9ff",
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
  color: "rgba(234,247,255,0.52)",
};

const softLinkStyle: CSSProperties = {
  minWidth: 0,
  color: "#dff5ff",
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
  border: "1px solid rgba(190,230,255,0.22)",
  borderRadius: 999,
  background: "rgba(255,255,255,0.1)",
  color: "#f8fcff",
  padding: "7px 11px",
  fontSize: 12,
  fontWeight: 750,
  textDecoration: "none",
  cursor: "pointer",
};

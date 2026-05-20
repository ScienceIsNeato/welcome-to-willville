"use client";

import { useEffect, useSyncExternalStore, type CSSProperties } from "react";
import { DISTRICTS, LINES } from "@/lib/willville";
import { LOCKS, type CanalBoat } from "@/lib/canal";
import { activeQueue, type Stop } from "@/lib/town";

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

const STATE_LABEL: Record<Stop["status"]["state"], string> = {
  idea: "Idea",
  wip: "Work in Progress",
  shipping: "Shipping",
  maintenance: "Maintenance",
  dormant: "Dormant",
  unknown: "No manifest yet",
};

const STATE_COLOR: Record<Stop["status"]["state"], string> = {
  idea: "#9bb5ff",
  wip: "#ffd166",
  shipping: "#7bd389",
  maintenance: "#b6b6b6",
  dormant: "#5a5a5a",
  unknown: "#cccccc",
};

type Props = {
  stop: Stop;
  boats: CanalBoat[];
  allStops: Stop[];
  onClose: () => void;
};

const panelStyle: CSSProperties = {
  width: "min(480px, calc(100vw - 32px))",
  maxHeight: "min(85vh, 720px)",
  display: "flex",
  flexDirection: "column",
  background:
    "linear-gradient(180deg, rgba(36,28,48,0.88) 0%, rgba(20,14,32,0.92) 100%)",
  color: "var(--willville-paper)",
  borderRadius: 12,
  border: "1px solid rgba(245,230,200,0.2)",
  boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  fontFamily: "var(--font-sans), serif",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  padding: "18px 20px 12px",
  borderBottom: "1px solid rgba(245,230,200,0.12)",
};

const bodyStyle: CSSProperties = {
  padding: "14px 20px",
  overflowY: "auto",
  flex: 1,
  minHeight: 0,
};

const footerStyle: CSSProperties = {
  padding: "12px 20px 16px",
  borderTop: "1px solid rgba(245,230,200,0.12)",
  display: "flex",
  justifyContent: "flex-end",
};

const closeBtnStyle: CSSProperties = {
  background: "rgba(245,230,200,0.12)",
  border: "1px solid rgba(245,230,200,0.25)",
  color: "var(--willville-paper)",
  borderRadius: 6,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

export function ProjectHud({ stop, boats, allStops, onClose }: Props) {
  const isClient = useIsClient();
  const district = DISTRICTS.find((d) => d.id === stop.district);
  const lineNames = stop.lines
    .map((id) => LINES.find((l) => l.id === id)?.displayName ?? id)
    .join(" · ");
  const repoUrl = stop.repo ? repoHref(stop.repo) : null;
  const linkOut = stop.homepage ?? repoUrl;
  const openPrs = boats.filter(
    (b) =>
      b.repo === stop.repo ||
      (b.stopId === stop.id && b.district === stop.district),
  );
  const expressPriority =
    isClient && stop.queue?.active ? expressRank(stop, allStops) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const updatedLabel =
    isClient && stop.status.updated
      ? stop.status.updated.slice(0, 10)
      : stop.status.updated
        ? "…"
        : null;

  return (
    <HudBackdrop onClose={onClose}>
      <HudPanel>
        <header style={headerStyle}>
          <TitleRow stop={stop} linkOut={linkOut} repoUrl={repoUrl} />
          <MetaLine district={district} lineNames={lineNames} stop={stop} />
          <VisibilityBadge stop={stop} />
        </header>

        <div style={bodyStyle}>
          <StatusRow stop={stop} updatedLabel={updatedLabel} />
          {stop.status.summary && (
            <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.45 }}>
              {stop.status.summary}
            </p>
          )}
          <QueueSection stop={stop} expressPriority={expressPriority} />
          {stop.status.blockers.length > 0 && (
            <ItemSection
              title="Blockers"
              color="#f4a0a0"
              items={stop.status.blockers.slice(0, 3)}
            />
          )}
          {stop.status.next.length > 0 && (
            <ItemSection
              title="Next steps"
              color="#e6c66a"
              items={stop.status.next.slice(0, 3)}
            />
          )}
          {openPrs.length > 0 && <PrSection prs={openPrs} />}
          {stop.status.updated && (
            <p style={{ fontSize: 12, opacity: 0.75, margin: "8px 0 0" }}>
              Recent activity · last updated {updatedLabel ?? "recently"}
            </p>
          )}
          {stop.blurb && stop.status.state === "unknown" && (
            <p style={{ margin: "12px 0 0", fontSize: 13, opacity: 0.8 }}>
              {stop.blurb}
            </p>
          )}
        </div>

        <footer style={footerStyle}>
          <button type="button" onClick={onClose} style={closeBtnStyle}>
            Close
          </button>
        </footer>
      </HudPanel>
    </HudBackdrop>
  );
}

function repoHref(repo: string): string {
  const trimmed = repo.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://github.com/${trimmed.replace(/^\/+/, "")}`;
}

function HudBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      data-project-hud
      role="presentation"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
      style={backdropStyle}
    >
      {children}
    </div>
  );
}

const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "rgba(8, 5, 18, 0.45)",
};

function HudPanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-hud-title"
      onClick={(e) => e.stopPropagation()}
      style={panelStyle}
    >
      {children}
    </div>
  );
}

function MetaLine({
  district,
  lineNames,
  stop,
}: {
  district: (typeof DISTRICTS)[number] | undefined;
  lineNames: string;
  stop: Stop;
}) {
  return (
    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85, lineHeight: 1.5 }}>
      {district?.displayName ?? stop.district}
      {lineNames ? ` · ${lineNames}` : ""}
    </div>
  );
}

function expressRank(stop: Stop, allStops: Stop[]): number | null {
  const queue = activeQueue(allStops);
  const idx = queue.findIndex(
    (s) => s.id === stop.id && s.district === stop.district,
  );
  return idx >= 0 ? idx + 1 : null;
}

function TitleRow({
  stop,
  linkOut,
  repoUrl,
}: {
  stop: Stop;
  linkOut: string | null;
  repoUrl: string | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
      }}
    >
      <h2
        id="project-hud-title"
        style={{ margin: 0, fontSize: 20, fontWeight: 700, flex: "1 1 auto" }}
      >
        {stop.displayName}
      </h2>
      {repoUrl && (
        <a
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            color: "#e6c66a",
            textDecoration: "underline",
          }}
        >
          repo
        </a>
      )}
      {linkOut && linkOut !== repoUrl && (
        <a
          href={linkOut}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            color: "#e6c66a",
            textDecoration: "underline",
          }}
        >
          site
        </a>
      )}
    </div>
  );
}

function VisibilityBadge({ stop }: { stop: Stop }) {
  if (!stop.isPrivate && stop.visibility !== "mayor") return null;
  const label = stop.isPrivate ? "Mayor only" : "Mayor visibility";
  return (
    <span
      style={{
        display: "inline-block",
        marginTop: 8,
        fontSize: 10,
        letterSpacing: 1,
        textTransform: "uppercase",
        padding: "3px 8px",
        background: "rgba(230,198,106,0.2)",
        borderRadius: 4,
        color: "#e6c66a",
      }}
    >
      {label}
    </span>
  );
}

function StatusRow({
  stop,
  updatedLabel,
}: {
  stop: Stop;
  updatedLabel: string | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
        flexWrap: "wrap",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: 5,
          background: STATE_COLOR[stop.status.state],
        }}
      />
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          padding: "2px 8px",
          borderRadius: 4,
          background: "rgba(245,230,200,0.1)",
        }}
      >
        {STATE_LABEL[stop.status.state]}
      </span>
      {updatedLabel && (
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          updated {updatedLabel}
        </span>
      )}
    </div>
  );
}

function QueueSection({
  stop,
  expressPriority,
}: {
  stop: Stop;
  expressPriority: number | null;
}) {
  const q = stop.queue;
  if (!q) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <SectionLabel>Queue</SectionLabel>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>
        <div>{q.active ? "Riding Mayor's Express" : "Not on the Express"}</div>
        {q.milestone && <div>Milestone · {q.milestone}</div>}
        {Number.isFinite(q.etaDays ?? NaN) && (
          <div>ETA · {etaLabel(q.etaDays!)}</div>
        )}
        {expressPriority !== null && (
          <div style={{ color: "#e6c66a", marginTop: 4 }}>
            Express priority · #{expressPriority} in line
          </div>
        )}
      </div>
    </div>
  );
}

function etaLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}

function PrSection({ prs }: { prs: CanalBoat[] }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <SectionLabel>Open PRs</SectionLabel>
      <ul style={{ margin: "6px 0 0", paddingLeft: 0, listStyle: "none" }}>
        {prs.map((pr) => {
          const lock = LOCKS.find((l) => l.id === pr.lock);
          return (
            <li key={`${pr.repo}-${pr.prNumber}`} style={{ marginBottom: 8 }}>
              <a
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--willville-paper)",
                  fontSize: 13,
                  textDecoration: "underline",
                }}
              >
                {pr.title}
              </a>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                {lock?.displayName ?? pr.lock}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ItemSection({
  title,
  color,
  items,
}: {
  title: string;
  color: string;
  items: string[];
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <SectionLabel color={color}>{title}</SectionLabel>
      <ul
        style={{
          margin: "6px 0 0",
          paddingLeft: 16,
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function SectionLabel({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: color ?? "#e6c66a",
      }}
    >
      {children}
    </div>
  );
}

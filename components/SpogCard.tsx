"use client";

import type { Stop } from "@/lib/town";

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

export function SpogCard({ stop }: { stop: Stop }) {
  const linkOut =
    stop.homepage ?? (stop.repo ? `https://github.com/${stop.repo}` : null);
  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        right: 24,
        width: 360,
        background:
          "linear-gradient(180deg, rgba(245,230,200,0.97) 0%, rgba(232,212,170,0.97) 100%)",
        color: "var(--willville-ink)",
        borderRadius: 8,
        padding: "16px 18px",
        fontFamily: "var(--font-sans), serif",
        boxShadow:
          "0 10px 30px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.08)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: 5,
            background: STATE_COLOR[stop.status.state],
            boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
          }}
        />
        <strong style={{ fontSize: 16 }}>{stop.displayName}</strong>
      </div>
      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
        {STATE_LABEL[stop.status.state]}
        {stop.status.updated
          ? ` · updated ${stop.status.updated.slice(0, 10)}`
          : ""}
      </div>
      {stop.status.summary && (
        <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.4 }}>
          {stop.status.summary}
        </p>
      )}
      {stop.status.doing && (
        <Section title="Doing" color="#7bd389" items={[stop.status.doing]} />
      )}
      {stop.status.done && (
        <Section title="Done" color="#b6b6b6" items={[stop.status.done]} />
      )}
      {stop.status.blocked && (
        <Section
          title="Blocked"
          color="#9b2c2c"
          items={[stop.status.blocked]}
        />
      )}
      {stop.status.next && (
        <Section title="Next" color="#7a5a16" items={[stop.status.next]} />
      )}
      {stop.status.risk && (
        <Section title="Risk" color="#ffa066" items={[stop.status.risk]} />
      )}
      {stop.blurb && stop.status.state === "unknown" && (
        <p style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          {stop.blurb}
        </p>
      )}
      {linkOut && (
        <a
          href={linkOut}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            marginTop: 12,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--willville-ink)",
            textDecoration: "underline",
          }}
        >
          Visit {stop.homepage ? "→" : "the repo →"}
        </a>
      )}
    </div>
  );
}

function Section({
  title,
  color,
  items,
}: {
  title: string;
  color: string;
  items: string[];
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      <ul
        style={{
          margin: "4px 0 0",
          paddingLeft: 16,
          fontSize: 13,
          lineHeight: 1.4,
        }}
      >
        {items.slice(0, 3).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

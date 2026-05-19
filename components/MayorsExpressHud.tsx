"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { activeQueue, type Stop } from "@/lib/town";

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * "Now arriving" HUD anchored to the top-left of the screen. Surfaces the
 * Mayor's Express queue: which projects are riding it, where the train is
 * heading next, and how many days until each milestone.
 *
 * Renders only on the client so queue order/ETAs never diverge during hydration.
 */
export function MayorsExpressHud({ stops }: { stops: Stop[] }) {
  const router = useRouter();
  const isClient = useIsClient();

  if (!isClient) return null;

  const queue = activeQueue(stops);
  if (queue.length === 0) return null;

  const next = queue[0]!;
  const after = queue.slice(1, 5);

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        width: 260,
        background:
          "linear-gradient(180deg, rgba(36,24,12,0.92) 0%, rgba(20,12,6,0.96) 100%)",
        color: "var(--willville-paper)",
        borderRadius: 8,
        padding: "12px 14px",
        fontFamily: "var(--font-sans), serif",
        boxShadow:
          "0 10px 30px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(230,198,106,0.45)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <HudBody
        next={next}
        after={after}
        onSelect={(stop) => router.push(`/${stop.district}/${stop.id}/`)}
      />
    </div>
  );
}

function HudBody({
  next,
  after,
  onSelect,
}: {
  next: Stop;
  after: Stop[];
  onSelect: (stop: Stop) => void;
}) {
  return (
    <>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#e6c66a",
          marginBottom: 4,
        }}
      >
        Mayor&apos;s Express · Now arriving
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(next);
        }}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: 0,
          color: "var(--willville-paper)",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700 }}>{next.displayName}</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {next.queue?.milestone ?? "milestone TBD"}
          {Number.isFinite(next.queue?.etaDays ?? NaN)
            ? ` · ${etaLabel(next.queue!.etaDays!)}`
            : ""}
        </div>
      </button>
      {after.length > 0 && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: "1px solid rgba(230,198,106,0.25)",
            fontSize: 11,
            opacity: 0.85,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: "#e6c66a" }}>
            Then:
          </div>
          {after.map((stop, i) => (
            <button
              key={stop.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(stop);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: 0,
                color: "var(--willville-paper)",
                cursor: "pointer",
                padding: "2px 0",
                fontSize: 12,
              }}
            >
              <span style={{ color: "#e6c66a", marginRight: 6 }}>{i + 2}.</span>
              {stop.displayName}
              {Number.isFinite(stop.queue?.etaDays ?? NaN) && (
                <span style={{ opacity: 0.6 }}>
                  {" "}
                  · {etaLabel(stop.queue!.etaDays!)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function etaLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day out";
  if (days < 14) return `${days} days out`;
  if (days < 60) return `${Math.round(days / 7)} weeks out`;
  return `${Math.round(days / 30)} months out`;
}

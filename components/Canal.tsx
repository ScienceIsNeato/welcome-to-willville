"use client";

import { useEffect, useMemo, useState } from "react";
import type { CanalBoat } from "@/lib/canal";
import { CANAL } from "@/lib/willville";
import {
  CANAL_SECTION,
  GENERATED_TOWN_LAYOUT,
  pointsToPath,
} from "@/lib/town-layout";
import {
  GATE_HALF_WIDTH,
  LOCKS,
  CHANNEL_LOCKS,
  boatPosition,
} from "@/lib/canal";
import { RAINBOW_BRICK_LAYERS } from "@/lib/rainbow-brick-layers";
import { CanalBoat as Boat } from "./CanalBoat";

type Props = {
  boats: CanalBoat[];
  layer?: "base" | "traffic" | "all";
};

const CANAL_WALL_PATH_LENGTH = 3600;
const CANAL_BANKS = [
  { id: "north", path: CANAL_SECTION.northBankPath, duration: 116 },
  { id: "south", path: CANAL_SECTION.southBankPath, duration: 124 },
];
const OPEN_SEA_ARC_START_ANGLE = -Math.PI / 4.5;
const OPEN_SEA_ARC_END_ANGLE = Math.PI / 2.3;
const OPEN_SEA_LABEL_ANGLE = -0.15;
// Focal point of the age rings, placed so the bay's mouth lines up with the
// canal exit (nudged down and left from the old center).
const OPEN_SEA_CENTER = { x: 1210, y: 930 } as const;

// Boats spread into open sea purely by age. Each zone is exactly 24h wide and
// sits one concentric ring further out; every ring uses the same arc width, so
// age alone fans the boats — older boats land on bigger rings that naturally
// have more circumference (room) to spread. Boats from the same repo cluster
// together on their ring and overlap.
const OPEN_SEA_BOAT_ARC_CENTER = (-Math.PI / 4.8 + Math.PI / 2.3) / 2;
const OPEN_SEA_INNER_RADIUS = 150;
const OPEN_SEA_RING_SPACING = 108;
const OPEN_SEA_HALF_SPAN = 0.85;
const OPEN_SEA_ZONE_HOURS = 24;
const OPEN_SEA_MAX_ZONE = 7;
// Per-boat offset within a same-repo cluster, so they overlap in a tight stack.
const OPEN_SEA_GROUP_OFFSET_X = 16;
const OPEN_SEA_GROUP_OFFSET_Y = 11;

export function Canal({ boats, layer = "all" }: Props) {
  // Age zones are wall-clock based, so re-tick occasionally.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(interval);
    };
  }, []);

  const groupId =
    layer === "all" ? "willville-canal" : `willville-canal-${layer}`;
  const boatsByLock = new Map<string, CanalBoat[]>();
  for (const boat of boats) {
    if (!boatsByLock.has(boat.lock)) boatsByLock.set(boat.lock, []);
    boatsByLock.get(boat.lock)!.push(boat);
  }

  // Pre-calculate fanned-out positions for "open-sea" boats based on age
  const openSeaPositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    const openSeaBoats = boats.filter((b) => b.lock === "open-sea");

    if (openSeaBoats.length === 0) return positions;

    const cx = OPEN_SEA_CENTER.x;
    const cy = OPEN_SEA_CENTER.y;

    const timeOf = (b: CanalBoat) =>
      new Date(b.updatedAt || b.createdAt).getTime();

    // Anchor age to wall-clock once mounted; before that fall back to the newest
    // boat so the server and first client render agree (no layout shift).
    const stableReference = Math.max(...openSeaBoats.map(timeOf));
    const referenceTime = now ?? stableReference;

    // Bucket boats into 24h-wide age zones — one concentric ring per zone.
    const zoneBoats = new Map<number, CanalBoat[]>();
    for (const b of openSeaBoats) {
      const ageHours = (referenceTime - timeOf(b)) / (1000 * 60 * 60);
      const z = Math.min(
        OPEN_SEA_MAX_ZONE,
        Math.max(0, Math.floor(ageHours / OPEN_SEA_ZONE_HOURS)),
      );
      if (!zoneBoats.has(z)) zoneBoats.set(z, []);
      zoneBoats.get(z)!.push(b);
    }

    const minAngle = OPEN_SEA_BOAT_ARC_CENTER - OPEN_SEA_HALF_SPAN;
    const span = 2 * OPEN_SEA_HALF_SPAN;

    for (const [z, boatsInZone] of zoneBoats) {
      const radius = OPEN_SEA_INNER_RADIUS + z * OPEN_SEA_RING_SPACING;

      // Cluster boats from the same repo together on this ring.
      const repoGroups = new Map<string, CanalBoat[]>();
      for (const b of boatsInZone) {
        if (!repoGroups.has(b.repo)) repoGroups.set(b.repo, []);
        repoGroups.get(b.repo)!.push(b);
      }
      // Order clusters along the arc by their newest boat for a stable layout.
      const clusters = [...repoGroups.values()].sort(
        (a, b) => Math.max(...b.map(timeOf)) - Math.max(...a.map(timeOf)),
      );

      clusters.forEach((cluster, ci) => {
        const frac = clusters.length > 1 ? ci / (clusters.length - 1) : 0.5;
        const theta = minAngle + frac * span;
        const gx = cx + radius * Math.cos(theta);
        const gy = cy + radius * Math.sin(theta);

        // Same-repo boats overlap in a tight stack, oldest at the back.
        cluster
          .sort((a, b) => timeOf(a) - timeOf(b))
          .forEach((boat, bi) => {
            positions.set(`${boat.repo}-${boat.prNumber}`, {
              x: gx + bi * OPEN_SEA_GROUP_OFFSET_X,
              y: gy + bi * OPEN_SEA_GROUP_OFFSET_Y,
            });
          });
      });
    }
    return positions;
  }, [boats, now]);

  return (
    <g id={groupId} aria-label="The Canal">
      {(layer === "base" || layer === "all") && (
        <g>
          <defs>
            <clipPath id="willville-canal-shore-clip">
              <path d={GENERATED_TOWN_LAYOUT.landPath} />
            </clipPath>
            <clipPath id="willville-canal-land-clip">
              <path d={GENERATED_TOWN_LAYOUT.landPath} />
            </clipPath>
          </defs>

          <path
            d={pointsToPath(CANAL_SECTION.polygon)}
            fill="none"
            stroke="#10283a"
            strokeWidth={3}
            strokeLinejoin="round"
            clipPath="url(#willville-canal-shore-clip)"
          >
            <title>The Canal</title>
          </path>
          <path
            d={pointsToPath(CANAL_SECTION.polygon)}
            fill="none"
            stroke="#0f2b45"
            strokeWidth={8}
            strokeLinejoin="round"
            opacity={0.9}
            clipPath="url(#willville-canal-shore-clip)"
          />
          <path
            d={CANAL.pathD}
            fill="none"
            stroke={CANAL.waterHighlight}
            strokeOpacity={0.16}
            strokeWidth={52}
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath="url(#willville-canal-shore-clip)"
            aria-hidden
          />
          <path
            d={CANAL.pathD}
            fill="none"
            stroke="#8ec7df"
            strokeOpacity={0.16}
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="24 32"
            clipPath="url(#willville-canal-shore-clip)"
            aria-hidden
          />

          <g className="dynamic-walls canal-bank-walls" aria-hidden="true">
            {CANAL_BANKS.map((bank, index) => (
              <g
                key={bank.id}
                className="dynamic-wall-loop"
                clipPath="url(#willville-canal-land-clip)"
              >
                <path
                  d={bank.path}
                  className="dynamic-wall-loop-bed canal-bank-wall-bed"
                  fill="none"
                  pathLength={CANAL_WALL_PATH_LENGTH}
                />
                <path
                  d={bank.path}
                  className="dynamic-wall-loop-stones dynamic-wall-loop-stones-a canal-bank-wall-stones"
                  fill="none"
                  pathLength={CANAL_WALL_PATH_LENGTH}
                  style={
                    {
                      animationName: "dynamic-wall-dash-left",
                      animationDuration: `${bank.duration}s`,
                      animationTimingFunction: "linear",
                      animationIterationCount: "infinite",
                      willChange: "stroke-dashoffset",
                      "--dash-start": "0",
                      "--dash-len": `${CANAL_WALL_PATH_LENGTH}`,
                    } as React.CSSProperties
                  }
                />
                <path
                  d={bank.path}
                  className="dynamic-wall-loop-stones dynamic-wall-loop-stones-b canal-bank-wall-stones"
                  fill="none"
                  pathLength={CANAL_WALL_PATH_LENGTH}
                  style={
                    {
                      animationName: "dynamic-wall-dash-left",
                      animationDuration: `${bank.duration * 1.06}s`,
                      animationTimingFunction: "linear",
                      animationIterationCount: "infinite",
                      willChange: "stroke-dashoffset",
                      "--dash-start": `${80 + index * 40}`,
                      "--dash-len": `${CANAL_WALL_PATH_LENGTH}`,
                    } as React.CSSProperties
                  }
                />
                {RAINBOW_BRICK_LAYERS.map((brickLayer) => (
                  <path
                    key={`${bank.id}-${brickLayer.className}`}
                    d={bank.path}
                    className={`dynamic-wall-loop-stones dynamic-wall-loop-rainbow-bricks canal-bank-wall-rainbow-bricks ${brickLayer.className}`}
                    fill="none"
                    pathLength={CANAL_WALL_PATH_LENGTH}
                    style={
                      {
                        animationName: "dynamic-wall-dash-left",
                        animationDuration: `${bank.duration * brickLayer.speed}s`,
                        animationTimingFunction: "linear",
                        animationIterationCount: "infinite",
                        willChange: "stroke-dashoffset",
                        "--dash-start": `${brickLayer.offset + index * 23}`,
                        "--dash-len": `${CANAL_WALL_PATH_LENGTH}`,
                      } as React.CSSProperties
                    }
                  />
                ))}
                <path
                  d={bank.path}
                  className="dynamic-wall-loop-mortar canal-bank-wall-mortar"
                  fill="none"
                  pathLength={CANAL_WALL_PATH_LENGTH}
                  style={
                    {
                      animationName: "dynamic-wall-dash-left",
                      animationDuration: `${bank.duration}s`,
                      animationTimingFunction: "linear",
                      animationIterationCount: "infinite",
                      willChange: "stroke-dashoffset",
                      "--dash-start": "0",
                      "--dash-len": `${CANAL_WALL_PATH_LENGTH}`,
                    } as React.CSSProperties
                  }
                />
                <path
                  d={bank.path}
                  className="dynamic-wall-loop-glints canal-bank-wall-glints"
                  fill="none"
                  pathLength={CANAL_WALL_PATH_LENGTH}
                  style={
                    {
                      animationName: "dynamic-wall-dash-right",
                      animationDuration: `${bank.duration * 0.9}s`,
                      animationTimingFunction: "linear",
                      animationIterationCount: "infinite",
                      willChange: "stroke-dashoffset",
                      "--dash-start": `${120 - index * 40}`,
                      "--dash-len": `${CANAL_WALL_PATH_LENGTH}`,
                    } as React.CSSProperties
                  }
                />
              </g>
            ))}
          </g>

          {/* Open Sea Age Markings */}
          <g className="open-sea-markings" aria-hidden="true">
            {Array.from({ length: OPEN_SEA_MAX_ZONE }, (_, z) => ({
              r: OPEN_SEA_INNER_RADIUS + z * OPEN_SEA_RING_SPACING,
              label: `${z + 1}d`,
            })).map(({ r, label }) => {
              const cx = OPEN_SEA_CENTER.x;
              const cy = OPEN_SEA_CENTER.y;
              const startAngle = OPEN_SEA_ARC_START_ANGLE;
              const endAngle = OPEN_SEA_ARC_END_ANGLE;

              const x1 = cx + r * Math.cos(startAngle);
              const y1 = cy + r * Math.sin(startAngle);
              const x2 = cx + r * Math.cos(endAngle);
              const y2 = cy + r * Math.sin(endAngle);
              const d = `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;

              // Place label along the arc at angle -0.15 radians
              const labelAngle = OPEN_SEA_LABEL_ANGLE;
              const lx = cx + r * Math.cos(labelAngle);
              const ly = cy + r * Math.sin(labelAngle);

              return (
                <g key={`marking-${label}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke="rgba(142, 199, 223, 0.22)"
                    strokeWidth={1.5}
                    strokeDasharray="4 6"
                  />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={10}
                    fontWeight={700}
                    fill="rgba(142, 199, 223, 0.65)"
                    style={{
                      pointerEvents: "none",
                      textShadow: "0 1px 3px rgba(0, 0, 0, 0.9)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      )}

      {(layer === "traffic" || layer === "all") && (
        <g aria-hidden="true">
          {CHANNEL_LOCKS.slice(0, -1).map((lock, i) => {
            const next = CHANNEL_LOCKS[i + 1]!;
            const mx = (lock.centerX + next.centerX) / 2;
            const my = (lock.centerY + next.centerY) / 2;
            const angle =
              Math.atan2(
                next.centerY - lock.centerY,
                next.centerX - lock.centerX,
              ) +
              Math.PI / 2;
            const dx = Math.cos(angle) * GATE_HALF_WIDTH;
            const dy = Math.sin(angle) * GATE_HALF_WIDTH;
            return (
              <line
                key={`gate-${lock.id}`}
                x1={mx - dx}
                y1={my - dy}
                x2={mx + dx}
                y2={my + dy}
                stroke="#1a0f06"
                strokeOpacity={0.5}
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })}
        </g>
      )}

      {(layer === "traffic" || layer === "all") && (
        <g aria-hidden="true">
          {LOCKS.map((lock) => {
            const count = boatsByLock.get(lock.id)?.length ?? 0;
            const labelAlong = -34;
            const countAlong = 38;
            const lx = lock.centerX + Math.cos(lock.angle) * labelAlong;
            const ly = lock.centerY + Math.sin(lock.angle) * labelAlong;
            const cx = lock.centerX + Math.cos(lock.angle) * countAlong;
            const cy = lock.centerY + Math.sin(lock.angle) * countAlong;
            return (
              <g key={`label-${lock.id}`}>
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={600}
                  fill="var(--willville-paper)"
                  style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
                >
                  {lock.displayName}
                </text>
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  fontSize={12}
                  fill="var(--willville-paper)"
                  opacity={0.85}
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
                >
                  {count > 0 ? `${count} PR${count === 1 ? "" : "s"}` : "—"}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {(layer === "traffic" || layer === "all") && (
        <g>
          {LOCKS.flatMap((lock) => {
            const items = boatsByLock.get(lock.id) ?? [];
            return items.map((boat, idx) => {
              let pos;
              if (lock.id === "open-sea") {
                pos =
                  openSeaPositions.get(`${boat.repo}-${boat.prNumber}`) ??
                  boatPosition(lock.id, idx);
              } else {
                const depth =
                  lock.id === "edits"
                    ? boat.ciState === "failure"
                      ? 1
                      : 0.4
                    : 0;
                pos = boatPosition(lock.id, idx, { depth });
              }
              return (
                <Boat
                  key={`${boat.repo}-${boat.prNumber}`}
                  boat={boat}
                  position={pos}
                />
              );
            });
          })}
        </g>
      )}
    </g>
  );
}

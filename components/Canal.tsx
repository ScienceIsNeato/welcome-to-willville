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
//
// With 2-year history, rings at 108px spacing reach ~78k px radius — well past
// the SVG canvas, just like the Gulf Stream heading to the African coast. Pan
// east to see older merges streaming off into the open ocean.
const OPEN_SEA_BOAT_ARC_CENTER = (-Math.PI / 4.8 + Math.PI / 2.3) / 2;
const OPEN_SEA_INNER_RADIUS = 150;
const OPEN_SEA_RING_SPACING = 108;
const OPEN_SEA_HALF_SPAN = 0.85;
const OPEN_SEA_ZONE_HOURS = 24;
const OPEN_SEA_MAX_ZONE = 730; // 2 years of daily zones — no age clamping
// Clusters fill the center (0°, straight out of the bay) first and only fan to
// the sides as more pile up — this is the angle between adjacent cluster centers.
const OPEN_SEA_CLUSTER_ANGLE_STEP = 0.32;
// Same-repo boats scatter into a loose overlapping clump (a mini-armada) instead
// of a regular stamped line: golden-angle packing plus a seeded jitter.
const GOLDEN_ANGLE = 2.399963;
const OPEN_SEA_CLUSTER_STEP = 22;
const OPEN_SEA_CLUSTER_JITTER = 16;

/**
 * How wide the boat arc is at a given zone index.
 * Full spread for the first week; then hyperbolic convergence toward the spine
 * so the fleet looks like rivers merging into a single Gulf Stream current.
 *   zone 6  (7d)  → 1.0× = full fan
 *   zone 13 (14d) → 0.5×
 *   zone 27 (28d) → 0.25×
 *   zone 59 (2mo) → 0.11×  (basically a ribbon)
 */
function zoneHalfSpan(z: number): number {
  if (z < 7) return OPEN_SEA_HALF_SPAN;
  return OPEN_SEA_HALF_SPAN * (7 / (z + 1));
}

// Gulf Stream curve parameters.
// The outgoing spine starts heading slightly SE (matching the canal exit),
// sweeps through a pronounced Nike-swoosh turn, and settles into NNE —
// like the real Gulf Stream curving away from the coast toward the open ocean.
const SPINE_START_ANGLE = 0.42; // slightly SE (right + a little down in SVG)
const SPINE_END_ANGLE = -Math.PI / 3; // NNE (right + strongly up in SVG, ~60° above east)
const SPINE_CURVE_ZONES = 28; // ~4 weeks to complete most of the bend

/**
 * Direction angle of the Gulf Stream spine at zone z.
 * Smoothly rotates from SPINE_START_ANGLE to SPINE_END_ANGLE using
 * exponential easing so the bend is tight near shore and straightens far out.
 */
function gulfStreamAngle(z: number): number {
  const eased = 1 - Math.exp(-3 * Math.min(1, z / SPINE_CURVE_ZONES));
  return SPINE_START_ANGLE + (SPINE_END_ANGLE - SPINE_START_ANGLE) * eased;
}

/**
 * Milestone rings to draw in the open sea.
 * Days 1–7 every day, then every 7 days through month 1, then monthly.
 */
function openSeaMilestones(): Array<{ zone: number; label: string }> {
  const marks: Array<{ zone: number; label: string }> = [];
  // Every day for the first week
  for (let d = 1; d <= 7; d++) {
    marks.push({ zone: d - 1, label: `${d}d` });
  }
  // Every 7 days: 14d, 21d, 28d
  for (const d of [14, 21, 28]) {
    const zone = d - 1;
    if (zone < OPEN_SEA_MAX_ZONE) marks.push({ zone, label: `${d}d` });
  }
  // Monthly from 1mo to 24mo (≈30.44 days each)
  for (let m = 1; m <= 24; m++) {
    const zone = Math.round(m * 30.44) - 1;
    if (zone < OPEN_SEA_MAX_ZONE) marks.push({ zone, label: `${m}mo` });
  }
  return marks;
}

// Tiny deterministic hash + PRNG so each boat's jitter is stable across renders
// (no hydration mismatch) but looks random.
function seaHash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seaRand(seed: number): number {
  let x = seed || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return ((x >>> 0) % 1000000) / 1000000;
}

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
      // Clamp to the outermost rendered ring index. Rings are generated with
      // indices 0..OPEN_SEA_MAX_ZONE-1, so a boat aged past the window must
      // land on the last ring rather than beyond it.
      const z = Math.min(
        OPEN_SEA_MAX_ZONE - 1,
        Math.max(0, Math.floor(ageHours / OPEN_SEA_ZONE_HOURS)),
      );
      if (!zoneBoats.has(z)) zoneBoats.set(z, []);
      zoneBoats.get(z)!.push(b);
    }

    for (const [z, boatsInZone] of zoneBoats) {
      const radius = OPEN_SEA_INNER_RADIUS + z * OPEN_SEA_RING_SPACING;
      // Arc width shrinks with age: full fan near shore, single ribbon far out.
      const halfSpan = zoneHalfSpan(z);

      // Cluster boats from the same repo together on this ring.
      const repoGroups = new Map<string, CanalBoat[]>();
      for (const b of boatsInZone) {
        if (!repoGroups.has(b.repo)) repoGroups.set(b.repo, []);
        repoGroups.get(b.repo)!.push(b);
      }
      // Newest cluster first — it takes the center channel; the rest fan outward.
      const clusters = [...repoGroups.values()].sort(
        (a, b) => Math.max(...b.map(timeOf)) - Math.max(...a.map(timeOf)),
      );

      clusters.forEach((cluster, ci) => {
        // Center-out placement: 0 → dead center on the spine, then alternate
        // to either side so the middle fills before the edges.
        // The spine itself curves from SE (near shore) to NNE (far out) via
        // gulfStreamAngle — boats ride the current as it bends northward.
        const rank = Math.ceil(ci / 2) * (ci % 2 === 1 ? 1 : -1);
        const streamAngle = gulfStreamAngle(z);
        const theta = Math.max(
          streamAngle - halfSpan,
          Math.min(
            streamAngle + halfSpan,
            streamAngle + rank * OPEN_SEA_CLUSTER_ANGLE_STEP,
          ),
        );
        const gx = cx + radius * Math.cos(theta);
        const gy = cy + radius * Math.sin(theta);

        // Scatter same-repo boats into a loose overlapping clump (mini-armada).
        cluster
          .sort((a, b) => timeOf(a) - timeOf(b))
          .forEach((boat, bi) => {
            const seed = seaHash(`${boat.repo}-${boat.prNumber}`);
            const jitterA = seaRand(seed);
            const jitterD = seaRand(seed ^ 0x9e3779b9);
            const a = bi * GOLDEN_ANGLE + jitterA * 0.9;
            const d =
              OPEN_SEA_CLUSTER_STEP * Math.sqrt(bi) +
              (jitterD - 0.5) * OPEN_SEA_CLUSTER_JITTER;
            positions.set(`${boat.repo}-${boat.prNumber}`, {
              x: gx + Math.cos(a) * d,
              y: gy + Math.sin(a) * d,
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

          {/* Open Sea Age Markings — milestone rings only */}
          <g className="open-sea-markings" aria-hidden="true">
            {openSeaMilestones().map(({ zone, label }) => {
              const r = OPEN_SEA_INNER_RADIUS + zone * OPEN_SEA_RING_SPACING;
              const cx = OPEN_SEA_CENTER.x;
              const cy = OPEN_SEA_CENTER.y;

              // Each ring spans only as wide as the boats at that age — the
              // same hyperbolic decay used for boat placement. Near shore the
              // arcs are wide fans; far out they narrow to a short tick on the
              // spine, giving the Nike-swoosh / Gulf Stream convergence shape.
              // The spine angle rotates with the current so rings always face
              // the direction the fleet is heading at that distance.
              const halfArc = Math.max(0.02, zoneHalfSpan(zone));
              const streamAngle = gulfStreamAngle(zone);
              const startAngle = streamAngle - halfArc;
              const endAngle = streamAngle + halfArc;

              const x1 = cx + r * Math.cos(startAngle);
              const y1 = cy + r * Math.sin(startAngle);
              const x2 = cx + r * Math.cos(endAngle);
              const y2 = cy + r * Math.sin(endAngle);
              const arcD = `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;

              // Label lives on the midline spine — placed just inshore of the
              // ring so it reads "you are X away from port" as you pan outward.
              const lx = cx + (r - 28) * Math.cos(streamAngle);
              const ly = cy + (r - 28) * Math.sin(streamAngle);

              // Monthly rings are slightly brighter so the year-scale markers
              // stand out from the week-scale ones.
              const isMajor = label.endsWith("mo") || label === "7d";
              const arcOpacity = isMajor ? 0.65 : 0.42;
              const textOpacity = isMajor ? 1.0 : 0.82;
              const fontSize = isMajor ? 34 : 26;

              return (
                <g key={`marking-${label}`}>
                  <path
                    d={arcD}
                    fill="none"
                    stroke={`rgba(142, 199, 223, ${arcOpacity})`}
                    strokeWidth={isMajor ? 2.5 : 1.5}
                    strokeDasharray="6 8"
                  />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={fontSize}
                    fontWeight={700}
                    fill={`rgba(142, 199, 223, ${textOpacity})`}
                    style={{
                      pointerEvents: "none",
                      textShadow:
                        "0 1px 4px rgba(0, 0, 0, 0.95), 0 0 8px rgba(0, 0, 0, 0.7)",
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

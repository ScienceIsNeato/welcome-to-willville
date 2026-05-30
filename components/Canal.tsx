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

export function Canal({ boats, layer = "all" }: Props) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => {
      setNow(Date.now());
    }, 0);
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);
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

    // Use latest update time as a stable fallback for referenceTime before now mounts to prevent post-mount layout shift
    const stableReference = Math.max(
      ...openSeaBoats.map((b) =>
        b.updatedAt
          ? new Date(b.updatedAt).getTime()
          : new Date(b.createdAt).getTime(),
      ),
    );
    const referenceTime = now ?? stableReference;

    const cx = 1260;
    const cy = 810;

    // Group by age zones: <6h, <24h, <72h, <1w, >=1w
    const zones: CanalBoat[][] = [[], [], [], [], []];
    for (const boat of openSeaBoats) {
      const updatedAtTime = boat.updatedAt
        ? new Date(boat.updatedAt).getTime()
        : new Date(boat.createdAt).getTime();

      const ageHours = (referenceTime - updatedAtTime) / (1000 * 60 * 60);

      if (ageHours < 6) {
        zones[0].push(boat);
      } else if (ageHours < 24) {
        zones[1].push(boat);
      } else if (ageHours < 72) {
        zones[2].push(boat);
      } else if (ageHours < 168) {
        zones[3].push(boat);
      } else {
        zones[4].push(boat);
      }
    }

    // Position boats fanned out in each zone
    for (let z = 0; z < 5; z++) {
      const zoneBoats = zones[z]!;
      // Sort so older PRs (lower timestamp / earlier merge) are positioned further along the fan
      zoneBoats.sort((a, b) => {
        const tA = a.updatedAt
          ? new Date(a.updatedAt).getTime()
          : new Date(a.createdAt).getTime();
        const tB = b.updatedAt
          ? new Date(b.updatedAt).getTime()
          : new Date(b.createdAt).getTime();
        return tA - tB;
      });

      const count = zoneBoats.length;
      const minAngle = -Math.PI / 4.8;
      const maxAngle = Math.PI / 2.3;

      const rCenter =
        z === 0 ? 75 : z === 1 ? 160 : z === 2 ? 270 : z === 3 ? 400 : 540;

      for (let idx = 0; idx < count; idx++) {
        const boat = zoneBoats[idx]!;
        let theta = (minAngle + maxAngle) / 2;
        if (count > 1) {
          theta = minAngle + (idx / (count - 1)) * (maxAngle - minAngle);
        }

        const rStagger = count > 1 ? (idx % 2 === 0 ? -12 : 12) : 0;
        const radius = rCenter + rStagger;

        const x = cx + radius * Math.cos(theta);
        const y = cy + radius * Math.sin(theta);

        positions.set(`${boat.repo}-${boat.prNumber}`, { x, y });
      }
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
            {[
              { r: 110, label: "6h" },
              { r: 210, label: "24h" },
              { r: 330, label: "72h" },
              { r: 470, label: "1w" },
            ].map(({ r, label }) => {
              const cx = 1260;
              const cy = 810;
              const startAngle = -Math.PI / 4.5;
              const endAngle = Math.PI / 2.3;

              const x1 = cx + r * Math.cos(startAngle);
              const y1 = cy + r * Math.sin(startAngle);
              const x2 = cx + r * Math.cos(endAngle);
              const y2 = cy + r * Math.sin(endAngle);
              const d = `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;

              // Place label along the arc at angle -0.15 radians
              const labelAngle = -0.15;
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

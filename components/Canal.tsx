"use client";

import type { CanalBoat } from "@/lib/canal";
import { CANAL } from "@/lib/willville";
import {
  CANAL_SECTION,
  GENERATED_TOWN_LAYOUT,
  pointsToPath,
} from "@/lib/town-layout";
import { GATE_HALF_WIDTH, LOCKS, boatPosition } from "@/lib/canal";
import { CanalBoat as Boat } from "./CanalBoat";

type Props = {
  boats: CanalBoat[];
  layer?: "base" | "traffic" | "all";
};

const CANAL_WALL_PATH_LENGTH = 3600;
const CANAL_RAINBOW_BRICK_LAYERS = [
  { className: "rainbow-bricks-red", offset: 0, speed: 1 },
  { className: "rainbow-bricks-gold", offset: 18, speed: 1.02 },
  { className: "rainbow-bricks-green", offset: 38, speed: 0.98 },
  { className: "rainbow-bricks-blue", offset: 58, speed: 1.04 },
  { className: "rainbow-bricks-violet", offset: 78, speed: 0.99 },
] as const;
const CANAL_BANKS = [
  { id: "north", path: CANAL_SECTION.northBankPath, duration: 116 },
  { id: "south", path: CANAL_SECTION.southBankPath, duration: 124 },
];

export function Canal({ boats, layer = "all" }: Props) {
  const groupId =
    layer === "all" ? "willville-canal" : `willville-canal-${layer}`;
  const boatsByLock = new Map<string, CanalBoat[]>();
  for (const boat of boats) {
    if (!boatsByLock.has(boat.lock)) boatsByLock.set(boat.lock, []);
    boatsByLock.get(boat.lock)!.push(boat);
  }

  return (
    <g id={groupId} aria-label="The Canal">
      {(layer === "base" || layer === "all") && (
        <g>
          <defs>
            <clipPath id="willville-canal-shore-clip">
              <path d={GENERATED_TOWN_LAYOUT.landPath} />
            </clipPath>
            <clipPath id="willville-canal-section-clip">
              <path d={pointsToPath(CANAL_SECTION.polygon)} />
            </clipPath>
            <clipPath id="willville-canal-town-footprint-clip">
              <path d={GENERATED_TOWN_LAYOUT.townFootprintPath} />
            </clipPath>
          </defs>

          <path
            d={pointsToPath(CANAL_SECTION.polygon)}
            fill={CANAL.waterColor}
            fillOpacity={1}
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
            clipPath="url(#willville-canal-section-clip)"
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
            clipPath="url(#willville-canal-section-clip)"
            aria-hidden
          />

          <g className="dynamic-walls canal-bank-walls" aria-hidden="true">
            {CANAL_BANKS.map((bank, index) => (
              <g
                key={bank.id}
                className="dynamic-wall-loop"
                clipPath="url(#willville-canal-town-footprint-clip)"
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
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to={`-${CANAL_WALL_PATH_LENGTH}`}
                    dur={`${bank.duration}s`}
                    repeatCount="indefinite"
                  />
                </path>
                <path
                  d={bank.path}
                  className="dynamic-wall-loop-stones dynamic-wall-loop-stones-b canal-bank-wall-stones"
                  fill="none"
                  pathLength={CANAL_WALL_PATH_LENGTH}
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from={`${80 + index * 40}`}
                    to={`${80 + index * 40 - CANAL_WALL_PATH_LENGTH}`}
                    dur={`${bank.duration * 1.06}s`}
                    repeatCount="indefinite"
                  />
                </path>
                {CANAL_RAINBOW_BRICK_LAYERS.map((brickLayer) => (
                  <path
                    key={`${bank.id}-${brickLayer.className}`}
                    d={bank.path}
                    className={`dynamic-wall-loop-stones dynamic-wall-loop-rainbow-bricks canal-bank-wall-rainbow-bricks ${brickLayer.className}`}
                    fill="none"
                    pathLength={CANAL_WALL_PATH_LENGTH}
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from={`${brickLayer.offset + index * 23}`}
                      to={`${brickLayer.offset + index * 23 - CANAL_WALL_PATH_LENGTH}`}
                      dur={`${bank.duration * brickLayer.speed}s`}
                      repeatCount="indefinite"
                    />
                  </path>
                ))}
                <path
                  d={bank.path}
                  className="dynamic-wall-loop-mortar canal-bank-wall-mortar"
                  fill="none"
                  pathLength={CANAL_WALL_PATH_LENGTH}
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to={`-${CANAL_WALL_PATH_LENGTH}`}
                    dur={`${bank.duration}s`}
                    repeatCount="indefinite"
                  />
                </path>
                <path
                  d={bank.path}
                  className="dynamic-wall-loop-glints canal-bank-wall-glints"
                  fill="none"
                  pathLength={CANAL_WALL_PATH_LENGTH}
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from={`${120 - index * 40}`}
                    to={`${120 - index * 40 + CANAL_WALL_PATH_LENGTH}`}
                    dur={`${bank.duration * 0.9}s`}
                    repeatCount="indefinite"
                  />
                </path>
              </g>
            ))}
          </g>
        </g>
      )}

      {(layer === "traffic" || layer === "all") && (
        <g aria-hidden="true">
          {LOCKS.slice(0, -1).map((lock, i) => {
            const next = LOCKS[i + 1]!;
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
              const pos = boatPosition(lock.id, idx);
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

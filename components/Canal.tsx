"use client";

import type { CanalBoat } from "@/lib/canal";
import { CANAL } from "@/lib/willville";
import { GATE_HALF_WIDTH, LOCKS, boatPosition } from "@/lib/canal";
import { CanalBoat as Boat } from "./CanalBoat";

type Props = {
  boats: CanalBoat[];
};

/**
 * Interactive overlay on the painted canal: gate posts, chamber labels, and
 * PR boats. Water and lock walls come from willville.png — no water slab here.
 */
export function Canal({ boats }: Props) {
  const boatsByLock = new Map<string, CanalBoat[]>();
  for (const boat of boats) {
    if (!boatsByLock.has(boat.lock)) boatsByLock.set(boat.lock, []);
    boatsByLock.get(boat.lock)!.push(boat);
  }

  return (
    <g id="willville-canal" aria-label="The Canal">
      {/* Optional centerline guide — nearly invisible; painting is source of truth. */}
      <path
        d={CANAL.pathD}
        fill="none"
        stroke={CANAL.waterHighlight}
        strokeOpacity={0.06}
        strokeWidth={48}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      />

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
    </g>
  );
}

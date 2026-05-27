"use client";

import type { MouseEvent } from "react";
import type { CanalBoat as CanalBoatType } from "@/lib/canal";
import shipManifest from "@/data/canal-ship-sprites.v1.json";

const DEFAULT_SHIP = "/art/stops/canal-ship.png?v=galleon-v1";
const SHIP_W = 88;
const SHIP_H = 100;

const SHIP_SPRITES = new Map(shipManifest.ships.map((s) => [s.stopId, s.src]));

type Props = {
  boat: CanalBoatType;
  position: { x: number; y: number };
};

export function CanalBoat({ boat, position }: Props) {
  const label = `Open PR #${boat.prNumber}: ${boat.title}`;
  const shipSrc =
    (boat.stopId && SHIP_SPRITES.get(boat.stopId)) ?? DEFAULT_SHIP;

  const stopStageClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.assign(boat.url);
  };

  return (
    <a
      href={boat.url}
      onClick={stopStageClick}
      style={{ cursor: "pointer", pointerEvents: "all" }}
      role="link"
      tabIndex={0}
      aria-label={label}
    >
      <g transform={`translate(${position.x}, ${position.y})`}>
        <title>
          {`#${boat.prNumber} · ${boat.title}\n${boat.repo} · ${boat.author}`}
        </title>
        <rect
          x={-SHIP_W / 2 - 4}
          y={-SHIP_H - 14}
          width={SHIP_W + 8}
          height={SHIP_H + 20}
          fill="transparent"
          pointerEvents="all"
        />
        <image
          href={shipSrc}
          x={-SHIP_W / 2}
          y={-SHIP_H + 12}
          width={SHIP_W}
          height={SHIP_H}
          preserveAspectRatio="xMidYMid meet"
          opacity={boat.draft ? 0.55 : 1}
          style={{ pointerEvents: "none" }}
        />
        <text
          y={-SHIP_H + 2}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fill="var(--willville-paper)"
          style={{
            pointerEvents: "none",
            textShadow: "0 1px 3px rgba(0,0,0,0.8)",
          }}
        >
          #{boat.prNumber}
        </text>
      </g>
    </a>
  );
}

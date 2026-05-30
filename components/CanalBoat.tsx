"use client";

import type { MouseEvent } from "react";
import { isMayorMove, type CanalBoat as CanalBoatType } from "@/lib/canal";
import shipManifest from "@/data/canal-ship-sprites.v1.json";

const DEFAULT_SHIP = "/art/stops/canal-ship.png?v=galleon-v1";
const SHIP_W = 88;
const SHIP_H = 100;
const MAX_FLAGS = 5;

const SHIP_SPRITES = new Map(shipManifest.ships.map((s) => [s.stopId, s.src]));

type Props = {
  boat: CanalBoatType;
  position: { x: number; y: number };
};

/** Black jolly-roger pennants flying off the mast, one per buff round. */
function JollyRogers({ rounds }: { rounds: number }) {
  if (rounds <= 0) return null;
  const flags = Math.min(rounds, MAX_FLAGS);
  const overflow = rounds > MAX_FLAGS;
  const mastX = 0;
  const mastTop = -SHIP_H - 4;
  const mastBottom = -SHIP_H + 30;
  return (
    <g aria-hidden="true" style={{ pointerEvents: "none" }}>
      <line
        x1={mastX}
        y1={mastTop}
        x2={mastX}
        y2={mastBottom}
        stroke="#2b1d12"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {Array.from({ length: flags }).map((_, i) => {
        const fy = mastTop + 2 + i * 8;
        return (
          <path
            key={i}
            d={`M ${mastX} ${fy} L ${mastX + 16} ${fy + 3} L ${mastX} ${fy + 6} Z`}
            fill="#161616"
            stroke="#f4f1e8"
            strokeWidth={0.6}
          />
        );
      })}
      {overflow && (
        <text
          x={mastX + 19}
          y={mastTop + 8}
          fontSize={9}
          fontWeight={800}
          fill="var(--willville-paper)"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
        >
          {rounds}+
        </text>
      )}
    </g>
  );
}

export function CanalBoat({ boat, position }: Props) {
  const label = `Open PR #${boat.prNumber}: ${boat.title}`;
  const shipSrc =
    (boat.stopId && SHIP_SPRITES.get(boat.stopId)) ?? DEFAULT_SHIP;

  // Bow points west (into town) only when it's the Mayor's move; otherwise the
  // boat faces east, out to sea — "not your problem yet."
  const mayorMove = isMayorMove(boat.lock);
  const bowTransform = mayorMove ? "scale(-1, 1)" : undefined;
  const hullFilter =
    boat.lock === "scuttle"
      ? "saturate(0.25) brightness(0.8)"
      : ["final", "open-sea"].includes(boat.lock)
        ? undefined
        : "saturate(0.3) brightness(0.92)";

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
          {`#${boat.prNumber} · ${boat.title}\n${boat.repo} · ${boat.author}` +
            (boat.rounds > 0
              ? `\n${boat.rounds} round${boat.rounds === 1 ? "" : "s"} weathered`
              : "") +
            (mayorMove ? "\nMayor's move — merge me" : "")}
        </title>
        <rect
          x={-SHIP_W / 2 - 4}
          y={-SHIP_H - 14}
          width={SHIP_W + 8}
          height={SHIP_H + 20}
          fill="transparent"
          pointerEvents="all"
        />
        {mayorMove && (
          <circle
            cx={0}
            cy={-SHIP_H / 2 + 12}
            r={SHIP_W / 2 + 6}
            fill="none"
            stroke="#ff3b30"
            strokeWidth={3}
            opacity={0.7}
            style={{ pointerEvents: "none" }}
          >
            <animate
              attributeName="opacity"
              values="0.2;0.85;0.2"
              dur="1.4s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values={`${SHIP_W / 2 + 2};${SHIP_W / 2 + 12};${SHIP_W / 2 + 2}`}
              dur="1.4s"
              repeatCount="indefinite"
            />
          </circle>
        )}
        <g transform={bowTransform}>
          <image
            href={shipSrc}
            x={-SHIP_W / 2}
            y={-SHIP_H + 12}
            width={SHIP_W}
            height={SHIP_H}
            preserveAspectRatio="xMidYMid meet"
            opacity={1}
            style={{
              pointerEvents: "none",
              filter: hullFilter,
            }}
          />
        </g>
        <JollyRogers rounds={boat.rounds} />
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
        {mayorMove && (
          <text
            y={26}
            textAnchor="middle"
            fontSize={11}
            fontWeight={800}
            fill="#ff3b30"
            style={{
              pointerEvents: "none",
              textShadow: "0 1px 3px rgba(0,0,0,0.9)",
              letterSpacing: "0.08em",
            }}
          >
            MERGE ME
          </text>
        )}
      </g>
    </a>
  );
}

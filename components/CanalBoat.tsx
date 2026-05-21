"use client";

import type { MouseEvent } from "react";
import type { CanalBoat as CanalBoatType } from "@/lib/canal";

const DISTRICT_HULL: Record<string, string> = {
  "the-press-row": "var(--willville-press)",
  "the-foundry": "var(--willville-foundry)",
  "slop-wharf": "var(--willville-slop)",
  "the-audit-yard": "var(--willville-audit)",
  "web-row": "var(--willville-web)",
  "the-sawmill-district": "var(--willville-sawmill)",
  "hallow-hollow": "var(--willville-hallow)",
  "the-hearth": "var(--willville-hearth)",
};

type Props = {
  boat: CanalBoatType;
  position: { x: number; y: number };
};

export function CanalBoat({ boat, position }: Props) {
  const hull = (boat.district && DISTRICT_HULL[boat.district]) ?? "#888";
  const sailColor = boat.draft ? "#888" : "var(--willville-paper)";
  const label = `Open PR #${boat.prNumber}: ${boat.title}`;

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
          x={-30}
          y={-34}
          width={64}
          height={52}
          fill="transparent"
          pointerEvents="all"
        />
        {/* hull */}
        <path
          d="M -22 0 Q -16 10 -10 12 L 16 12 Q 22 10 26 0 Z"
          fill={hull}
          stroke="#0c1a26"
          strokeWidth={1.5}
        />
        {/* mast */}
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={-22}
          stroke="#3a2410"
          strokeWidth={1.5}
        />
        {/* sail */}
        <path
          d="M 0 -22 L 12 -8 L 0 -8 Z"
          fill={sailColor}
          stroke="#0c1a26"
          strokeWidth={1}
          opacity={boat.draft ? 0.55 : 0.95}
        />
        {/* PR number flag */}
        <text
          y={-26}
          textAnchor="middle"
          fontSize={9}
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

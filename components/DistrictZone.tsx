"use client";

import type { District } from "@/lib/willville";

type Props = {
  district: District;
};

/** Visual district overlay — labels and tint only; no click navigation. */
export function DistrictZone({ district }: Props) {
  const color = `var(${district.colorVar})`;
  return (
    <g
      className={`district-${district.id.replace(/^the-/, "")}`}
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      <polygon
        points={district.polygon}
        fill={color}
        fillOpacity={0}
        stroke={color}
        strokeWidth={1.5}
        strokeOpacity={0.35}
      >
        <title>{district.displayName}</title>
      </polygon>
      <text
        x={district.label.x}
        y={district.label.y}
        textAnchor="middle"
        fontSize={24}
        fontWeight={700}
        letterSpacing={1}
        fill="var(--willville-paper)"
        style={{
          pointerEvents: "none",
          textShadow: "0 2px 8px rgba(0,0,0,0.8)",
        }}
      >
        {district.displayName}
      </text>
    </g>
  );
}

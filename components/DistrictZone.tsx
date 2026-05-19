"use client";

import { useRouter } from "next/navigation";
import type { District } from "@/lib/willville";

type Props = {
  district: District;
  isFocused: boolean;
};

export function DistrictZone({ district, isFocused }: Props) {
  const router = useRouter();
  const color = `var(${district.colorVar})`;
  return (
    <g
      className={`district-${district.id.replace(/^the-/, "")}`}
      onClick={() => router.push(`/${district.id}/`)}
      style={{ cursor: "pointer" }}
      aria-label={district.displayName}
    >
      <polygon
        points={district.polygon}
        fill={color}
        fillOpacity={isFocused ? 0.28 : 0}
        stroke={color}
        strokeWidth={isFocused ? 3 : 1.5}
        strokeOpacity={isFocused ? 0.85 : 0.35}
        style={{ transition: "fill-opacity 200ms, stroke-opacity 200ms" }}
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

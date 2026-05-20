"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import type { District } from "@/lib/willville";

type Props = {
  district: District;
};

export function DistrictZone({ district }: Props) {
  const router = useRouter();
  const enterDistrict = (event: MouseEvent<SVGElement>) => {
    event.stopPropagation();
    router.push(`/${district.id}/`);
  };

  return (
    <g
      className={`district-${district.id.replace(/^the-/, "")}`}
      style={{ cursor: "pointer" }}
      aria-label={district.displayName}
    >
      <polygon
        points={district.polygon}
        fill="none"
        stroke="transparent"
        strokeWidth={0}
        pointerEvents="all"
        onClick={enterDistrict}
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

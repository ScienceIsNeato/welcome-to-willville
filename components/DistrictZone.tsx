"use client";

import type { MouseEvent } from "react";
import type { KeyboardEvent } from "react";
import type { District } from "@/lib/willville";

type Props = {
  district: District;
  onEnterDistrict: (district: District) => void;
  layer?: "hit" | "label" | "all";
};

export function DistrictZone({
  district,
  onEnterDistrict,
  layer = "all",
}: Props) {
  const enterDistrict = (event: MouseEvent<SVGElement>) => {
    event.stopPropagation();
    onEnterDistrict(district);
  };
  const enterDistrictFromKeyboard = (event: KeyboardEvent<SVGElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    onEnterDistrict(district);
  };

  return (
    <g
      className={`district-${district.id.replace(/^the-/, "")}`}
      style={{ cursor: "pointer" }}
      aria-label={district.displayName}
    >
      {(layer === "hit" || layer === "all") && (
        <polygon
          points={district.polygon}
          fill="transparent"
          stroke="transparent"
          strokeWidth={0}
          pointerEvents="all"
          role="link"
          tabIndex={0}
          aria-label={`Open ${district.displayName}`}
          onClick={enterDistrict}
          onKeyDown={enterDistrictFromKeyboard}
        >
          <title>{district.displayName}</title>
        </polygon>
      )}
      {(layer === "label" || layer === "all") && (
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
      )}
    </g>
  );
}

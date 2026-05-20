"use client";

import type { MouseEvent } from "react";
import type { KeyboardEvent } from "react";
import type { District } from "@/lib/willville";

type Props = {
  district: District;
  onEnterDistrict: (district: District) => void;
};

export function DistrictZone({ district, onEnterDistrict }: Props) {
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

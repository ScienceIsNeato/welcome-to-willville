"use client";

import { useState, type MouseEvent } from "react";

type Props = {
  onActivate: () => void;
};

export function DepartmentOfTourism({ onActivate }: Props) {
  const [hovered, setHovered] = useState(false);
  const stopStageClick = (event: MouseEvent<SVGGElement>) => {
    event.stopPropagation();
    onActivate();
  };

  return (
    <g
      transform="translate(1370, 285)"
      style={{ cursor: "pointer" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={stopStageClick}
    >
      <ellipse
        cx={0}
        cy={18}
        rx={56}
        ry={22}
        fill="rgba(16,10,4,0.28)"
        pointerEvents="none"
      />
      <image
        href="/art/stops/department-of-tourism.png?v=tourism-v2"
        x={-84}
        y={-126}
        width={168}
        height={168}
        preserveAspectRatio="xMidYMid meet"
        style={{
          pointerEvents: "none",
          filter: hovered
            ? "drop-shadow(0 0 12px rgba(230,198,106,0.35))"
            : "drop-shadow(0 4px 10px rgba(0,0,0,0.28))",
        }}
      />
      <rect
        x={-86}
        y={-132}
        width={172}
        height={176}
        fill="transparent"
        pointerEvents="all"
      />
      {hovered && (
        <g style={{ pointerEvents: "none" }}>
          <rect
            x={-112}
            y={-78}
            width={224}
            height={24}
            rx={5}
            fill="rgba(12,7,22,0.88)"
            stroke="rgba(230,198,106,0.35)"
            strokeWidth={1}
          />
          <text
            x={0}
            y={-61}
            textAnchor="middle"
            fontSize={13}
            fill="#e6c66a"
            fontFamily="var(--font-sans, sans-serif)"
          >
            add your own stop to Willville
          </text>
        </g>
      )}
    </g>
  );
}

"use client";

import { useState, type MouseEvent } from "react";
import { GENERATED_TOWN_LAYOUT } from "@/lib/town-layout";
import { DepartmentOfTourism } from "./DepartmentOfTourism";
import { HollywoodSign } from "./HollywoodSign";

type Props = {
  mobileSafeMode: boolean;
  populating: "idle" | "running" | "done" | "error";
  onBell: () => void;
  onEgg: () => void;
  onTourism: () => void;
};

export function SpecialTownLandmarks({
  mobileSafeMode,
  populating,
  onBell,
  onEgg,
  onTourism,
}: Props) {
  const [bellHovered, setBellHovered] = useState(false);
  const [eggHovered, setEggHovered] = useState(false);

  const activate = (event: MouseEvent<SVGGElement>, callback: () => void) => {
    event.stopPropagation();
    callback();
  };

  return (
    <>
      {!mobileSafeMode && <HollywoodSign />}
      <DepartmentOfTourism onActivate={onTourism} />

      <g
        transform="translate(1440, 1100)"
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setEggHovered(true)}
        onMouseLeave={() => setEggHovered(false)}
        onClick={(event) => activate(event, onEgg)}
      >
        <circle r={18} fill="transparent" pointerEvents="all" />
        <image
          href="/art/egg.png"
          x={-14}
          y={-18}
          width={28}
          height={36}
          opacity={eggHovered ? 1 : 0.6}
          style={{ transition: "opacity 0.3s" }}
        />
      </g>

      <g
        transform={`translate(${GENERATED_TOWN_LAYOUT.landmarks.bellTower.x}, ${GENERATED_TOWN_LAYOUT.landmarks.bellTower.y})`}
        style={{ cursor: populating === "running" ? "wait" : "pointer" }}
        onMouseEnter={() => setBellHovered(true)}
        onMouseLeave={() => setBellHovered(false)}
        onClick={(event) => activate(event, onBell)}
      >
        <polygon
          points="0,-155 42,-130 54,-88 58,-42 64,6 42,24 0,32 -42,24 -64,6 -58,-42 -54,-88 -42,-130"
          fill="transparent"
          pointerEvents="all"
        />

        {bellHovered && populating === "idle" && (
          <polygon
            points="0,-145 38,-122 48,-80 50,-38 58,4 38,20 0,28 -38,20 -58,4 -50,-38 -48,-80 -38,-122"
            fill="none"
            stroke="rgba(230,198,106,0.55)"
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeLinejoin="round"
          />
        )}

        {populating === "running" && (
          <polygon
            points="0,-145 38,-122 48,-80 50,-38 58,4 38,20 0,28 -38,20 -58,4 -50,-38 -48,-80 -38,-122"
            fill="none"
            stroke="rgba(230,198,106,0.8)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}

        {bellHovered && (populating === "idle" || populating === "running") && (
          <g style={{ pointerEvents: "none" }}>
            <rect
              x={populating === "running" ? -86 : -68}
              y={-88}
              width={populating === "running" ? 172 : 136}
              height={24}
              rx={5}
              fill="rgba(12,7,22,0.88)"
              stroke="rgba(230,198,106,0.35)"
              strokeWidth={1}
            />
            <text
              x={0}
              y={-71}
              textAnchor="middle"
              fontSize={13}
              fill="#e6c66a"
              fontFamily="var(--font-sans, sans-serif)"
            >
              {populating === "running"
                ? "The Town Bell Sees All"
                : "Ring the town bell"}
            </text>
          </g>
        )}
      </g>
    </>
  );
}

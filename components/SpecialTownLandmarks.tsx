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
  onAbout: () => void;
  onHarbormasterClick: () => void;
};

export function SpecialTownLandmarks({
  mobileSafeMode: _mobileSafeMode,
  populating,
  onBell,
  onEgg,
  onTourism,
  onAbout,
  onHarbormasterClick,
}: Props) {
  const [bellHovered, setBellHovered] = useState(false);
  const [eggHovered, setEggHovered] = useState(false);
  const [aboutHovered, setAboutHovered] = useState(false);
  const [harbormasterHovered, setHarbormasterHovered] = useState(false);

  const activate = (event: MouseEvent<SVGGElement>, callback: () => void) => {
    event.stopPropagation();
    callback();
  };

  return (
    <>
      <HollywoodSign />

      <g
        transform="translate(1008, -60) rotate(7)"
        aria-label="Willville Town Forum sign"
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setAboutHovered(true)}
        onMouseLeave={() => setAboutHovered(false)}
        onClick={(event) => activate(event, onAbout)}
      >
        <defs>
          <linearGradient id="wtf-cork-frame-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6f4729" />
            <stop offset="50%" stopColor="#59371f" />
            <stop offset="100%" stopColor="#3f2715" />
          </linearGradient>

          <linearGradient
            id="wtf-cork-surface-base"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0%" stopColor="#bf8b57" />
            <stop offset="52%" stopColor="#a16c3f" />
            <stop offset="100%" stopColor="#84532f" />
          </linearGradient>

          <pattern
            id="wtf-cork-speckle"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <rect width="18" height="18" fill="url(#wtf-cork-surface-base)" />
            <circle cx="4" cy="5" r="1.2" fill="rgba(62,35,18,0.32)" />
            <circle cx="12" cy="3" r="1" fill="rgba(236,204,156,0.26)" />
            <ellipse
              cx="10"
              cy="10"
              rx="1.9"
              ry="1.2"
              fill="rgba(73,44,24,0.28)"
            />
            <ellipse
              cx="6"
              cy="14"
              rx="2.2"
              ry="1.4"
              fill="rgba(226,183,132,0.18)"
            />
            <circle cx="15" cy="14" r="1.1" fill="rgba(55,33,18,0.3)" />
          </pattern>

          <filter
            id="wtf-cork-noise"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.92"
              numOctaves="2"
              seed="9"
              result="noise"
            />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0.28 0 0 0 0.22 0 0.2 0 0 0.11 0 0 0.12 0 0.06 0 0 0 0.2 0"
              result="grain"
            />
            <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
          </filter>

          <filter
            id="wtf-cork-board-shadow"
            x="-30%"
            y="-40%"
            width="170%"
            height="200%"
          >
            <feDropShadow
              dx="0"
              dy="5"
              stdDeviation="3.8"
              floodColor="rgba(12, 7, 3, 0.48)"
            />
          </filter>

          <radialGradient id="wtf-pin-head" cx="34%" cy="28%" r="76%">
            <stop offset="0%" stopColor="#f7f0e6" />
            <stop offset="38%" stopColor="#d9c2a4" />
            <stop offset="100%" stopColor="#7a5433" />
          </radialGradient>

          <linearGradient id="wtf-paper-card" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f8f2e6" />
            <stop offset="100%" stopColor="#e5dac8" />
          </linearGradient>
        </defs>

        {[-86, -44, 0, 44, 86].map((x) => (
          <line
            key={`wtf-sign-post-${x}`}
            x1={x}
            y1={34}
            x2={x - 8}
            y2={84}
            stroke="#5f3d23"
            strokeWidth={4.2}
            strokeLinecap="round"
            style={{
              filter: "drop-shadow(0 2px 1px rgba(15, 8, 4, 0.32))",
            }}
          />
        ))}

        <g style={{ filter: "url(#wtf-cork-board-shadow)" }}>
          <rect
            x={-124}
            y={-24}
            width={248}
            height={70}
            rx={6}
            fill="url(#wtf-cork-frame-wood)"
            stroke="#2d1b0f"
            strokeWidth={2.4}
          />
          <rect
            x={-112}
            y={-13}
            width={224}
            height={48}
            rx={2.8}
            fill="url(#wtf-cork-speckle)"
            stroke="rgba(52,30,16,0.6)"
            strokeWidth={1.2}
            style={{ filter: "url(#wtf-cork-noise)" }}
          />
          <rect
            x={-112}
            y={-13}
            width={224}
            height={48}
            rx={2.8}
            fill="none"
            stroke="rgba(255,232,193,0.22)"
            strokeWidth={1}
          />
        </g>

        {[
          { letter: "W", x: -56, y: 10, rotate: -4.5, pinX: -56, pinY: -2 },
          { letter: "T", x: 0, y: 10, rotate: 1.2, pinX: 0, pinY: -1 },
          { letter: "F", x: 56, y: 10, rotate: -2.6, pinX: 56, pinY: -1 },
        ].map((card) => (
          <g
            key={`wtf-card-${card.letter}`}
            transform={`translate(${card.x}, ${card.y}) rotate(${card.rotate})`}
          >
            <rect
              x={-22}
              y={-16}
              width={44}
              height={30}
              rx={2}
              fill="url(#wtf-paper-card)"
              stroke="rgba(120,95,70,0.5)"
              strokeWidth={1}
              style={{
                filter:
                  "drop-shadow(0 2px 1px rgba(26, 14, 6, 0.38)) drop-shadow(0 5px 2px rgba(16, 8, 3, 0.2))",
              }}
            />
            <text
              x={0}
              y={4}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={30}
              fontWeight={900}
              fill="#2f2318"
              style={{
                paintOrder: "stroke",
                stroke: "rgba(255,243,223,0.7)",
                strokeWidth: 0.8,
                letterSpacing: 0.4,
              }}
            >
              {card.letter}
            </text>
          </g>
        ))}

        {[-101, -20, 101].map((x) => (
          <circle
            key={`wtf-frame-pin-${x}`}
            cx={x}
            cy={-15}
            r={4.1}
            fill="url(#wtf-pin-head)"
            stroke="rgba(53,31,16,0.65)"
            strokeWidth={0.9}
            style={{ filter: "drop-shadow(0 1px 1px rgba(16, 8, 3, 0.55))" }}
          />
        ))}

        <rect
          x={-122}
          y={-24}
          width={244}
          height={116}
          fill="transparent"
          pointerEvents="all"
        />

        {aboutHovered && (
          <g style={{ pointerEvents: "none" }}>
            <rect
              x={-164}
              y={-66}
              width={328}
              height={24}
              rx={5}
              fill="rgba(12,7,22,0.9)"
              stroke="rgba(230,198,106,0.35)"
              strokeWidth={1}
            />
            <text
              x={0}
              y={-45}
              textAnchor="middle"
              fontSize={13}
              fill="#e6c66a"
              fontFamily="var(--font-sans, sans-serif)"
            >
              Open the Willville Town Forum
            </text>
          </g>
        )}
      </g>

      {/* Harbormaster's Recordkeeping Dockhouse */}
      <g
        transform="translate(1420, 560)"
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setHarbormasterHovered(true)}
        onMouseLeave={() => setHarbormasterHovered(false)}
        onClick={(event) => activate(event, onHarbormasterClick)}
      >
        {/* Water ripples */}
        <ellipse
          cx={0}
          cy={0}
          rx={35}
          ry={12}
          fill="none"
          stroke="rgba(100, 200, 255, 0.45)"
          strokeWidth={1.5}
        />
        <ellipse
          cx={0}
          cy={0}
          rx={55}
          ry={18}
          fill="none"
          stroke="rgba(100, 200, 255, 0.25)"
          strokeWidth={1.2}
        />

        <image
          href="/art/stops/harbormaster.png?v=harbormaster-v2"
          x={-60}
          y={-96}
          width={120}
          height={120}
          preserveAspectRatio="xMidYMid meet"
          style={{
            pointerEvents: "none",
            filter: harbormasterHovered
              ? "drop-shadow(0 0 12px rgba(230,198,106,0.65))"
              : "drop-shadow(0 4px 10px rgba(0,0,0,0.35))",
            transition: "filter 0.3s, transform 0.3s",
            transform: harbormasterHovered ? "scale(1.05)" : "scale(1)",
          }}
        />

        {/* Interaction hit box */}
        <rect
          x={-40}
          y={-85}
          width={80}
          height={100}
          fill="transparent"
          pointerEvents="all"
        />

        {/* Hover label */}
        {harbormasterHovered && (
          <g style={{ pointerEvents: "none" }}>
            <rect
              x={-100}
              y={-110}
              width={200}
              height={24}
              rx={5}
              fill="rgba(12,7,22,0.92)"
              stroke="rgba(230,198,106,0.35)"
              strokeWidth={1}
            />
            <text
              x={0}
              y={-93}
              textAnchor="middle"
              fontSize={13}
              fill="#e6c66a"
              fontFamily="var(--font-sans, sans-serif)"
            >
              Harbormaster&apos;s Recordkeeping
            </text>
          </g>
        )}
      </g>

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

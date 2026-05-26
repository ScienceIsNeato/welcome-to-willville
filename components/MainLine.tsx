"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { activeQueue, mostActiveStops, type Stop } from "@/lib/town";

type Props = {
  stops: Stop[];
  onEngineClick?: () => void;
  engineLabel?: string;
};

const GOLD = "#e6c66a";
const GOLD_DEEP = "#b8862c";
const TIE_SPACING = 18;
const TIE_WIDTH = 12;
const RAIL_GAUGE = 6;

function smoothLoopPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    const [a, b] = points;
    return `M ${a.x} ${a.y} L ${b.x} ${b.y} L ${a.x} ${a.y} Z`;
  }
  const n = points.length;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  d += " Z";
  return d;
}

function LocomotiveBody() {
  return (
    <>
      <rect
        x={-18}
        y={-12}
        width={30}
        height={18}
        rx={4}
        fill={GOLD}
        stroke={GOLD_DEEP}
        strokeWidth={1.5}
      />
      <rect
        x={-16}
        y={-12}
        width={26}
        height={4}
        rx={2}
        fill="#ffe9a0"
        opacity={0.6}
      />
      <rect x={10} y={-18} width={12} height={22} rx={2} fill={GOLD_DEEP} />
      <rect
        x={11}
        y={-16}
        width={10}
        height={8}
        rx={1}
        fill="#ffe9a0"
        opacity={0.7}
      />
      <polygon points="-18,-2 -26,4 -18,6" fill={GOLD_DEEP} opacity={0.9} />
    </>
  );
}

function LocomotiveWindows() {
  return (
    <>
      {[-14, -6, 2].map((x) => (
        <rect
          key={x}
          x={x}
          y={-8}
          width={5}
          height={5}
          rx={1}
          fill="#ffe9a0"
          opacity={0.85}
        />
      ))}
    </>
  );
}

function LocomotiveSmoke() {
  return (
    <>
      <rect x={-8} y={-20} width={6} height={8} rx={1} fill={GOLD_DEEP} />
      <ellipse cx={-5} cy={-20} rx={4.5} ry={2} fill={GOLD} />
      <circle cx={-5} cy={-26} r={3.5} fill="#fff" opacity={0.6}>
        <animate
          attributeName="cy"
          values="-26;-34"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.6;0"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="r"
          values="3.5;6"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx={-3} cy={-30} r={2.5} fill="#fff" opacity={0.4}>
        <animate
          attributeName="cy"
          values="-30;-40"
          dur="2.5s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.4;0"
          dur="2.5s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="r"
          values="2.5;5"
          dur="2.5s"
          repeatCount="indefinite"
        />
      </circle>
    </>
  );
}

function LocomotiveWheels() {
  return (
    <>
      <circle
        cx={-12}
        cy={8}
        r={5}
        fill="#1a1233"
        stroke={GOLD_DEEP}
        strokeWidth={1}
      />
      <circle
        cx={0}
        cy={8}
        r={5}
        fill="#1a1233"
        stroke={GOLD_DEEP}
        strokeWidth={1}
      />
      <circle
        cx={12}
        cy={8}
        r={4}
        fill="#1a1233"
        stroke={GOLD_DEEP}
        strokeWidth={1}
      />
      <line
        x1={-12}
        y1={4}
        x2={-12}
        y2={12}
        stroke={GOLD_DEEP}
        strokeWidth={0.8}
      />
      <line
        x1={-16}
        y1={8}
        x2={-8}
        y2={8}
        stroke={GOLD_DEEP}
        strokeWidth={0.8}
      />
      <line x1={0} y1={4} x2={0} y2={12} stroke={GOLD_DEEP} strokeWidth={0.8} />
      <line x1={-4} y1={8} x2={4} y2={8} stroke={GOLD_DEEP} strokeWidth={0.8} />
    </>
  );
}

function ExpressLocomotive({ scale = 1 }: { scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <LocomotiveBody />
      <LocomotiveWindows />
      <LocomotiveSmoke />
      <LocomotiveWheels />
      <circle
        cx={-22}
        cy={0}
        r={3}
        fill="#fff"
        opacity={0.7}
        className="train-glow"
      />
    </g>
  );
}

function ExpressCar({ scale = 1 }: { scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <rect
        x={-14}
        y={-9}
        width={28}
        height={14}
        rx={2}
        fill={GOLD_DEEP}
        stroke="#5a3f0f"
        strokeWidth={1}
      />
      {/* Roof accent */}
      <rect
        x={-12}
        y={-9}
        width={24}
        height={3}
        rx={1}
        fill={GOLD}
        opacity={0.4}
      />
      {/* Windows */}
      <rect
        x={-10}
        y={-5}
        width={4}
        height={4}
        rx={1}
        fill="#ffe9a0"
        opacity={0.8}
      />
      <rect
        x={-2}
        y={-5}
        width={4}
        height={4}
        rx={1}
        fill="#ffe9a0"
        opacity={0.8}
      />
      <rect
        x={6}
        y={-5}
        width={4}
        height={4}
        rx={1}
        fill="#ffe9a0"
        opacity={0.8}
      />
      {/* Wheels */}
      <circle
        cx={-8}
        cy={7}
        r={3.5}
        fill="#1a1233"
        stroke={GOLD_DEEP}
        strokeWidth={0.8}
      />
      <circle
        cx={8}
        cy={7}
        r={3.5}
        fill="#1a1233"
        stroke={GOLD_DEEP}
        strokeWidth={0.8}
      />
    </g>
  );
}

export function MainLine({
  stops,
  onEngineClick,
  engineLabel = "Activate the Mayor's Express",
}: Props) {
  const active = mostActiveStops(stops);
  const queue = active.length >= 2 ? active : activeQueue(stops);
  if (queue.length < 2) return null;
  const path = smoothLoopPath(queue.map((s) => s.position));
  const loopSeconds = Math.max(18, queue.length * 6);

  const handleEngineClick = (e: MouseEvent) => {
    e.stopPropagation();
    onEngineClick?.();
  };
  const handleEngineKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    onEngineClick?.();
  };

  return (
    <g id="willville-main-line" aria-label="The Mayor's Express">
      {/* === Railroad track === */}
      {/* Ballast / bed glow */}
      <path
        d={path}
        fill="none"
        stroke={GOLD}
        strokeOpacity={0.1}
        strokeWidth={22}
        strokeLinecap="round"
        style={{ pointerEvents: "none" }}
      />
      {/* Crossties — dashed perpendicular sleepers */}
      <path
        d={path}
        fill="none"
        stroke={GOLD_DEEP}
        strokeOpacity={0.55}
        strokeWidth={TIE_WIDTH}
        strokeDasharray={`3 ${TIE_SPACING - 3}`}
        strokeLinecap="butt"
        style={{ pointerEvents: "none" }}
      />
      {/* Left rail */}
      <path
        d={path}
        fill="none"
        stroke={GOLD}
        strokeOpacity={0.9}
        strokeWidth={2}
        strokeLinecap="round"
        style={{ pointerEvents: "none" }}
        transform={`translate(0, -${RAIL_GAUGE / 2})`}
      />
      {/* Right rail */}
      <path
        d={path}
        fill="none"
        stroke={GOLD}
        strokeOpacity={0.9}
        strokeWidth={2}
        strokeLinecap="round"
        style={{ pointerEvents: "none" }}
        transform={`translate(0, ${RAIL_GAUGE / 2})`}
      />

      {/* Numbered queue badges */}
      {queue.map((stop, i) => (
        <g
          key={`badge-${stop.id}`}
          transform={`translate(${stop.position.x + 16}, ${stop.position.y - 18})`}
          style={{ pointerEvents: "none" }}
        >
          <circle
            r={11}
            fill={i === 0 ? GOLD : GOLD_DEEP}
            stroke="#1a1233"
            strokeWidth={2}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fontWeight={800}
            fill="#1a1233"
          >
            {i + 1}
          </text>
          {i === 0 && (
            <circle
              r={16}
              fill="none"
              stroke={GOLD}
              strokeOpacity={0.6}
              className="whistle"
            />
          )}
        </g>
      ))}

      {/* === Express train === */}
      {/* Locomotive — clickable */}
      <g
        aria-label={engineLabel}
        role="button"
        tabIndex={0}
        style={{ cursor: "pointer", pointerEvents: "all" }}
        onClick={handleEngineClick}
        onKeyDown={handleEngineKeyDown}
      >
        <ExpressLocomotive scale={1.2} />
        <animateMotion
          dur={`${loopSeconds}s`}
          repeatCount="indefinite"
          rotate="auto"
          path={path}
        />
      </g>
      {/* Car 1 */}
      <g style={{ pointerEvents: "none" }}>
        <ExpressCar scale={1.1} />
        <animateMotion
          dur={`${loopSeconds}s`}
          repeatCount="indefinite"
          rotate="auto"
          path={path}
          begin={`${(-loopSeconds * 0.02).toFixed(2)}s`}
        />
      </g>
      {/* Car 2 */}
      <g style={{ pointerEvents: "none" }}>
        <ExpressCar scale={1.0} />
        <animateMotion
          dur={`${loopSeconds}s`}
          repeatCount="indefinite"
          rotate="auto"
          path={path}
          begin={`${(-loopSeconds * 0.04).toFixed(2)}s`}
        />
      </g>
    </g>
  );
}

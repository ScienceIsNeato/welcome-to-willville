"use client";

import { activeQueue, type Stop } from "@/lib/town";

/**
 * The Mayor's Express. A featured gilded train that visits only the active
 * queue stops (those with queue.active === true), in order of eta_days.
 *
 * The path is recomputed every render so changes to .willville.json show up
 * immediately when /api/town refreshes.
 */
type Props = {
  stops: Stop[];
};

const GOLD = "#e6c66a";
const GOLD_DEEP = "#b8862c";

function smoothLoopPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return "";
  if (points.length === 2) {
    const [a, b] = points;
    return `M ${a.x} ${a.y} L ${b.x} ${b.y} L ${a.x} ${a.y} Z`;
  }
  // Catmull-Rom-style smoothing into cubic beziers, closed loop.
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

function ExpressLocomotive({ scale = 1 }: { scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <rect
        x={-20}
        y={-10}
        width={32}
        height={16}
        rx={3}
        fill={GOLD}
        stroke={GOLD_DEEP}
        strokeWidth={1.5}
      />
      <rect x={10} y={-18} width={10} height={16} rx={1.5} fill={GOLD_DEEP} />
      <rect x={-16} y={-6} width={6} height={6} fill="#ffe9a0" opacity={0.9} />
      <rect x={-6} y={-6} width={6} height={6} fill="#ffe9a0" opacity={0.9} />
      <rect x={4} y={-6} width={6} height={6} fill="#ffe9a0" opacity={0.9} />
      <circle cx={-12} cy={8} r={4} fill="#1a1233" />
      <circle cx={-2} cy={8} r={4} fill="#1a1233" />
      <circle cx={8} cy={8} r={4} fill="#1a1233" />
      <circle cx={18} cy={-22} r={3} fill="#fff" opacity={0.8} />
      <circle cx={20} cy={-28} r={2} fill="#fff" opacity={0.5} />
      <circle
        cx={-20}
        cy={0}
        r={2.5}
        fill="#fff"
        opacity={0.7}
        className="train-glow"
        style={{ color: GOLD }}
      />
    </g>
  );
}

function ExpressCar({
  scale = 1,
  offset = -36,
}: {
  scale?: number;
  offset?: number;
}) {
  return (
    <g transform={`translate(${offset}, 0) scale(${scale})`}>
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
      <rect x={-10} y={-6} width={4} height={4} fill="#ffe9a0" opacity={0.8} />
      <rect x={-2} y={-6} width={4} height={4} fill="#ffe9a0" opacity={0.8} />
      <rect x={6} y={-6} width={4} height={4} fill="#ffe9a0" opacity={0.8} />
      <circle cx={-8} cy={7} r={3} fill="#1a1233" />
      <circle cx={8} cy={7} r={3} fill="#1a1233" />
    </g>
  );
}

export function MainLine({ stops }: Props) {
  const queue = activeQueue(stops);
  if (queue.length < 2) return null;
  const path = smoothLoopPath(queue.map((s) => s.position));
  const loopSeconds = Math.max(18, queue.length * 6);

  return (
    <g id="willville-main-line" aria-label="The Mayor's Express">
      {/* rail glow */}
      <path
        d={path}
        fill="none"
        stroke={GOLD}
        strokeOpacity={0.18}
        strokeWidth={20}
        strokeLinecap="round"
      />
      {/* rail */}
      <path
        d={path}
        fill="none"
        stroke={GOLD}
        strokeOpacity={0.95}
        strokeWidth={4}
        strokeLinecap="round"
      />
      {/* dotted accent */}
      <path
        d={path}
        fill="none"
        stroke={GOLD_DEEP}
        strokeOpacity={0.6}
        strokeWidth={2}
        strokeDasharray="6 6"
        strokeLinecap="round"
      />

      {/* numbered queue badges */}
      {queue.map((stop, i) => (
        <g
          key={`badge-${stop.id}`}
          transform={`translate(${stop.position.x + 16}, ${stop.position.y - 18})`}
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

      {/* express train (locomotive + 2 cars staggered) */}
      <g>
        <ExpressLocomotive scale={1.2} />
        <animateMotion
          dur={`${loopSeconds}s`}
          repeatCount="indefinite"
          rotate="auto"
          path={path}
        />
      </g>
      <g>
        <ExpressCar offset={0} scale={1.1} />
        <animateMotion
          dur={`${loopSeconds}s`}
          repeatCount="indefinite"
          rotate="auto"
          path={path}
          begin={`${(-loopSeconds * 0.02).toFixed(2)}s`}
        />
      </g>
      <g>
        <ExpressCar offset={0} scale={1.0} />
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

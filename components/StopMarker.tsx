"use client";

import { useRouter } from "next/navigation";
import type { Stop } from "@/lib/town";

type Props = {
  stop: Stop;
  isFocused: boolean;
  recentlyUpdated: boolean;
};

const STATE_COLOR: Record<Stop["status"]["state"], string> = {
  idea: "#9bb5ff",
  wip: "#ffd166",
  shipping: "#7bd389",
  maintenance: "#b6b6b6",
  dormant: "#5a5a5a",
  unknown: "#cccccc",
};

export function StopMarker({ stop, isFocused, recentlyUpdated }: Props) {
  const router = useRouter();
  const color = STATE_COLOR[stop.status.state];
  return (
    <g
      transform={`translate(${stop.position.x}, ${stop.position.y})`}
      style={{ cursor: "pointer" }}
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/${stop.district}/${stop.id}/`);
      }}
      aria-label={stop.displayName}
    >
      {recentlyUpdated && (
        <circle r={18} fill={color} fillOpacity={0.25} className="whistle" />
      )}
      <circle
        r={isFocused ? 12 : 9}
        fill={color}
        stroke="#1a1233"
        strokeWidth={2}
      />
      {stop.isPrivate && (
        <circle
          r={4}
          cx={6}
          cy={-6}
          fill="#f5e6c8"
          stroke="#1a1233"
          strokeWidth={1}
        />
      )}
      <text
        y={-18}
        textAnchor="middle"
        fontSize={12}
        fill="var(--willville-paper)"
        style={{
          pointerEvents: "none",
          textShadow: "0 1px 4px rgba(0,0,0,0.7)",
        }}
      >
        {stop.displayName}
      </text>
    </g>
  );
}

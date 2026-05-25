"use client";

import type { MouseEvent } from "react";
import type { Stop } from "@/lib/town";
import siteSpriteManifest from "@/data/town-site-sprites.v1.json";
import {
  labelHitBoxForStop,
  repoLabelForStop,
  spriteSizeForStop,
} from "@/lib/stop-marker-hitbox";

type Props = {
  stop: Stop;
  isFocused: boolean;
  recentlyUpdated: boolean;
  onClick: (e: MouseEvent<SVGGElement>) => void;
  onDoubleClick: (e: MouseEvent<SVGGElement>) => void;
};

const STATE_COLOR: Record<Stop["status"]["state"], string> = {
  idea: "#9bb5ff",
  wip: "#ffd166",
  shipping: "#7bd389",
  maintenance: "#b6b6b6",
  dormant: "#5a5a5a",
  unknown: "#cccccc",
};

const SITE_SPRITES = new Map(
  siteSpriteManifest.sprites.map((sprite) => [sprite.stopId, sprite]),
);
const SPRITE_CACHE_VERSION = "repo-labels-20260522";

export function StopMarker({
  stop,
  isFocused,
  recentlyUpdated,
  onClick,
  onDoubleClick,
}: Props) {
  const color = STATE_COLOR[stop.status.state];
  const sprite = SITE_SPRITES.get(stop.id);
  const { width: spriteWidth, height: spriteHeight } = spriteSizeForStop(stop);
  const label = repoLabelForStop(stop);
  const labelHitBox = labelHitBoxForStop(stop);
  return (
    <g
      data-stop-marker
      data-stop-id={stop.id}
      data-district-id={stop.district}
      transform={`translate(${stop.position.x}, ${stop.position.y})`}
      style={{ cursor: "pointer" }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(e);
      }}
      aria-label={label}
    >
      <rect
        x={labelHitBox.x}
        y={labelHitBox.y}
        width={labelHitBox.width}
        height={labelHitBox.height}
        fill="transparent"
        pointerEvents="all"
      />
      {recentlyUpdated && (
        <circle r={18} fill={color} fillOpacity={0.25} className="whistle" />
      )}
      {sprite && (
        <image
          href={`${sprite.src}?v=${SPRITE_CACHE_VERSION}`}
          x={-spriteWidth / 2}
          y={-spriteHeight + 10}
          width={spriteWidth}
          height={spriteHeight}
          preserveAspectRatio="xMidYMid meet"
          style={{ pointerEvents: "all" }}
        />
      )}
      <circle
        r={isFocused ? 8 : 6}
        cx={sprite ? 22 : 0}
        cy={sprite ? 12 : 0}
        fill={color}
        stroke="#1a1233"
        strokeWidth={2}
      />
      <text
        y={sprite ? -52 : -18}
        textAnchor="middle"
        fontSize={14}
        fontWeight={700}
        fill="var(--willville-paper)"
        style={{
          pointerEvents: "none",
          textShadow: "0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.65)",
        }}
      >
        {label}
      </text>
    </g>
  );
}

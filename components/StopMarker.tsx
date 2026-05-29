"use client";

import { memo, type MouseEvent, type PointerEvent } from "react";
import type { Stop } from "@/lib/town";
import siteSpriteManifest from "@/data/town-site-sprites.v1.json";
import {
  labelHitBoxForStop,
  repoLabelForStop,
  spriteSizeForStop,
} from "@/lib/stop-marker-hitbox";
import { siteForegroundModeForStop } from "@/lib/siteAppearance";

type Props = {
  stop: Stop;
  isFocused: boolean;
  recentlyUpdated: boolean;
  onClick: (stop: Stop, e: MouseEvent<SVGGElement>) => void;
  onDoubleClick: (stop: Stop, e: MouseEvent<SVGGElement>) => void;
  draggable?: boolean;
  onDragStart?: (stop: Stop, e: PointerEvent<SVGGElement>) => void;
  onDragMove?: (stop: Stop, e: PointerEvent<SVGGElement>) => void;
  onDragEnd?: (stop: Stop, e: PointerEvent<SVGGElement>) => void;
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
const SITE_ART_CENTER = { x: 0, y: 0 };

function RecentUpdatePulse({ color }: { color: string }) {
  return (
    <circle
      r={18}
      cx={SITE_ART_CENTER.x}
      cy={SITE_ART_CENTER.y}
      fill={color}
      fillOpacity={0.25}
      className="whistle"
    />
  );
}

function RepositionPulse({ spriteWidth }: { spriteWidth: number }) {
  return (
    <circle
      r={Math.max(22, spriteWidth / 2 + 4)}
      cx={SITE_ART_CENTER.x}
      cy={SITE_ART_CENTER.y}
      fill="none"
      stroke="#e6c66a"
      strokeWidth={1.5}
      strokeDasharray="4 3"
      className="reposition-pulse"
      style={{
        transformOrigin: `${SITE_ART_CENTER.x}px ${SITE_ART_CENTER.y}px`,
      }}
    />
  );
}

function FocusRings() {
  return (
    <g>
      <circle
        r={22}
        cx={SITE_ART_CENTER.x}
        cy={SITE_ART_CENTER.y}
        fill="none"
        stroke="#33ff57"
        strokeWidth={2.5}
        strokeDasharray="8 6"
        strokeLinecap="round"
        opacity={0.85}
      />
      <circle
        r={30}
        cx={SITE_ART_CENTER.x}
        cy={SITE_ART_CENTER.y}
        fill="none"
        stroke="#33ff57"
        strokeWidth={1.5}
        strokeDasharray="4 10"
        strokeLinecap="round"
        className="stop-focus-ring-pulse"
        style={{
          transformOrigin: `${SITE_ART_CENTER.x}px ${SITE_ART_CENTER.y}px`,
        }}
      />
    </g>
  );
}

function StopLabel({
  label,
  spriteHeight,
}: {
  label: string;
  spriteHeight: number;
}) {
  return (
    <text
      y={spriteHeight > 0 ? -spriteHeight / 2 - 8 : -18}
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
  );
}

function StopMarkerInner({
  stop,
  isFocused,
  recentlyUpdated,
  onClick,
  onDoubleClick,
  draggable,
  onDragStart,
  onDragMove,
  onDragEnd,
}: Props) {
  const color = STATE_COLOR[stop.status.state];
  const sprite = SITE_SPRITES.get(stop.id);
  const foregroundMode = siteForegroundModeForStop(stop.id);
  const showSprite = Boolean(sprite) && foregroundMode !== "background-only";
  const { width: spriteWidth, height: spriteHeight } = spriteSizeForStop(stop);
  const label = repoLabelForStop(stop);
  const labelHitBox = labelHitBoxForStop(stop);
  return (
    <g
      data-stop-marker
      data-stop-id={stop.id}
      data-district-id={stop.district}
      data-no-pan={draggable ? "true" : undefined}
      transform={`translate(${stop.position.x}, ${stop.position.y})`}
      style={{ cursor: draggable ? "move" : "pointer" }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(stop, e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(stop, e);
      }}
      onPointerDown={(e) => {
        if (!draggable) return;
        e.stopPropagation();
        onDragStart?.(stop, e);
      }}
      onPointerMove={(e) => {
        if (!draggable) return;
        e.stopPropagation();
        onDragMove?.(stop, e);
      }}
      onPointerUp={(e) => {
        if (!draggable) return;
        e.stopPropagation();
        onDragEnd?.(stop, e);
      }}
      onPointerCancel={(e) => {
        if (!draggable) return;
        e.stopPropagation();
        onDragEnd?.(stop, e);
      }}
      onLostPointerCapture={(e) => {
        if (!draggable) return;
        e.stopPropagation();
        onDragEnd?.(stop, e);
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
      {recentlyUpdated && !isFocused && <RecentUpdatePulse color={color} />}
      {draggable && <RepositionPulse spriteWidth={spriteWidth} />}
      {showSprite && sprite && (
        <image
          href={`${sprite.src}?v=${SPRITE_CACHE_VERSION}`}
          x={SITE_ART_CENTER.x - spriteWidth / 2}
          y={SITE_ART_CENTER.y - spriteHeight / 2}
          width={spriteWidth}
          height={spriteHeight}
          preserveAspectRatio="xMidYMid meet"
          style={{ pointerEvents: "all" }}
        />
      )}
      {isFocused ? (
        <FocusRings />
      ) : !showSprite ? (
        <circle
          r={6}
          cx={SITE_ART_CENTER.x}
          cy={SITE_ART_CENTER.y}
          fill={color}
          stroke="#1a1233"
          strokeWidth={2}
        />
      ) : null}
      <StopLabel label={label} spriteHeight={showSprite ? spriteHeight : 0} />
    </g>
  );
}

export const StopMarker = memo(StopMarkerInner);

"use client";

import { memo, type MouseEvent, type PointerEvent } from "react";
import type { Stop } from "@/lib/town";
import siteSpriteManifest from "@/data/town-site-sprites.v1.json";
import { glyphHaloCropBoxForSprite } from "@/lib/glyphHalo";
import {
  labelHitBoxForStop,
  repoLabelForStop,
  spriteSizeForStop,
} from "@/lib/stop-marker-hitbox";
import {
  siteForegroundModeForStop,
  siteUnderlayForStop,
} from "@/lib/siteAppearance";

type Props = {
  stop: Stop;
  isFocused: boolean;
  recentlyUpdated: boolean;
  onClick: (stop: Stop, e: MouseEvent<SVGGElement>) => void;
  onDoubleClick: (stop: Stop, e: MouseEvent<SVGGElement>) => void;
  forceHideSprite?: boolean;
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
type SiteSprite = (typeof siteSpriteManifest.sprites)[number];
const SPRITE_CACHE_VERSION = "repo-labels-20260522";
const SITE_ART_CENTER = { x: 0, y: 0 };
const LABEL_VERTICAL_GAP = 22;
const LABEL_FALLBACK_Y = -30;

type HitBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function mergeHitBoxes(...boxes: Array<HitBox | null>): HitBox {
  const definedBoxes = boxes.filter((box): box is HitBox => box !== null);
  const left = Math.min(...definedBoxes.map((box) => box.x));
  const top = Math.min(...definedBoxes.map((box) => box.y));
  const right = Math.max(...definedBoxes.map((box) => box.x + box.width));
  const bottom = Math.max(...definedBoxes.map((box) => box.y + box.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function spriteHitBoxForSize(
  spriteWidth: number,
  spriteHeight: number,
): HitBox | null {
  if (spriteWidth <= 0 || spriteHeight <= 0) {
    return null;
  }

  return {
    x: SITE_ART_CENTER.x - spriteWidth / 2,
    y: SITE_ART_CENTER.y - spriteHeight / 2,
    width: spriteWidth,
    height: spriteHeight,
  };
}

function replacementHitBoxForStop(
  stop: Stop,
  sprite: SiteSprite | undefined,
  hasReplacementAppearance: boolean,
): HitBox | null {
  if (!hasReplacementAppearance || !sprite) {
    return null;
  }

  const crop = glyphHaloCropBoxForSprite(sprite, stop.position);
  return {
    x: crop.x - stop.position.x,
    y: crop.y - stop.position.y,
    width: crop.width,
    height: crop.height,
  };
}

function interactionHitBoxForStop(params: {
  stop: Stop;
  sprite: SiteSprite | undefined;
  spriteWidth: number;
  spriteHeight: number;
  labelHitBox: HitBox;
  showSprite: boolean;
  hasReplacementAppearance: boolean;
}): HitBox {
  const {
    stop,
    sprite,
    spriteWidth,
    spriteHeight,
    labelHitBox,
    showSprite,
    hasReplacementAppearance,
  } = params;

  return mergeHitBoxes(
    labelHitBox,
    showSprite ? spriteHitBoxForSize(spriteWidth, spriteHeight) : null,
    replacementHitBoxForStop(stop, sprite, hasReplacementAppearance),
  );
}

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
      y={
        spriteHeight > 0
          ? -spriteHeight / 2 - LABEL_VERTICAL_GAP
          : LABEL_FALLBACK_Y
      }
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

function SpriteArt({
  src,
  spriteWidth,
  spriteHeight,
}: {
  src: string;
  spriteWidth: number;
  spriteHeight: number;
}) {
  return (
    <image
      href={`${src}?v=${SPRITE_CACHE_VERSION}`}
      x={SITE_ART_CENTER.x - spriteWidth / 2}
      y={SITE_ART_CENTER.y - spriteHeight / 2}
      width={spriteWidth}
      height={spriteHeight}
      preserveAspectRatio="xMidYMid meet"
      style={{ pointerEvents: "all" }}
    />
  );
}

function FallbackMarkerDot({ color }: { color: string }) {
  return (
    <circle
      r={6}
      cx={SITE_ART_CENTER.x}
      cy={SITE_ART_CENTER.y}
      fill={color}
      stroke="#1a1233"
      strokeWidth={2}
    />
  );
}

function StopMarkerInner({
  stop,
  isFocused,
  recentlyUpdated,
  onClick,
  onDoubleClick,
  forceHideSprite = false,
  draggable,
  onDragStart,
  onDragMove,
  onDragEnd,
}: Props) {
  const color = STATE_COLOR[stop.status.state];
  const sprite = SITE_SPRITES.get(stop.id);
  const foregroundMode = siteForegroundModeForStop(stop.id);
  const underlay = siteUnderlayForStop(stop.id);
  const hasReplacementAppearance =
    forceHideSprite ||
    (foregroundMode === "background-only" && underlay.enabled);
  const showSprite =
    Boolean(sprite) && foregroundMode !== "background-only" && !forceHideSprite;
  const { width: spriteWidth, height: spriteHeight } = spriteSizeForStop(stop);
  const label = repoLabelForStop(stop);
  const labelHitBox = labelHitBoxForStop(stop);
  const interactionHitBox = interactionHitBoxForStop({
    stop,
    sprite,
    spriteWidth,
    spriteHeight,
    labelHitBox,
    showSprite,
    hasReplacementAppearance,
  });
  const handleDragEnd = (e: PointerEvent<SVGGElement>) => {
    const isDragActive =
      draggable || e.currentTarget.hasPointerCapture(e.pointerId);
    if (!isDragActive) return;
    e.stopPropagation();
    onDragEnd?.(stop, e);
  };
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
      onPointerUp={handleDragEnd}
      onPointerCancel={handleDragEnd}
      onLostPointerCapture={handleDragEnd}
      aria-label={label}
    >
      <rect
        x={interactionHitBox.x}
        y={interactionHitBox.y}
        width={interactionHitBox.width}
        height={interactionHitBox.height}
        fill="transparent"
        pointerEvents="all"
      />
      {recentlyUpdated && !isFocused && <RecentUpdatePulse color={color} />}
      {draggable && <RepositionPulse spriteWidth={spriteWidth} />}
      {showSprite && sprite && (
        <SpriteArt
          src={sprite.src}
          spriteWidth={spriteWidth}
          spriteHeight={spriteHeight}
        />
      )}
      {isFocused ? (
        <FocusRings />
      ) : !showSprite && !hasReplacementAppearance ? (
        <FallbackMarkerDot color={color} />
      ) : null}
      <StopLabel label={label} spriteHeight={showSprite ? spriteHeight : 0} />
    </g>
  );
}

export const StopMarker = memo(StopMarkerInner);

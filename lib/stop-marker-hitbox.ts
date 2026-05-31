import siteSpriteManifest from "@/data/town-site-sprites.v1.json";
import type { Stop } from "@/lib/town";

const SPRITE_SCALE = 0.68;
const LABEL_VERTICAL_GAP = 22;
const LABEL_FALLBACK_Y = -30;

const SITE_SPRITES = new Map(
  siteSpriteManifest.sprites.map((sprite) => [sprite.stopId, sprite]),
);

export function repoLabelForStop(stop: Stop): string {
  return stop.repo?.split("/").pop() ?? stop.repo ?? stop.id;
}

export function spriteSizeForStop(stop: Stop): {
  width: number;
  height: number;
} {
  const sprite = SITE_SPRITES.get(stop.id);
  return {
    width: sprite ? Math.round(sprite.width * SPRITE_SCALE) : 0,
    height: sprite ? Math.round(sprite.height * SPRITE_SCALE) : 0,
  };
}

type HitBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function labelHitBoxForStop(stop: Stop): HitBox {
  const sprite = SITE_SPRITES.get(stop.id);
  const label = repoLabelForStop(stop);
  const { height } = spriteSizeForStop(stop);
  const labelY = sprite ? -height / 2 - LABEL_VERTICAL_GAP : LABEL_FALLBACK_Y;
  const hitWidth = Math.max(72, label.length * 8 + 20);
  return {
    x: -hitWidth / 2,
    y: labelY - 14,
    width: hitWidth,
    height: 24,
  };
}

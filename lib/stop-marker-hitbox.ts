import siteSpriteManifest from "@/data/town-site-sprites.v1.json";
import type { Stop } from "@/lib/town";

const SPRITE_SCALE = 0.68;

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

export function hitBoxForStop(stop: Stop): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const sprite = SITE_SPRITES.get(stop.id);
  const { width: spriteWidth, height: spriteHeight } = spriteSizeForStop(stop);
  const label = repoLabelForStop(stop);
  const hitWidth = Math.max(72, spriteWidth + 24, label.length * 8 + 20);
  const hitTop = sprite ? -spriteHeight - 64 : -36;
  const hitBottom = sprite ? 28 : 36;
  return {
    x: -hitWidth / 2,
    y: hitTop,
    width: hitWidth,
    height: hitBottom - hitTop,
  };
}

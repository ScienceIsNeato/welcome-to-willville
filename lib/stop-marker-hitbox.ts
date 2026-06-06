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

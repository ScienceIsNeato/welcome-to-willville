"use client";

import siteSpriteManifest from "@/data/town-site-sprites.v1.json";
import {
  glyphHaloAssetPath,
  glyphHaloCacheKeyForSprite,
  glyphHaloConfigForSprite,
  glyphHaloCropBoxForSprite,
} from "@/lib/glyphHalo";
import type { Stop } from "@/lib/town";

type Props = {
  stops: Stop[];
};

const HALO_SPRITES = new Map(
  siteSpriteManifest.sprites.map((sprite) => [sprite.stopId, sprite]),
);

export function TownGlyphHalos({ stops }: Props) {
  return (
    <g aria-hidden="true" pointerEvents="none">
      {stops.map((stop) => {
        const sprite = HALO_SPRITES.get(stop.id);
        if (!sprite || !glyphHaloConfigForSprite(sprite)) return null;

        const crop = glyphHaloCropBoxForSprite(sprite, stop.position);
        return (
          <image
            key={`glyph-halo-${stop.id}`}
            href={`${glyphHaloAssetPath(stop.id)}?v=${glyphHaloCacheKeyForSprite(sprite)}`}
            x={crop.x}
            y={crop.y}
            width={crop.width}
            height={crop.height}
            preserveAspectRatio="none"
            style={{ pointerEvents: "none" }}
          />
        );
      })}
    </g>
  );
}

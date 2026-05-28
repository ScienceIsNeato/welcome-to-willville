"use client";

import siteSpriteManifest from "@/data/town-site-sprites.v1.json";
import { glyphHaloCropBoxForSprite } from "@/lib/glyphHalo";
import {
  siteAppearanceManifestVersion,
  siteUnderlayForStop,
} from "@/lib/siteAppearance";
import type { Stop } from "@/lib/town";

type Props = {
  stops: Stop[];
};

const SITE_SPRITES = new Map(
  siteSpriteManifest.sprites.map((sprite) => [sprite.stopId, sprite]),
);

export function TownSiteAppearances({ stops }: Props) {
  const version = siteAppearanceManifestVersion();

  return (
    <g aria-hidden="true" pointerEvents="none">
      {stops.map((stop) => {
        const underlay = siteUnderlayForStop(stop.id);
        if (!underlay.enabled || !underlay.src) {
          return null;
        }

        const sprite = SITE_SPRITES.get(stop.id);
        if (!sprite) {
          return null;
        }

        const crop = glyphHaloCropBoxForSprite(sprite, stop.position);
        return (
          <image
            key={`site-appearance-${stop.id}`}
            href={`${underlay.src}?v=${underlay.cacheKey ?? version}`}
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

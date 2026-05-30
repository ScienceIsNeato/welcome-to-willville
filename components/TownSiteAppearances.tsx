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
  previewUnderlayHrefs?: Record<string, string>;
};

const SITE_SPRITES = new Map(
  siteSpriteManifest.sprites.map((sprite) => [sprite.stopId, sprite]),
);

export function TownSiteAppearances({
  stops,
  previewUnderlayHrefs = {},
}: Props) {
  const version = siteAppearanceManifestVersion();

  return (
    <g aria-hidden="true" pointerEvents="none">
      {stops.map((stop) => {
        const previewHref = previewUnderlayHrefs[stop.id];
        const underlay = siteUnderlayForStop(stop.id);
        if (!previewHref && (!underlay.enabled || !underlay.src)) {
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
            href={
              previewHref ?? `${underlay.src}?v=${underlay.cacheKey ?? version}`
            }
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

import { WORLD } from "@/lib/willville";

export const WATER_TILE_ART = "/art/town/willville-v3-water-tile.png";
export const WORLD_BACKDROP_ART = "/art/town/willville-world-v1.png";

export const WATER_TILE = {
  width: 520,
  height: 290,
} as const;

export const WATER_TILE_BACKGROUND_SIZE = `${WATER_TILE.width}px ${WATER_TILE.height}px`;

/**
 * World backdrop generated from the same town contract as the district masks:
 * sea on both sides, a continuous north/south isthmus, and the town/canal
 * geometry ghosted underneath the live interactive layers.
 */
export function BucolicMargin() {
  return (
    <g aria-hidden>
      <defs>
        <radialGradient id="town-world-vignette" cx="50%" cy="47%" r="73%">
          <stop offset="56%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#080515" stopOpacity="0.32" />
        </radialGradient>
      </defs>

      <image
        href={WORLD_BACKDROP_ART}
        width={WORLD.width}
        height={WORLD.height}
        preserveAspectRatio="none"
      />
      <rect
        width={WORLD.width}
        height={WORLD.height}
        fill="url(#town-world-vignette)"
        pointerEvents="none"
      />
    </g>
  );
}

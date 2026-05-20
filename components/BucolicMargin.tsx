import { WORLD } from "@/lib/willville";

export const WATER_TILE_ART = "/art/town/willville-v3-water-tile.png";

const WATER_TILE = {
  width: 520,
  height: 290,
} as const;

/**
 * World backdrop derived from the town painting itself. The water tile is
 * generated from the harbor/ocean art and blended as a seamless texture, so
 * panning reveals more of the same painted world without duplicating districts.
 */
export function BucolicMargin() {
  return (
    <g aria-hidden>
      <defs>
        <pattern
          id="town-water"
          patternUnits="userSpaceOnUse"
          width={WATER_TILE.width}
          height={WATER_TILE.height}
          x={-80}
          y={-120}
        >
          <image
            href={WATER_TILE_ART}
            x={0}
            y={0}
            width={WATER_TILE.width}
            height={WATER_TILE.height}
            preserveAspectRatio="none"
            opacity={0.68}
          />
        </pattern>
        <radialGradient id="town-world-vignette" cx="50%" cy="47%" r="73%">
          <stop offset="56%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#080515" stopOpacity="0.32" />
        </radialGradient>
      </defs>

      <rect width={WORLD.width} height={WORLD.height} fill="#073a5a" />
      <rect width={WORLD.width} height={WORLD.height} fill="url(#town-water)" />
      <rect
        width={WORLD.width}
        height={WORLD.height}
        fill="url(#town-world-vignette)"
        pointerEvents="none"
      />
    </g>
  );
}

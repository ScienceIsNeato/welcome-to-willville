import { GENERATED_TOWN_LAYOUT } from "@/lib/town-layout";
import { TOWN_OFFSET, WORLD } from "@/lib/willville";

export const LAND_TEXTURE_ART = "/art/town/willville-land-v1.png";

function translatePath(pathD: string, dx: number, dy: number): string {
  return pathD.replace(
    /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g,
    (_match, x, y) => `${Number(x) + dx} ${Number(y) + dy}`,
  );
}

const WORLD_LAND_PATH = translatePath(
  GENERATED_TOWN_LAYOUT.landPath,
  TOWN_OFFSET.x,
  TOWN_OFFSET.y,
);

/**
 * Simple world substrate: water everywhere, one land texture clipped to the
 * single land mask. Town and canal details are rendered by their own layers.
 */
export function BucolicMargin() {
  return (
    <g aria-hidden>
      <defs>
        <linearGradient id="willville-simple-water" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0a5279" />
          <stop offset="52%" stopColor="#063c64" />
          <stop offset="100%" stopColor="#03253f" />
        </linearGradient>
        <pattern
          id="willville-water-ripples"
          patternUnits="userSpaceOnUse"
          width={220}
          height={160}
          patternTransform="rotate(-8)"
        >
          <path
            d="M -40 48 C 20 18, 76 18, 132 48 S 245 78, 286 46"
            fill="none"
            stroke="#7fc6d3"
            strokeWidth={4}
            opacity={0.12}
          />
          <path
            d="M -28 116 C 35 86, 92 86, 154 116 S 260 144, 304 110"
            fill="none"
            stroke="#e3f6e9"
            strokeWidth={2}
            opacity={0.08}
          />
        </pattern>
        <clipPath id="willville-world-land-mask">
          <path d={WORLD_LAND_PATH} />
        </clipPath>
        <radialGradient id="town-world-vignette" cx="50%" cy="47%" r="73%">
          <stop offset="56%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#080515" stopOpacity="0.32" />
        </radialGradient>
      </defs>

      <rect
        width={WORLD.width}
        height={WORLD.height}
        fill="url(#willville-simple-water)"
      />
      <rect
        width={WORLD.width}
        height={WORLD.height}
        fill="url(#willville-water-ripples)"
      />
      <image
        href={LAND_TEXTURE_ART}
        width={WORLD.width}
        height={WORLD.height}
        preserveAspectRatio="none"
        clipPath="url(#willville-world-land-mask)"
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

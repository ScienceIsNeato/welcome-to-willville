import {
  CANAL_SECTION,
  GENERATED_TOWN_LAYOUT,
  pointsToPath,
} from "@/lib/town-layout";
import { TOWN_OFFSET, WORLD } from "@/lib/willville";

const LANDSCAPE_ART =
  "/art/town/willville-landscape-v1.webp?v=landscape-webp-20260602";
const LANDSCAPE_ART_MOBILE =
  "/art/town/willville-landscape-v1.mobile.webp?v=landscape-webp-20260602";
const WATER_TILE = "/art/town/willville-water-tile-v1.png?v=ocean-256-20260526";

export function WorldSubstrate({
  fullResArt = false,
}: {
  fullResArt?: boolean;
}) {
  const canalCutout = pointsToPath(CANAL_SECTION.polygon);
  // Mobile-first: default to the light landscape; confirmed desktops upgrade.
  const landscapeArt = fullResArt ? LANDSCAPE_ART : LANDSCAPE_ART_MOBILE;

  return (
    <g aria-hidden>
      <defs>
        <pattern
          id="willville-water-tile"
          patternUnits="userSpaceOnUse"
          width={256}
          height={256}
        >
          <image
            href={WATER_TILE}
            width={256}
            height={256}
            preserveAspectRatio="none"
          />
        </pattern>
        <clipPath id="willville-world-land-mask" clipPathUnits="userSpaceOnUse">
          <path
            d={`${GENERATED_TOWN_LAYOUT.landPath} ${canalCutout}`}
            clipRule="evenodd"
            transform={`translate(${TOWN_OFFSET.x} ${TOWN_OFFSET.y})`}
          />
        </clipPath>
        <radialGradient
          id="town-world-vignette"
          cx={WORLD.width / 2}
          cy={WORLD.height / 2}
          r={WORLD.width * 0.73}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#000000" stopOpacity="0" />
          <stop offset="40%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#080515" stopOpacity="0.32" />
        </radialGradient>
      </defs>

      <rect
        x={-500000}
        y={-500000}
        width={1000000}
        height={1000000}
        fill="url(#willville-water-tile)"
      />
      {/* Flat land-green base under the art (clipped to land). When the heavy
          land/district rasters blank for a frame during a zoom repaint, this
          shows through instead of the blue water — a subtle green that blends
          with the map rather than a jarring full-screen blue flash. */}
      <rect
        x={0}
        y={0}
        width={WORLD.width}
        height={WORLD.height}
        fill="#4c8029"
        clipPath="url(#willville-world-land-mask)"
      />
      <image
        href={landscapeArt}
        x={0}
        y={0}
        width={WORLD.width}
        height={WORLD.height}
        preserveAspectRatio="none"
        clipPath="url(#willville-world-land-mask)"
      />
      <rect
        x={-500000}
        y={-500000}
        width={1000000}
        height={1000000}
        fill="url(#town-world-vignette)"
        pointerEvents="none"
      />
    </g>
  );
}

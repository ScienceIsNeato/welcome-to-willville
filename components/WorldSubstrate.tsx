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
  mobileSafeMode = false,
}: {
  mobileSafeMode?: boolean;
}) {
  const canalCutout = pointsToPath(CANAL_SECTION.polygon);
  const landscapeArt = mobileSafeMode ? LANDSCAPE_ART_MOBILE : LANDSCAPE_ART;

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
        <radialGradient id="town-world-vignette" cx="50%" cy="47%" r="73%">
          <stop offset="56%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#080515" stopOpacity="0.32" />
        </radialGradient>
      </defs>

      <rect
        width={WORLD.width}
        height={WORLD.height}
        fill="url(#willville-water-tile)"
      />
      <image
        href={landscapeArt}
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

import { GENERATED_TOWN_LAYOUT } from "@/lib/town-layout";
import { TOWN_OFFSET, WORLD } from "@/lib/willville";

const LANDSCAPE_ART =
  "/art/town/willville-landscape-v1.png?v=ganglia-world-landscape-wide-20260522";

export function WorldSubstrate() {
  return (
    <g aria-hidden>
      <defs>
        <linearGradient id="willville-water" x1="0" y1="0" x2="1" y2="1">
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
        <clipPath id="willville-world-land-mask" clipPathUnits="userSpaceOnUse">
          <path
            d={GENERATED_TOWN_LAYOUT.landPath}
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
        fill="url(#willville-water)"
      />
      <rect
        width={WORLD.width}
        height={WORLD.height}
        fill="url(#willville-water-ripples)"
      />
      <path
        d={GENERATED_TOWN_LAYOUT.landPath}
        transform={`translate(${TOWN_OFFSET.x} ${TOWN_OFFSET.y})`}
        fill="#00ff00"
      />
      <image
        href={LANDSCAPE_ART}
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

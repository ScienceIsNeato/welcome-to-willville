import { GENERATED_TOWN_LAYOUT, serviceRouteForStop } from "@/lib/town-layout";
import type { Stop } from "@/lib/town";
import districtArt from "@/data/town-district-art.v1.json";

type Props = {
  stops: Stop[];
};

const ISTHMUS_LAND_PATH =
  "M -154 -1700 C 120 -1240, 402 -890, 330 -520 C 292 -326, 312 -72, 274 324 C 212 480, 230 628, 330 774 C 438 934, 405 1084, 332 1380 C 260 1830, 302 2210, 380 2920 L 1048 2920 C 1136 2200, 1214 1806, 1118 1380 C 1052 1110, 1042 956, 1140 810 C 1266 622, 1234 490, 1165 334 C 1105 198, 1168 66, 1328 -140 C 1426 -560, 1480 -1010, 1710 -1700 Z";

const ISTHMUS_LEFT_COAST_PATH =
  "M -154 -1700 C 120 -1240, 402 -890, 330 -520 C 292 -326, 312 -72, 274 324 C 212 480, 230 628, 330 774 C 438 934, 405 1084, 332 1380 C 260 1830, 302 2210, 380 2920";

const ISTHMUS_RIGHT_COAST_PATH =
  "M 1710 -1700 C 1480 -1010, 1426 -560, 1328 -140 C 1168 66, 1105 198, 1165 334 C 1234 490, 1266 622, 1140 810 C 1042 956, 1052 1110, 1118 1380 C 1214 1806, 1136 2200, 1048 2920";

export function GeneratedTownBase({ stops }: Props) {
  const districtLayers = districtArt.layers;
  return (
    <g id="generated-town-base" aria-hidden="true">
      <defs>
        <clipPath id="generated-town-land-clip">
          <path d={GENERATED_TOWN_LAYOUT.landPath} />
        </clipPath>
        <clipPath id="generated-town-footprint-clip">
          <path d={GENERATED_TOWN_LAYOUT.townFootprintPath} />
        </clipPath>
        <pattern
          id="isthmus-field-texture"
          patternUnits="userSpaceOnUse"
          width={96}
          height={96}
          patternTransform="rotate(-8)"
        >
          <rect width={96} height={96} fill="#5f9658" />
          <path
            d="M 0 22 H 96 M 0 54 H 96 M 0 86 H 96"
            fill="none"
            stroke="#78ad63"
            strokeWidth={3}
            opacity={0.45}
          />
          <path
            d="M 10 0 V 96 M 48 0 V 96 M 86 0 V 96"
            fill="none"
            stroke="#436e43"
            strokeWidth={2}
            opacity={0.28}
          />
        </pattern>
      </defs>
      <path d={ISTHMUS_LAND_PATH} fill="#5f9658" opacity={0.92} />
      <path
        d={ISTHMUS_LAND_PATH}
        fill="url(#isthmus-field-texture)"
        opacity={0.26}
      />
      <path
        d={ISTHMUS_LEFT_COAST_PATH}
        fill="none"
        stroke="#8ac65e"
        strokeWidth={12}
        strokeLinecap="round"
        opacity={0.75}
      />
      <path
        d={ISTHMUS_RIGHT_COAST_PATH}
        fill="none"
        stroke="#8ac65e"
        strokeWidth={12}
        strokeLinecap="round"
        opacity={0.65}
      />
      <path
        d="M 682 -1700 C 742 -1160, 860 -770, 730 -420 C 660 -230, 688 -118, 742 0 C 835 112, 842 225, 765 340 C 688 454, 704 592, 808 728 C 914 866, 900 1034, 805 1240 C 700 1580, 784 2050, 735 2920"
        fill="none"
        stroke="#155faa"
        strokeWidth={10}
        strokeLinecap="round"
        opacity={0.72}
      />
      <g clipPath="url(#generated-town-footprint-clip)">
        <path
          d={GENERATED_TOWN_LAYOUT.townFootprintPath}
          fill="#6f8f65"
          opacity={0.92}
        />
        <path
          d={GENERATED_TOWN_LAYOUT.townFootprintPath}
          fill="url(#isthmus-field-texture)"
          opacity={0.18}
        />
        <path
          d="M 230 270 C 440 230, 675 260, 920 215 C 1120 180, 1260 210, 1340 315 M 260 520 C 455 472, 655 488, 850 455 C 1080 416, 1250 468, 1328 592 M 300 760 C 520 715, 705 742, 930 700 C 1102 668, 1246 720, 1298 834 M 420 966 C 605 930, 770 960, 960 910 C 1076 880, 1160 900, 1210 960"
          fill="none"
          stroke="#d7c698"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray="34 28"
          opacity={0.34}
        />
      </g>
      {districtLayers.map((layer) => (
        <image
          key={layer.id}
          href={`${layer.src}?v=${layer.contentHash ?? districtArt.version}`}
          x={0}
          y={0}
          width={GENERATED_TOWN_LAYOUT.size.width}
          height={GENERATED_TOWN_LAYOUT.size.height}
          preserveAspectRatio="none"
          clipPath="url(#generated-town-footprint-clip)"
        />
      ))}

      {stops.slice(0, 28).map((stop) => (
        <path
          key={`service-${stop.id}`}
          d={serviceRouteForStop(stop.position)}
          fill="none"
          stroke="rgba(245,230,200,0.16)"
          strokeWidth={2}
          strokeDasharray="5 12"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

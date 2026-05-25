import { GENERATED_TOWN_LAYOUT, serviceRouteForStop } from "@/lib/town-layout";
import type { Stop } from "@/lib/town";
import districtArt from "@/data/town-district-art.v1.json";

type Props = {
  stops: Stop[];
};

export function GeneratedTownBase({ stops }: Props) {
  const districtLayers = districtArt.layers;
  return (
    <g id="generated-town-base" aria-hidden="true">
      <defs>
        <clipPath id="generated-town-land-clip">
          <path d={GENERATED_TOWN_LAYOUT.landPath} />
        </clipPath>
      </defs>
      {districtLayers.map((layer) => (
        <image
          key={layer.id}
          href={`${layer.src}?v=${layer.contentHash ?? districtArt.version}`}
          x={0}
          y={0}
          width={GENERATED_TOWN_LAYOUT.size.width}
          height={GENERATED_TOWN_LAYOUT.size.height}
          preserveAspectRatio="none"
          clipPath="url(#generated-town-land-clip)"
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

import { GENERATED_TOWN_LAYOUT, serviceRouteForStop } from "@/lib/town-layout";
import type { Stop } from "@/lib/town";
import districtArt from "@/data/town-district-art.v1.json";

type Props = {
  stops: Stop[];
};

const FALLBACK_TOWN_ART = "/art/town/willville-isthmus-v1.png";
const RENDER_PADDING = 6;

type DistrictLayer = (typeof districtArt.layers)[number];

function districtRenderBox(layer: DistrictLayer) {
  const minX = Math.max(
    0,
    Math.min(...layer.components.map((component) => component.bounds.x)) -
      RENDER_PADDING,
  );
  const minY = Math.max(
    0,
    Math.min(...layer.components.map((component) => component.bounds.y)) -
      RENDER_PADDING,
  );
  const maxX =
    Math.max(
      ...layer.components.map(
        (component) => component.bounds.x + component.bounds.width,
      ),
    ) + RENDER_PADDING;
  const maxY =
    Math.max(
      ...layer.components.map(
        (component) => component.bounds.y + component.bounds.height,
      ),
    ) + RENDER_PADDING;
  const scale = layer.scale ?? 4;
  const left = Math.floor(minX * scale) / scale;
  const top = Math.floor(minY * scale) / scale;
  const right =
    Math.min(layer.pixelSize.width, Math.ceil(maxX * scale)) / scale;
  const bottom =
    Math.min(layer.pixelSize.height, Math.ceil(maxY * scale)) / scale;

  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function GeneratedTownBase({ stops }: Props) {
  const districtLayers = districtArt.layers;

  return (
    <g id="generated-town-base" aria-hidden="true">
      <defs>
        <clipPath id="generated-town-footprint-clip">
          <path d={GENERATED_TOWN_LAYOUT.townFootprintPath} />
        </clipPath>
      </defs>
      <image
        href={`${FALLBACK_TOWN_ART}?v=${districtArt.version}`}
        x={0}
        y={0}
        width={GENERATED_TOWN_LAYOUT.size.width}
        height={GENERATED_TOWN_LAYOUT.size.height}
        preserveAspectRatio="none"
        clipPath="url(#generated-town-footprint-clip)"
      />
      {districtLayers.map((layer) => (
        <image
          key={layer.id}
          href={`/art/town/districts-render/${layer.id}.webp?v=${
            layer.contentHash ?? districtArt.version
          }`}
          {...districtRenderBox(layer)}
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

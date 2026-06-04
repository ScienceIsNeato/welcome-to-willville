import { GENERATED_TOWN_LAYOUT } from "@/lib/town-layout";
import districtArt from "@/data/town-district-art.v1.json";

const FALLBACK_TOWN_ART = "/art/town/willville-isthmus-v1.png";
const RENDER_PADDING = 6;

type DistrictLayer = (typeof districtArt.layers)[number];

const LAND_CLIP_DISTRICT_IDS = new Set(
  GENERATED_TOWN_LAYOUT.districts
    .filter((district) => (district as { clip?: string }).clip === "land")
    .map((district) => district.id),
);

function districtClipId(layerId: string) {
  return LAND_CLIP_DISTRICT_IDS.has(layerId)
    ? "url(#generated-town-land-clip)"
    : "url(#generated-town-footprint-clip)";
}

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

export function GeneratedTownBase({
  mobileSafeMode = false,
}: {
  mobileSafeMode?: boolean;
}) {
  const districtLayers = districtArt.layers;
  // Phones OOM on the full-res district art (~88MB decoded). Mobile-safe mode
  // loads the half-res `.mobile.webp` variants (~22MB decoded) instead.
  const renderExt = mobileSafeMode ? "mobile.webp" : "webp";

  return (
    <g id="generated-town-base" aria-hidden="true">
      <defs>
        <clipPath id="generated-town-footprint-clip">
          <path d={GENERATED_TOWN_LAYOUT.townFootprintPath} />
        </clipPath>
        <clipPath id="generated-town-land-clip">
          <path d={GENERATED_TOWN_LAYOUT.landPath} />
        </clipPath>
      </defs>
      {districtLayers.length === 0 && (
        <image
          href={`${FALLBACK_TOWN_ART}?v=${districtArt.version}`}
          x={0}
          y={0}
          width={GENERATED_TOWN_LAYOUT.size.width}
          height={GENERATED_TOWN_LAYOUT.size.height}
          preserveAspectRatio="none"
          clipPath="url(#generated-town-footprint-clip)"
        />
      )}
      {districtLayers.map((layer) => (
        <image
          key={layer.id}
          href={`/art/town/districts-render/${layer.id}.${renderExt}?v=${
            layer.contentHash ?? districtArt.version
          }`}
          {...districtRenderBox(layer)}
          preserveAspectRatio="none"
          clipPath={districtClipId(layer.id)}
        />
      ))}
    </g>
  );
}

type GlyphHaloConfig = {
  enabled?: boolean;
  description: string;
  padding?: number;
  cacheKey?: string;
  differenceThreshold?: number;
};

type SpriteLike = {
  stopId: string;
  width: number;
  inpaintHalo?: GlyphHaloConfig;
};

type Point = {
  x: number;
  y: number;
};

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const GLYPH_HALO_OUTPUT_ROOT = "/art/town/glyph-halos";
const GLYPH_HALO_DEFAULT_PADDING = 24;
const GLYPH_HALO_DEFAULT_THRESHOLD = 10;

export function glyphHaloConfigForSprite(
  sprite: SpriteLike,
): GlyphHaloConfig | null {
  if (!sprite.inpaintHalo) return null;
  if (sprite.inpaintHalo.enabled === false) return null;
  return sprite.inpaintHalo;
}

function glyphHaloRadiusForSprite(sprite: Pick<SpriteLike, "width">) {
  return Math.max(1, Math.round(sprite.width / 2));
}

export function glyphHaloMaskBoxForSprite(
  sprite: SpriteLike,
  center: Point,
): Box {
  const radius = glyphHaloRadiusForSprite(sprite);
  return {
    x: Math.round(center.x - radius),
    y: Math.round(center.y - radius),
    width: radius * 2,
    height: radius * 2,
  };
}

function glyphHaloPaddingForSprite(sprite: SpriteLike) {
  return Math.max(
    0,
    Math.round(sprite.inpaintHalo?.padding ?? GLYPH_HALO_DEFAULT_PADDING),
  );
}

export function glyphHaloCropBoxForSprite(
  sprite: SpriteLike,
  center: Point,
): Box {
  const mask = glyphHaloMaskBoxForSprite(sprite, center);
  const padding = glyphHaloPaddingForSprite(sprite);
  return {
    x: mask.x - padding,
    y: mask.y - padding,
    width: mask.width + padding * 2,
    height: mask.height + padding * 2,
  };
}

export function clampBoxToCanvas(
  box: Box,
  canvas: { width: number; height: number },
): Box {
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  return {
    x,
    y,
    width: Math.max(1, Math.min(canvas.width, box.x + box.width) - x),
    height: Math.max(1, Math.min(canvas.height, box.y + box.height) - y),
  };
}

export function glyphHaloAssetPath(stopId: string) {
  return `${GLYPH_HALO_OUTPUT_ROOT}/${stopId}.png`;
}

export function glyphHaloCacheKeyForSprite(sprite: SpriteLike) {
  return sprite.inpaintHalo?.cacheKey ?? "glyph-halo-v1";
}

export function glyphHaloDifferenceThresholdForSprite(sprite: SpriteLike) {
  return Math.max(
    0,
    Math.round(
      sprite.inpaintHalo?.differenceThreshold ?? GLYPH_HALO_DEFAULT_THRESHOLD,
    ),
  );
}

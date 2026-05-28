type AlphaBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type GlyphHaloConfig = {
  enabled?: boolean;
  description: string;
  radialScale?: number;
  alphaBounds?: AlphaBounds;
  padding?: number;
  cacheKey?: string;
  differenceThreshold?: number;
};

type SpriteLike = {
  stopId: string;
  width: number;
  height: number;
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
const GLYPH_HALO_DEFAULT_RADIAL_SCALE = 1.2;
const GLYPH_HALO_DEFAULT_PADDING = 24;
const GLYPH_HALO_DEFAULT_THRESHOLD = 10;

export function glyphHaloConfigForSprite(
  sprite: SpriteLike,
): GlyphHaloConfig | null {
  if (!sprite.inpaintHalo) return null;
  if (sprite.inpaintHalo.enabled === false) return null;
  return sprite.inpaintHalo;
}

export function glyphHaloRadialScaleForSprite(sprite: SpriteLike) {
  return Math.max(
    1,
    Number(sprite.inpaintHalo?.radialScale ?? GLYPH_HALO_DEFAULT_RADIAL_SCALE),
  );
}

export function glyphHaloRayPaddingForSprite(
  sprite: SpriteLike,
  alphaWidth = glyphHaloAlphaBoundsForSprite(sprite).width,
) {
  const radialScale = glyphHaloRadialScaleForSprite(sprite);
  if (radialScale <= 1) return 0;
  return Math.max(1, Math.round((alphaWidth * (radialScale - 1)) / 2));
}

function glyphHaloAlphaBoundsForSprite(sprite: SpriteLike): AlphaBounds {
  return (
    sprite.inpaintHalo?.alphaBounds ?? {
      x: 0,
      y: 0,
      width: sprite.width,
      height: sprite.height,
    }
  );
}

export function glyphHaloAlphaBoxForSprite(
  sprite: SpriteLike,
  center: Point,
): Box {
  const alphaBounds = glyphHaloAlphaBoundsForSprite(sprite);
  return {
    x: Math.round(center.x - sprite.width / 2 + alphaBounds.x),
    y: Math.round(center.y - sprite.height / 2 + alphaBounds.y),
    width: alphaBounds.width,
    height: alphaBounds.height,
  };
}

export function glyphHaloMaskBoxForSprite(
  sprite: SpriteLike,
  center: Point,
): Box {
  const alphaBox = glyphHaloAlphaBoxForSprite(sprite, center);
  const radialScale = glyphHaloRadialScaleForSprite(sprite);
  const scaledWidth = Math.max(1, Math.round(alphaBox.width * radialScale));
  const scaledHeight = Math.max(1, Math.round(alphaBox.height * radialScale));
  const alphaCenterX = alphaBox.x + alphaBox.width / 2;
  const alphaCenterY = alphaBox.y + alphaBox.height / 2;
  return {
    x: Math.round(alphaCenterX - scaledWidth / 2),
    y: Math.round(alphaCenterY - scaledHeight / 2),
    width: scaledWidth,
    height: scaledHeight,
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

export function glyphHaloDifferenceThresholdForSprite(sprite: SpriteLike) {
  return Math.max(
    0,
    Math.round(
      sprite.inpaintHalo?.differenceThreshold ?? GLYPH_HALO_DEFAULT_THRESHOLD,
    ),
  );
}

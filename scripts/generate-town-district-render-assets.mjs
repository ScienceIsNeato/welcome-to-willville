import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const ART_MANIFEST = path.join(ROOT, "data/town-district-art.v1.json");
const OUTPUT_DIR = path.join(ROOT, "public/art/town/districts-render");
const RENDER_PADDING = 6;
// Half-resolution `<id>.mobile.webp` variants quarter the decoded pixel buffer
// (~100MB of full-res district art -> ~25MB) so phones don't OOM and crash the
// tab. Mobile-safe rendering loads these instead of the full-res renders.
const MOBILE_SCALE = 0.5;

function layerBounds(layer) {
  const bounds = layer.components.map((component) => component.bounds);
  const minX = Math.max(
    0,
    Math.min(...bounds.map((item) => item.x)) - RENDER_PADDING,
  );
  const minY = Math.max(
    0,
    Math.min(...bounds.map((item) => item.y)) - RENDER_PADDING,
  );
  const maxX =
    Math.max(...bounds.map((item) => item.x + item.width)) + RENDER_PADDING;
  const maxY =
    Math.max(...bounds.map((item) => item.y + item.height)) + RENDER_PADDING;

  return { minX, minY, maxX, maxY };
}

async function main() {
  const manifest = JSON.parse(await readFile(ART_MANIFEST, "utf8"));
  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const layer of manifest.layers) {
    const scale = layer.scale ?? 4;
    const bounds = layerBounds(layer);
    const left = Math.floor(bounds.minX * scale);
    const top = Math.floor(bounds.minY * scale);
    const right = Math.min(
      layer.pixelSize.width,
      Math.ceil(bounds.maxX * scale),
    );
    const bottom = Math.min(
      layer.pixelSize.height,
      Math.ceil(bounds.maxY * scale),
    );

    const src = path.join(ROOT, `public${layer.src}`);
    const cropW = right - left;
    const cropH = bottom - top;
    const extractOpts = { left, top, width: cropW, height: cropH };

    await sharp(src)
      .extract(extractOpts)
      .webp({ quality: 88, effort: 6 })
      .toFile(path.join(OUTPUT_DIR, `${layer.id}.webp`));

    await sharp(src)
      .extract(extractOpts)
      .resize({ width: Math.max(1, Math.round(cropW * MOBILE_SCALE)) })
      .webp({ quality: 80, effort: 6 })
      .toFile(path.join(OUTPUT_DIR, `${layer.id}.mobile.webp`));
  }
}

await main();

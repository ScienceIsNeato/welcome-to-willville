#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(new URL("..", import.meta.url).pathname);
const config = JSON.parse(
  await readFile(resolve(root, "data/town-site-inpaints.v1.json"), "utf8"),
);
const districtArt = JSON.parse(
  await readFile(resolve(root, "data/town-district-art.v1.json"), "utf8"),
);

function svgForInpaint(inpaint) {
  const ellipse = inpaint.maskEllipse;
  const cx = inpaint.anchor.x;
  const cy = inpaint.anchor.y + (ellipse.centerYOffset ?? 0);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1240" viewBox="0 0 1600 1240">
  <rect width="1600" height="1240" fill="white" />
  <ellipse cx="${cx}" cy="${cy}" rx="${ellipse.rx}" ry="${ellipse.ry}" fill="none" stroke="#00bcd4" stroke-width="3" />
</svg>
`;
}

async function writeMask(inpaint, outputPath) {
  const layer = districtArt.layers.find(
    (item) => item.id === inpaint.districtId,
  );
  if (!layer) throw new Error(`Unknown district: ${inpaint.districtId}`);

  const scale = config.authoringScale;
  const width = layer.pixelSize.width;
  const height = layer.pixelSize.height;
  const ellipse = inpaint.maskEllipse;
  const cx = inpaint.anchor.x * scale;
  const cy = (inpaint.anchor.y + (ellipse.centerYOffset ?? 0)) * scale;
  const rx = ellipse.rx * scale;
  const ry = ellipse.ry * scale;
  const buffer = Buffer.alloc(width * height * 4, 255);

  const minX = Math.max(0, Math.floor(cx - rx));
  const maxX = Math.min(width - 1, Math.ceil(cx + rx));
  const minY = Math.max(0, Math.floor(cy - ry));
  const maxY = Math.min(height - 1, Math.ceil(cy + ry));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        buffer[(y * width + x) * 4 + 3] = 0;
      }
    }
  }

  await sharp(buffer, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outputPath);
}

const resolved = {
  version: `${config.version}-resolved`,
  authoringScale: config.authoringScale,
  districtOutputs: config.districtOutputs,
  inpaints: [],
};

for (const inpaint of config.inpaints) {
  const svgOutput = resolve(root, "public", inpaint.maskSvg.replace(/^\//, ""));
  const pngOutput = resolve(
    root,
    "public",
    inpaint.maskImage.replace(/^\//, ""),
  );
  await mkdir(dirname(svgOutput), { recursive: true });
  await mkdir(dirname(pngOutput), { recursive: true });
  await writeFile(svgOutput, svgForInpaint(inpaint));
  await writeMask(inpaint, pngOutput);

  resolved.inpaints.push({
    ...inpaint,
    gangliaCommand: [
      "ganglia-studio",
      "insert-glyph",
      "--input",
      "<current-district-working-image>",
      "--mask",
      inpaint.maskImage,
      "--description",
      inpaint.description,
      "--output",
      "<updated-district-working-image>",
      "--quality",
      "high",
      "--feather",
      "15",
    ],
  });
}

const output = resolve(root, "docs/generated/town-site-inpaints.v1.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(resolved, null, 2)}\n`);
console.log(`wrote ${output}`);
console.log("wrote site inpaint masks");

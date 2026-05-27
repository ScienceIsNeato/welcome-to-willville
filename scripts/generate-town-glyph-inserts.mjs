#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(new URL("..", import.meta.url).pathname);
const layout = JSON.parse(
  await readFile(resolve(root, "data/town-layout.v1.json"), "utf8"),
);
const source = JSON.parse(
  await readFile(resolve(root, "data/town-glyph-inserts.v1.json"), "utf8"),
);

function boundsFor(points) {
  return {
    x: Math.min(...points.map((point) => point.x)),
    y: Math.min(...points.map((point) => point.y)),
    width:
      Math.max(...points.map((point) => point.x)) -
      Math.min(...points.map((point) => point.x)),
    height:
      Math.max(...points.map((point) => point.y)) -
      Math.min(...points.map((point) => point.y)),
  };
}

function pointsAttr(points) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function maskSvg(insert) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${source.canvas.width}" height="${source.canvas.height}" viewBox="0 0 ${source.canvas.width} ${source.canvas.height}">
  <rect width="${source.canvas.width}" height="${source.canvas.height}" fill="white" />
  <polygon points="${pointsAttr(insert.maskPolygon)}" fill="none" stroke="#00bcd4" stroke-width="3" />
</svg>
`;
}

async function writeRgbaMask(insert, pngOutput) {
  const width = source.canvas.width * source.authoringScale;
  const height = source.canvas.height * source.authoringScale;
  const buffer = Buffer.alloc(width * height * 4, 255);
  const scaledPolygon = insert.maskPolygon.map((point) => ({
    x: point.x * source.authoringScale,
    y: point.y * source.authoringScale,
  }));
  const bounds = boundsFor(scaledPolygon);
  const minX = Math.max(0, Math.floor(bounds.x));
  const minY = Math.max(0, Math.floor(bounds.y));
  const maxX = Math.min(width - 1, Math.ceil(bounds.x + bounds.width));
  const maxY = Math.min(height - 1, Math.ceil(bounds.y + bounds.height));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPolygon({ x, y }, scaledPolygon)) {
        buffer[(y * width + x) * 4 + 3] = 0;
      }
    }
  }

  await sharp(buffer, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toFile(pngOutput);
}

const resolved = {
  version: `${source.version}-resolved`,
  canvas: source.canvas,
  authoringScale: source.authoringScale,
  inserts: [],
};

for (const insert of source.inserts) {
  const district = layout.districts.find(
    (item) => item.id === insert.districtId,
  );
  if (!district) {
    throw new Error(`Unknown glyph insert district: ${insert.districtId}`);
  }

  const landmark = layout.landmarks[insert.landmarkId];
  if (!landmark) {
    throw new Error(`Unknown glyph insert landmark: ${insert.landmarkId}`);
  }
  if (
    !insert.anchor ||
    typeof insert.anchor.x !== "number" ||
    typeof insert.anchor.y !== "number"
  ) {
    throw new Error(`${insert.id} anchor must be an {x,y} pixel coordinate`);
  }

  const svgOutput = resolve(root, "public", insert.maskSvg.replace(/^\//, ""));
  const pngOutput = resolve(
    root,
    "public",
    insert.maskImage.replace(/^\//, ""),
  );
  await mkdir(dirname(svgOutput), { recursive: true });
  await writeFile(svgOutput, maskSvg(insert));
  await writeRgbaMask(insert, pngOutput);

  const bounds = boundsFor(insert.maskPolygon);
  resolved.inserts.push({
    ...insert,
    mapBounds: bounds,
    authoringBounds: {
      x: bounds.x * source.authoringScale,
      y: bounds.y * source.authoringScale,
      width: bounds.width * source.authoringScale,
      height: bounds.height * source.authoringScale,
    },
    authoringSize: {
      width: source.canvas.width * source.authoringScale,
      height: source.canvas.height * source.authoringScale,
    },
    gangliaCommand: [
      "ganglia-studio",
      "insert-glyph",
      "--input",
      insert.sourceImage,
      "--mask",
      insert.maskImage,
      "--description",
      insert.description,
      "--output",
      insert.outputImage,
      "--quality",
      "high",
      "--feather",
      "15",
    ],
  });
}

const output = resolve(root, "docs/generated/town-glyph-inserts.v1.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(resolved, null, 2)}\n`);
console.log(`wrote ${output}`);
console.log("wrote glyph insert masks");

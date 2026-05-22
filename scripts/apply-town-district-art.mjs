#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const [key, ...value] = arg.slice(2).split("=");
      return [key, value.join("=")];
    }),
);

const districtId = args.get("district");
const source = args.get("source");
const outputArg = args.get("output");
const scale = Number(args.get("scale") ?? 4);

if (!districtId || !source) {
  throw new Error(
    "Usage: node scripts/apply-town-district-art.mjs --district=<id> --source=<image> [--output=<path>] [--scale=<integer>]",
  );
}

if (!Number.isInteger(scale) || scale < 1 || scale > 8) {
  throw new Error(`Scale must be an integer from 1 to 8. Received: ${scale}`);
}

const root = resolve(new URL("..", import.meta.url).pathname);
const contract = JSON.parse(
  await readFile(
    resolve(root, "docs/generated/town-mask-contract.v1.json"),
    "utf8",
  ),
);
const district = contract.districts.find((item) => item.id === districtId);
if (!district) {
  throw new Error(`Unknown district: ${districtId}`);
}

const components = district.artComponents ?? [];
if (components.length === 0) {
  throw new Error(`District ${districtId} has no art ROI components`);
}

const bounds = components.reduce(
  (acc, component) => ({
    minX: Math.min(acc.minX, component.bounds.x),
    minY: Math.min(acc.minY, component.bounds.y),
    maxX: Math.max(acc.maxX, component.bounds.x + component.bounds.width),
    maxY: Math.max(acc.maxY, component.bounds.y + component.bounds.height),
  }),
  { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
);

const padding = 28;
const crop = {
  left: Math.max(0, bounds.minX - padding),
  top: Math.max(0, bounds.minY - padding),
  width:
    Math.min(contract.size.width, bounds.maxX + padding) -
    Math.max(0, bounds.minX - padding),
  height:
    Math.min(contract.size.height, bounds.maxY + padding) -
    Math.max(0, bounds.minY - padding),
};

const output =
  outputArg ?? resolve(root, "public/art/town/districts", `${districtId}.png`);
const manifestOutput = resolve(root, "data/town-district-art.v1.json");
const maskPath = resolve(
  root,
  "public",
  district.artMask.png.replace(/^\//, ""),
);
const outputSize = {
  width: contract.size.width * scale,
  height: contract.size.height * scale,
};
const scaledCrop = {
  left: crop.left * scale,
  top: crop.top * scale,
  width: crop.width * scale,
  height: crop.height * scale,
};
const { data: alpha, info: alphaInfo } = await sharp(maskPath)
  .resize(outputSize.width, outputSize.height, {
    fit: "fill",
    kernel: sharp.kernel.nearest,
  })
  .extractChannel(0)
  .raw()
  .toBuffer({ resolveWithObject: true });
const paintedCrop = await sharp(resolve(source))
  .resize(scaledCrop.width, scaledCrop.height, {
    fit: "cover",
    position: "centre",
  })
  .ensureAlpha()
  .png()
  .toBuffer();

const { data: rgb, info: rgbInfo } = await sharp({
  create: {
    width: outputSize.width,
    height: outputSize.height,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([
    { input: paintedCrop, left: scaledCrop.left, top: scaledCrop.top },
  ])
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

if (rgbInfo.width !== alphaInfo.width || rgbInfo.height !== alphaInfo.height) {
  throw new Error(
    `Mask size mismatch: ${alphaInfo.width}x${alphaInfo.height} vs ${rgbInfo.width}x${rgbInfo.height}`,
  );
}

const rgba = Buffer.alloc(rgbInfo.width * rgbInfo.height * 4);
for (let pixel = 0; pixel < rgbInfo.width * rgbInfo.height; pixel += 1) {
  const rgbOffset = pixel * 3;
  const rgbaOffset = pixel * 4;
  rgba[rgbaOffset] = rgb[rgbOffset];
  rgba[rgbaOffset + 1] = rgb[rgbOffset + 1];
  rgba[rgbaOffset + 2] = rgb[rgbOffset + 2];
  rgba[rgbaOffset + 3] = alpha[pixel];
}

const fullCanvas = await sharp(rgba, {
  raw: {
    width: rgbInfo.width,
    height: rgbInfo.height,
    channels: 4,
  },
})
  .png()
  .toFile(output);
const contentHash = `district-art-${districtId}-${new Date()
  .toISOString()
  .slice(0, 16)
  .replace("T", "-")
  .replace(":", "")}`;

try {
  const manifest = JSON.parse(await readFile(manifestOutput, "utf8"));
  const layer = manifest.layers?.find((item) => item.id === districtId);
  if (layer) {
    layer.contentHash = contentHash;
    layer.artKind = "custom";
    layer.scale = scale;
    layer.pixelSize = outputSize;
    await writeFile(manifestOutput, `${JSON.stringify(manifest, null, 2)}\n`);
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

console.log(
  JSON.stringify(
    {
      district: districtId,
      source,
      output,
      contentHash,
      scale,
      crop,
      scaledCrop,
      width: fullCanvas.width,
      height: fullCanvas.height,
    },
    null,
    2,
  ),
);

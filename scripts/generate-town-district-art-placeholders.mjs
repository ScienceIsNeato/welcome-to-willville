#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(new URL("..", import.meta.url).pathname);
const contract = JSON.parse(
  await readFile(
    resolve(root, "docs/generated/town-mask-contract.v1.json"),
    "utf8",
  ),
);
const baseImage = resolve(root, "public/art/town/willville-isthmus-v1.png");
const outputRoot = resolve(root, "public/art/town/districts");
const manifestOutput = resolve(root, "data/town-district-art.v1.json");

const layers = [];
let existingManifest = { layers: [] };

try {
  existingManifest = JSON.parse(await readFile(manifestOutput, "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

for (const district of contract.districts) {
  const existingLayer = existingManifest.layers?.find(
    (layer) => layer.id === district.id,
  );
  const maskPath = resolve(
    root,
    "public",
    district.artMask.png.replace(/^\//, ""),
  );
  const output = resolve(outputRoot, `${district.id}.png`);
  await mkdir(dirname(output), { recursive: true });

  if (existingLayer?.artKind !== "custom") {
    const [{ data: rgb, info: rgbInfo }, { data: alpha, info: alphaInfo }] =
      await Promise.all([
        sharp(baseImage)
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true }),
        sharp(maskPath)
          .extractChannel(0)
          .raw()
          .toBuffer({ resolveWithObject: true }),
      ]);

    if (
      rgbInfo.width !== alphaInfo.width ||
      rgbInfo.height !== alphaInfo.height
    ) {
      throw new Error(
        `Mask size mismatch for ${district.id}: ${alphaInfo.width}x${alphaInfo.height} vs ${rgbInfo.width}x${rgbInfo.height}`,
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

    await sharp(rgba, {
      raw: {
        width: rgbInfo.width,
        height: rgbInfo.height,
        channels: 4,
      },
    })
      .png()
      .toFile(output);
  }

  layers.push({
    id: district.id,
    displayName: district.displayName,
    src: `/art/town/districts/${district.id}.png`,
    contentHash:
      existingLayer?.contentHash ?? `district-art-${district.id}-placeholder`,
    mask: district.artMask.png,
    components: district.artComponents,
    ...(existingLayer?.artKind ? { artKind: existingLayer.artKind } : {}),
    ...(existingLayer?.scale ? { scale: existingLayer.scale } : {}),
    ...(existingLayer?.pixelSize ? { pixelSize: existingLayer.pixelSize } : {}),
  });
}

await mkdir(dirname(manifestOutput), { recursive: true });
await writeFile(
  manifestOutput,
  `${JSON.stringify(
    {
      version: `${contract.version}-district-art-placeholders`,
      source: "/art/town/willville-isthmus-v1.png",
      layers,
    },
    null,
    2,
  )}\n`,
);

console.log(`wrote ${outputRoot}`);
console.log(`wrote ${manifestOutput}`);

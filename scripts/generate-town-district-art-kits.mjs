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
const outputRoot = resolve(root, "public/art/town/art-kits");
const manifestOutput = resolve(
  root,
  "docs/generated/town-district-art-kits.v1.json",
);

const scale = 4;
const padding = 28;

function paddedBounds(bounds) {
  const x = Math.max(0, bounds.x - padding);
  const y = Math.max(0, bounds.y - padding);
  return {
    x,
    y,
    width: Math.min(contract.size.width, bounds.x + bounds.width + padding) - x,
    height:
      Math.min(contract.size.height, bounds.y + bounds.height + padding) - y,
  };
}

const manifest = {
  version: `${contract.version}-district-art-kits`,
  scale,
  padding,
  size: contract.size,
  districts: [],
};

for (const district of contract.districts) {
  const maskPath = resolve(
    root,
    "public",
    district.artMask.png.replace(/^\//, ""),
  );
  const components = [];

  for (const component of district.artComponents ?? []) {
    const sourceRect = paddedBounds(component.bounds);
    const authoringSize = {
      width: sourceRect.width * scale,
      height: sourceRect.height * scale,
    };
    const relativeMask = `${district.id}/${component.id}-mask.png`;
    const maskOutput = resolve(outputRoot, relativeMask);
    await mkdir(dirname(maskOutput), { recursive: true });
    await sharp(maskPath)
      .extract({
        left: sourceRect.x,
        top: sourceRect.y,
        width: sourceRect.width,
        height: sourceRect.height,
      })
      .resize(authoringSize.width, authoringSize.height, {
        fit: "fill",
        kernel: sharp.kernel.nearest,
      })
      .png()
      .toFile(maskOutput);

    components.push({
      id: component.id,
      sourceRect,
      authoringSize,
      mapBounds: component.bounds,
      centroid: component.centroid,
      area: component.area,
      mask: `/art/town/art-kits/${relativeMask}`,
    });
  }

  manifest.districts.push({
    id: district.id,
    displayName: district.displayName,
    label: district.label,
    artMask: district.artMask.png,
    components,
  });
}

await mkdir(dirname(manifestOutput), { recursive: true });
await writeFile(manifestOutput, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${manifestOutput}`);
console.log(`wrote ${outputRoot}`);

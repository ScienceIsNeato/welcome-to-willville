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

const source = args.get("source");
const outputArg = args.get("output");

if (!source) {
  throw new Error(
    "Usage: node scripts/apply-town-world-landscape-art.mjs --source=<image> [--output=<path>]",
  );
}

const root = resolve(new URL("..", import.meta.url).pathname);
const contractPath = resolve(
  root,
  "docs/generated/town-world-backdrop.v1.json",
);
const contract = JSON.parse(await readFile(contractPath, "utf8"));
const output =
  outputArg ??
  resolve(root, "public", contract.assets.landPng.replace(/^\//, ""));

const outputSize = contract.size;
const maskSvg =
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${outputSize.width}" height="${outputSize.height}" viewBox="0 0 ${outputSize.width} ${outputSize.height}">
  <rect width="${outputSize.width}" height="${outputSize.height}" fill="black" />
  <path d="${contract.sourceGeometry.worldLandPath}" fill="white" />
</svg>`);
const { data: alpha, info: alphaInfo } = await sharp(maskSvg)
  .extractChannel(0)
  .raw()
  .toBuffer({ resolveWithObject: true });

const { data: rgb, info: rgbInfo } = await sharp(resolve(source))
  .resize(outputSize.width, outputSize.height, {
    fit: "cover",
    position: "centre",
  })
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

const result = await sharp(rgba, {
  raw: {
    width: rgbInfo.width,
    height: rgbInfo.height,
    channels: 4,
  },
})
  .png()
  .toFile(output);

contract.assets.source = source;
delete contract.assets.zoomOut;
contract.assets.landPng = output.replace(root, "").replace(/^\/public\//, "/");
contract.assets.appliedBy = "scripts/apply-town-world-landscape-art.mjs";
await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      source,
      output,
      width: result.width,
      height: result.height,
    },
    null,
    2,
  ),
);

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
const waterTileOutput = resolve(
  root,
  "public",
  (
    contract.assets.waterTilePng ?? "/art/town/willville-water-tile-v1.png"
  ).replace(/^\//, ""),
);

const outputSize = contract.size;
const sourceGeometry = contract.sourceGeometry;
const landPath = sourceGeometry.landPath ?? sourceGeometry.worldLandPath;
const canalPath = sourceGeometry.canalPath;
const landTransform = sourceGeometry.landTransform
  ? ` transform="${sourceGeometry.landTransform}"`
  : "";
if (!landPath) {
  throw new Error("World backdrop contract is missing land path geometry");
}
const maskSvg =
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${outputSize.width}" height="${outputSize.height}" viewBox="0 0 ${outputSize.width} ${outputSize.height}">
  <rect width="${outputSize.width}" height="${outputSize.height}" fill="black" />
  <path d="${landPath}"${landTransform} fill="white" />
  ${canalPath ? `<path d="${canalPath}"${landTransform} fill="black" />` : ""}
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

const sourceImage = sharp(resolve(source));
const sourceMetadata = await sourceImage.metadata();
const sourceWidth = sourceMetadata.width;
const sourceHeight = sourceMetadata.height;
if (!sourceWidth || !sourceHeight) {
  throw new Error(`Unable to read source dimensions for ${source}`);
}
const cropSize = Math.min(
  256,
  Math.floor(Math.min(sourceWidth, sourceHeight) * 0.18),
);
const waterCrop = {
  left: Math.min(
    sourceWidth - cropSize,
    Math.max(0, Math.round(sourceWidth * 0.49)),
  ),
  top: Math.min(sourceHeight - cropSize, 0),
  width: cropSize,
  height: cropSize,
};
const waterTileBase = await sharp(resolve(source))
  .extract(waterCrop)
  .resize(256, 256, { fit: "fill" })
  .png()
  .toBuffer();
const tileResult = await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 3,
    background: "#07557a",
  },
})
  .composite([
    { input: waterTileBase, left: 0, top: 0 },
    { input: await sharp(waterTileBase).flop().toBuffer(), left: 256, top: 0 },
    { input: await sharp(waterTileBase).flip().toBuffer(), left: 0, top: 256 },
    {
      input: await sharp(waterTileBase).flop().flip().toBuffer(),
      left: 256,
      top: 256,
    },
  ])
  .png()
  .toFile(waterTileOutput);

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

if (!outputArg) {
  contract.assets.source = source;
  delete contract.assets.zoomOut;
  contract.assets.landPng = output
    .replace(root, "")
    .replace(/^\/public\//, "/");
  contract.assets.waterTilePng = waterTileOutput
    .replace(root, "")
    .replace(/^\/public\//, "/");
  contract.assets.waterTileSourceCrop = waterCrop;
  contract.assets.appliedBy = "scripts/apply-town-world-landscape-art.mjs";
  await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
}

console.log(
  JSON.stringify(
    {
      source,
      output,
      waterTile: waterTileOutput,
      width: result.width,
      height: result.height,
      waterTileWidth: tileResult.width,
      waterTileHeight: tileResult.height,
    },
    null,
    2,
  ),
);

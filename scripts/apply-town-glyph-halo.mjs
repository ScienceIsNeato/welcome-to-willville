#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import {
  clampBoxToCanvas,
  glyphHaloAssetPath,
  glyphHaloConfigForSprite,
  glyphHaloCropBoxForSprite,
  glyphHaloDifferenceThresholdForSprite,
  glyphHaloMaskBoxForSprite,
} from "../lib/glyphHalo.ts";

const execFileAsync = promisify(execFile);
const root = resolve(new URL("..", import.meta.url).pathname);
const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith("--"))
    .map((arg) => {
      const [key, ...value] = arg.slice(2).split("=");
      return [key, value.length > 0 ? value.join("=") : "true"];
    }),
);

const requestedId = args.get("id");
const dryRun = args.get("dry-run") === "true";
const model = args.get("model") ?? "gpt-image-1";
const quality = args.get("quality") ?? "high";
const feather = args.get("feather") ?? "15";
const gangliaStudioDir =
  args.get("ganglia-studio-dir") ??
  process.env.GANGLIA_STUDIO_DIR ??
  [
    resolve(root, "../ganglia-studio"),
    resolve(root, "../ganglia-core/ganglia-studio"),
    resolve(root, "../../ganglia-core/ganglia-studio"),
    resolve(root, "../ganglia_repos/ganglia-core/ganglia-studio"),
  ].find((candidate) => existsSync(candidate));
const gangliaPython =
  args.get("ganglia-python") ??
  process.env.GANGLIA_PYTHON ??
  (gangliaStudioDir
    ? [
        resolve(gangliaStudioDir, ".venv/bin/python"),
        resolve(gangliaStudioDir, "venv/bin/python"),
      ].find((candidate) => existsSync(candidate))
    : null) ??
  "python";

if (!requestedId) {
  throw new Error(
    "Usage: node scripts/apply-town-glyph-halo.mjs --id=<stop-id> [--ganglia-studio-dir=<path>] [--model=<model>] [--quality=<quality>] [--feather=<pixels>] [--dry-run]",
  );
}

if (!dryRun && !gangliaStudioDir) {
  throw new Error(
    "ganglia-studio checkout not found. Set GANGLIA_STUDIO_DIR or pass --ganglia-studio-dir=<path>.",
  );
}

const [{ HEURISTICS }, spriteManifest, districtArt] = await Promise.all([
  import("../lib/willville.heuristics.ts"),
  readFile(resolve(root, "data/town-site-sprites.v1.json"), "utf8").then(
    JSON.parse,
  ),
  readFile(resolve(root, "data/town-district-art.v1.json"), "utf8").then(
    JSON.parse,
  ),
]);

function projectPath(publicPath) {
  return resolve(root, "public", publicPath.replace(/^\//, ""));
}

function slugForHeuristic(heuristic) {
  return heuristic.repo.split("/").pop().toLowerCase();
}

function buildMask(cropBox, maskBox, scale) {
  const width = cropBox.width * scale;
  const height = cropBox.height * scale;
  const buffer = Buffer.alloc(width * height * 4, 255);
  const localMask = {
    x: (maskBox.x - cropBox.x) * scale,
    y: (maskBox.y - cropBox.y) * scale,
    width: maskBox.width * scale,
    height: maskBox.height * scale,
  };

  const minX = Math.max(0, Math.floor(localMask.x));
  const minY = Math.max(0, Math.floor(localMask.y));
  const maxX = Math.min(width - 1, Math.ceil(localMask.x + localMask.width));
  const maxY = Math.min(height - 1, Math.ceil(localMask.y + localMask.height));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      buffer[(y * width + x) * 4 + 3] = 0;
    }
  }

  return { buffer, width, height };
}

async function extractOverlay(originalPath, editedPath, outputPath, threshold) {
  const [{ data: original, info }, { data: edited }] = await Promise.all([
    sharp(originalPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    sharp(editedPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);

  const overlay = Buffer.alloc(original.length, 0);
  for (let index = 0; index < original.length; index += 4) {
    const diff = Math.max(
      Math.abs(edited[index] - original[index]),
      Math.abs(edited[index + 1] - original[index + 1]),
      Math.abs(edited[index + 2] - original[index + 2]),
      Math.abs(edited[index + 3] - original[index + 3]),
    );
    if (diff > threshold) {
      overlay[index] = edited[index];
      overlay[index + 1] = edited[index + 1];
      overlay[index + 2] = edited[index + 2];
      overlay[index + 3] = edited[index + 3];
    }
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await sharp(overlay, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toFile(outputPath);
}

async function runGanglia(commandArgs, cwd) {
  if (dryRun) {
    console.log(
      JSON.stringify(
        { cwd, command: gangliaPython, args: commandArgs },
        null,
        2,
      ),
    );
    return;
  }
  const { stdout, stderr } = await execFileAsync(gangliaPython, commandArgs, {
    cwd,
    maxBuffer: 1024 * 1024 * 20,
  });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

const sprite = spriteManifest.sprites.find(
  (item) => item.stopId === requestedId,
);
if (!sprite) {
  throw new Error(`Unknown glyph sprite: ${requestedId}`);
}

const halo = glyphHaloConfigForSprite(sprite);
if (!halo) {
  throw new Error(
    `Glyph ${requestedId} does not have an enabled inpaintHalo config.`,
  );
}

const heuristic = HEURISTICS.find(
  (item) => slugForHeuristic(item) === requestedId,
);
if (!heuristic?.position) {
  throw new Error(`No heuristic position found for ${requestedId}`);
}

const districtLayer = districtArt.layers.find(
  (item) => item.id === sprite.district,
);
if (!districtLayer) {
  throw new Error(`Unknown district layer: ${sprite.district}`);
}

const canvas = {
  width: districtLayer.pixelSize.width / (districtLayer.scale ?? 4),
  height: districtLayer.pixelSize.height / (districtLayer.scale ?? 4),
};
const maskBox = clampBoxToCanvas(
  glyphHaloMaskBoxForSprite(sprite, heuristic.position),
  canvas,
);
const cropBox = clampBoxToCanvas(
  glyphHaloCropBoxForSprite(sprite, heuristic.position),
  canvas,
);

const scale = districtLayer.scale ?? 4;
const authoringCrop = {
  left: cropBox.x * scale,
  top: cropBox.y * scale,
  width: cropBox.width * scale,
  height: cropBox.height * scale,
};

const tempDir = await mkdtemp(
  join(tmpdir(), `willville-glyph-halo-${requestedId}-`),
);
const cropInput = join(tempDir, `${requestedId}-input.png`);
const cropMask = join(tempDir, `${requestedId}-mask.png`);
const cropOutput = join(tempDir, `${requestedId}-output.png`);
const sourceImage = projectPath(districtLayer.src);
const overlayOutput = projectPath(glyphHaloAssetPath(requestedId));

await sharp(sourceImage).extract(authoringCrop).toFile(cropInput);

const mask = buildMask(cropBox, maskBox, scale);
await sharp(mask.buffer, {
  raw: {
    width: mask.width,
    height: mask.height,
    channels: 4,
  },
})
  .png()
  .toFile(cropMask);

await runGanglia(
  [
    "-m",
    "ganglia_studio.cli",
    "insert-glyph",
    "--input",
    cropInput,
    "--mask",
    cropMask,
    "--description",
    halo.description,
    "--output",
    cropOutput,
    "--model",
    model,
    "--quality",
    quality,
    "--feather",
    feather,
  ],
  gangliaStudioDir,
);

if (!dryRun) {
  await extractOverlay(
    cropInput,
    cropOutput,
    overlayOutput,
    glyphHaloDifferenceThresholdForSprite(sprite),
  );
}

const summary = {
  stopId: requestedId,
  districtId: sprite.district,
  sourceImage: districtLayer.src,
  overlayOutput: glyphHaloAssetPath(requestedId),
  maskBox,
  cropBox,
  authoringCrop,
  dryRun,
};

if (dryRun) {
  const debugPath = resolve(
    root,
    "docs/generated",
    `${requestedId}-glyph-halo-spike.json`,
  );
  await mkdir(dirname(debugPath), { recursive: true });
  await writeFile(debugPath, `${JSON.stringify(summary, null, 2)}\n`);
}

console.log(JSON.stringify(summary, null, 2));

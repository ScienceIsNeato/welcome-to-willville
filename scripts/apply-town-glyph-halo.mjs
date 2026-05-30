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
  glyphHaloAlphaBoxForSprite,
  glyphHaloConfigForSprite,
  glyphHaloCropBoxForSprite,
  glyphHaloDifferenceThresholdForSprite,
  glyphHaloMaskBoxForSprite,
  glyphHaloPromptForSprite,
  glyphHaloRayPaddingForSprite,
  glyphHaloRadialScaleForSprite,
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
const customPrompt = args.get("custom-prompt");
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

const [{ HEURISTICS }, { sitePositionForStop }, spriteManifest, districtArt] =
  await Promise.all([
    import("../lib/willville.heuristics.ts"),
    import("../lib/town-layout.ts"),
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

async function buildMask(
  cropBox,
  spriteCenter,
  sprite,
  spritePath,
  regionMaskPath,
  scale,
  radialScale,
) {
  const width = cropBox.width * scale;
  const height = cropBox.height * scale;
  const buffer = Buffer.alloc(width * height * 4, 255);

  const hasSpriteFile = existsSync(spritePath);
  let spritePixels = null;
  let spriteWidth = 0;
  let spriteHeight = 0;
  let spriteCenterLocal = { x: 0, y: 0 };
  let spriteTopLeft = { x: 0, y: 0 };

  if (hasSpriteFile) {
    spriteWidth = Math.max(1, Math.round(sprite.width * scale));
    spriteHeight = Math.max(1, Math.round(sprite.height * scale));
    spriteCenterLocal = {
      x: (spriteCenter.x - cropBox.x) * scale,
      y: (spriteCenter.y - cropBox.y) * scale,
    };
    const result = await sharp(spritePath)
      .ensureAlpha()
      .resize(spriteWidth, spriteHeight, {
        fit: "fill",
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    spritePixels = result.data;
    const spritePixelCenter = {
      x: spriteWidth / 2,
      y: spriteHeight / 2,
    };
    spriteTopLeft = {
      x: spriteCenterLocal.x - spritePixelCenter.x,
      y: spriteCenterLocal.y - spritePixelCenter.y,
    };
  }

  const { data: regionMaskPixels } = await sharp(regionMaskPath)
    .ensureAlpha()
    .extract({
      left: cropBox.x,
      top: cropBox.y,
      width: cropBox.width,
      height: cropBox.height,
    })
    .resize(width, height, {
      fit: "fill",
      kernel: "nearest",
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const safeScale = Math.max(1, radialScale);

  const hasGlyphAlphaAt = (sampleX, sampleY) => {
    if (!hasSpriteFile || !spritePixels) {
      return false;
    }
    const spriteX = Math.floor(sampleX - spriteTopLeft.x);
    const spriteY = Math.floor(sampleY - spriteTopLeft.y);
    if (
      spriteX < 0 ||
      spriteY < 0 ||
      spriteX >= spriteWidth ||
      spriteY >= spriteHeight
    ) {
      return false;
    }
    const alpha = spritePixels[(spriteY * spriteWidth + spriteX) * 4 + 3];
    return alpha > 8;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const regionMaskIndex = (y * width + x) * 4;
      const regionMaskAlpha = regionMaskPixels[regionMaskIndex + 3];
      const regionMaskValue = Math.max(
        regionMaskPixels[regionMaskIndex],
        regionMaskPixels[regionMaskIndex + 1],
        regionMaskPixels[regionMaskIndex + 2],
      );
      if (regionMaskAlpha <= 8 || regionMaskValue <= 8) continue;

      const localX = x + 0.5;
      const localY = y + 0.5;
      const dx = localX - spriteCenterLocal.x;
      const dy = localY - spriteCenterLocal.y;
      const scaledSampleX = spriteCenterLocal.x + dx / safeScale;
      const scaledSampleY = spriteCenterLocal.y + dy / safeScale;
      const inScaledGlyph = hasGlyphAlphaAt(scaledSampleX, scaledSampleY);
      if (inScaledGlyph) {
        buffer[(y * width + x) * 4 + 3] = 0;
      }
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

const heuristic = HEURISTICS.find(
  (item) => slugForHeuristic(item) === requestedId,
);

const districtOverride = args.get("district");
const xOverride = args.get("x");
const yOverride = args.get("y");

let sprite = spriteManifest.sprites.find((item) => item.stopId === requestedId);
if (!sprite) {
  if (customPrompt) {
    sprite = {
      stopId: requestedId,
      district: districtOverride || (heuristic?.district ?? "town-square"),
      kind: "bespoke",
      src: `/art/stops/${requestedId}.png`,
      width: 100,
      height: 100,
      anchorX: 50,
      anchorY: 78,
    };
  } else {
    throw new Error(`Unknown glyph sprite: ${requestedId}`);
  }
} else if (districtOverride) {
  sprite = { ...sprite, district: districtOverride };
}

const halo = glyphHaloConfigForSprite(sprite) ?? {
  description: customPrompt || "",
};
const haloPrompt = customPrompt || glyphHaloPromptForSprite(sprite);
if (!haloPrompt) {
  throw new Error(`Glyph ${requestedId} does not have a paint prompt.`);
}

let position = null;
if (xOverride && yOverride) {
  position = {
    x: Number(xOverride),
    y: Number(yOverride),
  };
} else {
  position =
    heuristic?.position ??
    sitePositionForStop(
      sprite.district,
      requestedId,
      heuristic?.repo ?? `ScienceIsNeato/${requestedId}`,
    );
}
if (!position) {
  throw new Error(`No position found or calculated for ${requestedId}`);
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
const alphaBox = clampBoxToCanvas(
  glyphHaloAlphaBoxForSprite(sprite, position),
  canvas,
);
const maskBox = clampBoxToCanvas(
  glyphHaloMaskBoxForSprite(sprite, position),
  canvas,
);
const cropBox = clampBoxToCanvas(
  glyphHaloCropBoxForSprite(sprite, position),
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
const spriteImage = projectPath(sprite.src);
const regionMaskImage = projectPath(districtLayer.mask);
const overlayOutput = projectPath(glyphHaloAssetPath(requestedId));

await sharp(sourceImage).extract(authoringCrop).toFile(cropInput);

const mask = await buildMask(
  cropBox,
  position,
  sprite,
  spriteImage,
  regionMaskImage,
  scale,
  glyphHaloRadialScaleForSprite(sprite),
);
await sharp(mask.buffer, {
  raw: {
    width: mask.width,
    height: mask.height,
    channels: 4,
  },
})
  .png()
  .toFile(cropMask);

let debugMaskPath = null;
if (dryRun) {
  debugMaskPath = resolve(
    root,
    "docs/generated",
    `${requestedId}-glyph-halo-mask.png`,
  );
  await mkdir(dirname(debugMaskPath), { recursive: true });
  await writeFile(debugMaskPath, await readFile(cropMask));
}

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
    haloPrompt,
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
  spriteImage: sprite.src,
  regionMaskImage: districtLayer.mask,
  overlayOutput: glyphHaloAssetPath(requestedId),
  alphaBox,
  radialScale: glyphHaloRadialScaleForSprite(sprite),
  haloRayPadding: glyphHaloRayPaddingForSprite(sprite, alphaBox.width),
  maskBox,
  cropBox,
  authoringCrop,
  debugMaskPath:
    debugMaskPath?.replace(`${root}/public`, "")?.replace(`${root}/`, "/") ??
    null,
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

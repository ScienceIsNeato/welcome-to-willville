#!/usr/bin/env node
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

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

const requestedDistrict = args.get("district");
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
  ].find((candidate) => existsSync(candidate));

const manifest = JSON.parse(
  await readFile(
    resolve(root, "docs/generated/town-site-inpaints.v1.json"),
    "utf8",
  ),
);
const districtArtPath = resolve(root, "data/town-district-art.v1.json");
const districtArt = JSON.parse(await readFile(districtArtPath, "utf8"));

function projectPath(publicPath) {
  return resolve(root, "public", publicPath.replace(/^\//, ""));
}

function renderBox(layer) {
  const padding = 6;
  const minX = Math.max(
    0,
    Math.min(...layer.components.map((component) => component.bounds.x)) -
      padding,
  );
  const minY = Math.max(
    0,
    Math.min(...layer.components.map((component) => component.bounds.y)) -
      padding,
  );
  const maxX =
    Math.max(
      ...layer.components.map(
        (component) => component.bounds.x + component.bounds.width,
      ),
    ) + padding;
  const maxY =
    Math.max(
      ...layer.components.map(
        (component) => component.bounds.y + component.bounds.height,
      ),
    ) + padding;
  const scale = layer.scale ?? manifest.authoringScale;
  return {
    left: Math.floor(minX * scale),
    top: Math.floor(minY * scale),
    width:
      Math.min(layer.pixelSize.width, Math.ceil(maxX * scale)) -
      Math.floor(minX * scale),
    height:
      Math.min(layer.pixelSize.height, Math.ceil(maxY * scale)) -
      Math.floor(minY * scale),
  };
}

async function runGanglia(commandArgs, cwd) {
  if (dryRun) {
    console.log(JSON.stringify({ cwd, args: commandArgs }, null, 2));
    return;
  }
  const { stdout, stderr } = await execFileAsync("python", commandArgs, {
    cwd,
    maxBuffer: 1024 * 1024 * 20,
  });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

const enabledInpaints = manifest.inpaints.filter(
  (inpaint) =>
    inpaint.enabled !== false &&
    (!requestedDistrict || inpaint.districtId === requestedDistrict) &&
    (!requestedId ||
      inpaint.id === requestedId ||
      inpaint.stopId === requestedId),
);
const districts = new Set(enabledInpaints.map((inpaint) => inpaint.districtId));

if (districts.size === 0) {
  throw new Error("No enabled site inpaints matched the request.");
}
if (!dryRun && !gangliaStudioDir) {
  throw new Error(
    "ganglia-studio checkout not found. Set GANGLIA_STUDIO_DIR or pass --ganglia-studio-dir=<path>.",
  );
}

for (const districtId of districts) {
  const outputConfig = manifest.districtOutputs.find(
    (item) => item.districtId === districtId,
  );
  if (!outputConfig) {
    throw new Error(`No district output configured for ${districtId}`);
  }

  const layer = districtArt.layers.find((item) => item.id === districtId);
  if (!layer) throw new Error(`Unknown district layer: ${districtId}`);

  const tempDir = await mkdtemp(join(tmpdir(), "willville-site-inpaint-"));
  const workingInput = join(tempDir, `${districtId}-working-0.png`);
  await copyFile(projectPath(outputConfig.baseImage), workingInput);
  let currentInput = workingInput;

  const districtInpaints = enabledInpaints.filter(
    (inpaint) => inpaint.districtId === districtId,
  );
  for (const [index, inpaint] of districtInpaints.entries()) {
    const crop = inpaint.authoringCrop;
    const cropInput = join(tempDir, `${inpaint.id}-input.png`);
    const cropMask = join(tempDir, `${inpaint.id}-mask.png`);
    const cropOutput = join(tempDir, `${inpaint.id}-output.png`);
    const nextFull = join(tempDir, `${districtId}-working-${index + 1}.png`);

    await sharp(currentInput).extract(crop).toFile(cropInput);
    await sharp(projectPath(inpaint.maskImage)).extract(crop).toFile(cropMask);

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
        inpaint.description,
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

    if (dryRun) continue;

    await sharp(currentInput)
      .composite([{ input: cropOutput, left: crop.left, top: crop.top }])
      .png()
      .toFile(nextFull);
    currentInput = nextFull;
  }

  if (dryRun) continue;

  const outputPath = projectPath(outputConfig.outputImage);
  await mkdir(dirname(outputPath), { recursive: true });
  await rename(currentInput, outputPath);

  layer.originalSrc ??= outputConfig.baseImage;
  layer.src = outputConfig.outputImage;
  layer.contentHash = `district-art-${districtId}-site-inpaint-${new Date()
    .toISOString()
    .slice(0, 16)
    .replace("T", "-")
    .replace(":", "")}`;

  const box = renderBox(layer);
  const renderOutput = resolve(
    root,
    "public/art/town/districts-render",
    `${districtId}.webp`,
  );
  await sharp(outputPath)
    .extract(box)
    .webp({ quality: 88, effort: 6 })
    .toFile(renderOutput);

  console.log(
    JSON.stringify(
      {
        districtId,
        baseImage: outputConfig.baseImage,
        outputImage: outputConfig.outputImage,
        renderOutput,
        inpaints: districtInpaints.map((inpaint) => inpaint.id),
      },
      null,
      2,
    ),
  );
}

if (!dryRun) {
  await writeFile(districtArtPath, `${JSON.stringify(districtArt, null, 2)}\n`);
}

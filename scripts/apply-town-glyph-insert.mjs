#!/usr/bin/env node
import { mkdtemp, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
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

const id = args.get("id");
const gangliaBin = args.get("ganglia-bin") ?? "ganglia-studio";
const dryRun = args.get("dry-run") === "true";
const model = args.get("model") ?? "gpt-image-1";
const quality = args.get("quality") ?? "high";
const feather = args.get("feather") ?? "15";

if (!id) {
  throw new Error(
    "Usage: node scripts/apply-town-glyph-insert.mjs --id=<insert-id> [--input=<image>] [--output=<image>] [--ganglia-bin=<bin>] [--model=<model>] [--quality=<quality>] [--feather=<pixels>] [--dry-run]",
  );
}

const manifest = JSON.parse(
  await readFile(
    resolve(root, "docs/generated/town-glyph-inserts.v1.json"),
    "utf8",
  ),
);
const insert = manifest.inserts.find((item) => item.id === id);
if (!insert) {
  throw new Error(`Unknown glyph insert: ${id}`);
}

const input = args.get("input") ?? insert.sourceImage;
const output = args.get("output") ?? insert.outputImage;
const inputPath = resolve(root, "public", input.replace(/^\//, ""));
const maskPath = resolve(root, "public", insert.maskImage.replace(/^\//, ""));
const outputPath = resolve(root, "public", output.replace(/^\//, ""));
const commandArgs = [
  "insert-glyph",
  "--input",
  inputPath,
  "--mask",
  maskPath,
  "--description",
  insert.description,
  "--output",
  outputPath,
  "--model",
  model,
  "--quality",
  quality,
  "--feather",
  feather,
];

async function runGanglia(command, commandArgs) {
  const { stdout, stderr } = await execFileAsync(command, commandArgs, {
    maxBuffer: 1024 * 1024 * 20,
  });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

if (dryRun) {
  console.log(
    JSON.stringify({ command: gangliaBin, args: commandArgs }, null, 2),
  );
} else if (insert.authoringCrop) {
  const crop = insert.authoringCrop;
  const tempDir = await mkdtemp(join(tmpdir(), "willville-glyph-insert-"));
  const cropInput = join(tempDir, `${insert.id}-input.png`);
  const cropMask = join(tempDir, `${insert.id}-mask.png`);
  const cropOutput = join(tempDir, `${insert.id}-output.png`);
  await sharp(inputPath).extract(crop).toFile(cropInput);
  await sharp(maskPath).extract(crop).toFile(cropMask);
  await runGanglia(gangliaBin, [
    ...commandArgs.slice(0, 2),
    cropInput,
    ...commandArgs.slice(3, 4),
    cropMask,
    ...commandArgs.slice(5, 8),
    cropOutput,
    ...commandArgs.slice(9),
  ]);
  await sharp(inputPath)
    .composite([{ input: cropOutput, left: crop.left, top: crop.top }])
    .png()
    .toFile(outputPath);
  console.log(`composited crop into ${outputPath}`);
} else {
  await runGanglia(gangliaBin, commandArgs);
}

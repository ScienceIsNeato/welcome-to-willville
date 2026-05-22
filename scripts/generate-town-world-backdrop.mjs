#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveTownLayout } from "../lib/town-layout-engine.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(new URL("..", import.meta.url).pathname);
const layoutSource = JSON.parse(
  await readFile(resolve(root, "data/town-layout.v1.json"), "utf8"),
);
const layout = resolveTownLayout(layoutSource);

const world = { width: 2400, height: 1800 };
const townOffset = {
  x: (world.width - layout.size.width) / 2,
  y: (world.height - layout.size.height) / 2,
};

const svgOutput = resolve(root, "public/art/town/willville-land-v1.svg");
const pngOutput = resolve(root, "public/art/town/willville-land-v1.png");
const contractOutput = resolve(
  root,
  "docs/generated/town-world-backdrop.v1.json",
);

function translatePath(pathD, dx, dy) {
  return pathD.replace(
    /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g,
    (_match, x, y) =>
      `${(Number(x) + dx).toFixed(1)} ${(Number(y) + dy).toFixed(1)}`,
  );
}

const worldLandPath = translatePath(
  layout.landPath,
  townOffset.x,
  townOffset.y,
);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${world.width}" height="${world.height}" viewBox="0 0 ${world.width} ${world.height}">
  <defs>
    <linearGradient id="land-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#86b867" />
      <stop offset="46%" stop-color="#67a45c" />
      <stop offset="100%" stop-color="#8bbb64" />
    </linearGradient>
    <radialGradient id="land-light" cx="50%" cy="48%" r="46%">
      <stop offset="0%" stop-color="#d3ef98" stop-opacity="0.34" />
      <stop offset="72%" stop-color="#d3ef98" stop-opacity="0.06" />
      <stop offset="100%" stop-color="#234a31" stop-opacity="0.2" />
    </radialGradient>
    <pattern id="land-grain" patternUnits="userSpaceOnUse" width="112" height="112" patternTransform="rotate(7)">
      <rect width="112" height="112" fill="transparent" />
      <path d="M 0 28 H 112 M 0 64 H 112 M 0 100 H 112" fill="none" stroke="#d5df91" stroke-width="2.6" opacity="0.18" />
      <path d="M 24 0 V 112 M 78 0 V 112" fill="none" stroke="#2d643d" stroke-width="2" opacity="0.12" />
      <circle cx="20" cy="30" r="2.1" fill="#dfeaa8" opacity="0.18" />
      <circle cx="86" cy="78" r="1.8" fill="#24583b" opacity="0.16" />
    </pattern>
    <filter id="land-softness" x="-8%" y="-8%" width="116%" height="116%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="0.6" result="softAlpha" />
      <feComposite in="SourceGraphic" in2="softAlpha" operator="in" />
    </filter>
    <clipPath id="land-clip"><path d="${worldLandPath}" /></clipPath>
  </defs>
  <rect width="${world.width}" height="${world.height}" fill="transparent" />
  <g clip-path="url(#land-clip)" filter="url(#land-softness)">
    <rect width="${world.width}" height="${world.height}" fill="url(#land-fill)" />
    <rect width="${world.width}" height="${world.height}" fill="url(#land-light)" />
    <rect width="${world.width}" height="${world.height}" fill="url(#land-grain)" />
  </g>
</svg>
`;

const contract = {
  version: "willville-world-backdrop-v2-simple-land-mask",
  size: world,
  townOffset,
  townSize: layout.size,
  assets: {
    landSvg: "/art/town/willville-land-v1.svg",
    landPng: "/art/town/willville-land-v1.png",
  },
  sourceGeometry: {
    townLayoutVersion: layout.version,
    worldLandPath,
  },
};

await mkdir(dirname(svgOutput), { recursive: true });
await mkdir(dirname(contractOutput), { recursive: true });
await writeFile(svgOutput, svg);
await writeFile(contractOutput, `${JSON.stringify(contract, null, 2)}\n`);
await execFileAsync("rsvg-convert", [
  "--format=png",
  "--width",
  String(world.width),
  "--height",
  String(world.height),
  "--output",
  pngOutput,
  svgOutput,
]);
console.log(`wrote ${svgOutput}`);
console.log(`wrote ${pngOutput}`);
console.log(`wrote ${contractOutput}`);

#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  pointsToPath,
  resolveCanalSection,
  resolveTownLayout,
} from "../lib/town-layout-engine.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(new URL("..", import.meta.url).pathname);
const layout = resolveTownLayout(
  JSON.parse(await readFile(resolve(root, "data/town-layout.v1.json"), "utf8")),
);
const canalSection = resolveCanalSection(layout);
const svgOutput = resolve(root, "public/art/town/willville-isthmus-v1.svg");
const pngOutput = resolve(root, "public/art/town/willville-isthmus-v1.png");

const fills = {
  "mirrored-mile": "#d4a574",
  "the-zeitgeist": "#4a90d9",
  "the-graveyard": "#d97757",
  "halls-of-judgement": "#8a1c3b",
  "town-square": "#8b6f47",
  "slop-wharf": "#2da89c",
  "dogwallow-ramble-ii": "#c97c5d",
  "gates-of-hell": "#7a3da6",
};

function textureLines(district, index) {
  const bounds = district.polygon.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxY: Math.max(acc.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
  const lines = [];
  const spacing = 28 + (index % 3) * 5;
  for (let x = bounds.minX - 160; x <= bounds.maxX + 160; x += spacing) {
    lines.push(
      `<path d="M ${x.toFixed(1)} ${(bounds.minY - 90).toFixed(1)} L ${(x + 170).toFixed(1)} ${(bounds.maxY + 110).toFixed(1)}" />`,
    );
  }
  return `<g clip-path="url(#clip-${district.id})" class="district-hatching">${lines.join("\n")}</g>`;
}

const clips = layout.districts
  .map(
    (district) =>
      `<clipPath id="clip-${district.id}"><path d="${pointsToPath(district.polygon)}" /></clipPath>`,
  )
  .join("\n");

const districtLayers = layout.districts
  .map(
    (district, index) => `
  <path d="${pointsToPath(district.polygon)}" fill="${fills[district.id] ?? "#bda57a"}" opacity="0.86" />
  ${textureLines(district, index)}
  <path d="${pointsToPath(district.polygon)}" fill="none" stroke="rgba(36,28,20,0.3)" stroke-width="2.5" stroke-linejoin="round" />`,
  )
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.size.width}" height="${layout.size.height}" viewBox="0 0 ${layout.size.width} ${layout.size.height}">
  <defs>
    ${clips}
    <clipPath id="clip-town-footprint"><path d="${layout.townFootprintPath}" /></clipPath>
    <clipPath id="clip-canal-section"><path d="${pointsToPath(canalSection.polygon)}" /></clipPath>
    <filter id="soft-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#1b1108" flood-opacity="0.26" />
    </filter>
    <pattern id="field-grain" patternUnits="userSpaceOnUse" width="42" height="42">
      <path d="M 0 18 H 42 M 0 37 H 42" stroke="#8fbd74" stroke-width="2" opacity="0.25" />
      <circle cx="8" cy="9" r="1.5" fill="#406a43" opacity="0.18" />
      <circle cx="31" cy="26" r="1.2" fill="#dbe9ac" opacity="0.2" />
    </pattern>
    <style>
      .district-hatching path {
        fill: none;
        stroke: rgba(245, 230, 200, 0.18);
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-dasharray: 7 14;
      }
    </style>
  </defs>

  <rect width="${layout.size.width}" height="${layout.size.height}" fill="transparent" />
  <g filter="url(#soft-shadow)">
    <path d="${layout.landPath}" fill="#6f9a65" stroke="#2d5e46" stroke-width="15" stroke-linejoin="round" />
    <path d="${layout.landPath}" fill="url(#field-grain)" opacity="0.45" />
    <path d="${layout.shoreWallPath}" fill="none" stroke="#d8c391" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="18 9" opacity="0.72" />
    <g clip-path="url(#clip-town-footprint)">
      <path d="${layout.townFootprintPath}" fill="#6f8f65" opacity="0.92" />
      <path d="${layout.townFootprintPath}" fill="url(#field-grain)" opacity="0.18" />
      ${districtLayers}
    </g>
    <path d="${pointsToPath(canalSection.polygon)}" fill="#123a5e" opacity="0.96" />
    <path d="${pointsToPath(canalSection.polygon)}" fill="#1f4f7a" opacity="0.94" />
    <path d="${layout.canal.pathD}" clip-path="url(#clip-canal-section)" fill="none" stroke="#4f9dcc" stroke-width="10" stroke-linecap="butt" stroke-dasharray="24 30" opacity="0.42" />
  </g>
</svg>
`;

await mkdir(dirname(svgOutput), { recursive: true });
await writeFile(svgOutput, svg);
await execFileAsync("rsvg-convert", [
  "--format=png",
  "--width",
  String(layout.size.width),
  "--height",
  String(layout.size.height),
  "--output",
  pngOutput,
  svgOutput,
]);
console.log(`wrote ${svgOutput}`);
console.log(`wrote ${pngOutput}`);

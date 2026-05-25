#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pointsToPath, resolveTownLayout } from "../lib/town-layout-engine.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const source = resolve(root, "data/town-layout.v1.json");
const output = resolve(root, "docs/generated/willville-layout-preview.svg");
const layout = resolveTownLayout(JSON.parse(await readFile(source, "utf8")));

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

const districts = layout.districts
  .map(
    (district) => `
  <path d="${pointsToPath(district.polygon)}" fill="${fills[district.id]}" opacity="0.72" stroke="#1f1712" stroke-width="3" />
  <path d="${pointsToPath(district.polygon)}" fill="none" stroke="#f3dfb1" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" opacity="0.74" />
  <text x="${district.label.x}" y="${district.label.y}" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#f5e6c8" stroke="#1f1712" stroke-width="4" paint-order="stroke">${district.displayName}</text>`,
  )
  .join("\n");

const rails = layout.lines
  .map(
    (line) =>
      `<path d="${line.path}" fill="none" stroke="#f5e6c8" stroke-width="4" stroke-dasharray="5 12" opacity="0.55" />`,
  )
  .join("\n");

const sign = layout.landmarks.welcomeSign;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.size.width} ${layout.size.height}">
  <rect width="${layout.size.width}" height="${layout.size.height}" fill="#0b3a55" />
  <path d="${layout.landPath}" fill="#6f9a65" stroke="#2d5e46" stroke-width="16" />
  <path d="${layout.shoreWallPath}" fill="none" stroke="#d8c391" stroke-width="12" stroke-dasharray="18 9" opacity="0.75" />
${districts}
  <path d="${layout.canal.pathD}" fill="none" stroke="#123a5e" stroke-width="86" stroke-linecap="round" />
  <path d="${layout.canal.pathD}" fill="none" stroke="#1f4f7a" stroke-width="68" stroke-linecap="round" />
  <path d="${layout.canal.pathD}" fill="none" stroke="#3a82b8" stroke-width="9" stroke-linecap="round" stroke-dasharray="24 30" opacity="0.55" />
${rails}
  <g transform="translate(${sign.x}, ${sign.y}) rotate(-8)">
    <path d="${sign.pathD}" transform="translate(${-sign.x}, ${-sign.y})" fill="#f5e6c8" stroke="#4c3320" stroke-width="6" />
    <text x="0" y="3" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="42" font-weight="900" letter-spacing="2" fill="#4c3320" stroke="#f5e6c8" stroke-width="5" paint-order="stroke">WELCOME TO WILLVILLE</text>
  </g>
</svg>
`;

await mkdir(dirname(output), { recursive: true });
await writeFile(output, svg);
console.log(`wrote ${output}`);

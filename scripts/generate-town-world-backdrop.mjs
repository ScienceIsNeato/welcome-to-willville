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

const svgOutput = resolve(root, "public/art/town/willville-world-v1.svg");
const pngOutput = resolve(root, "public/art/town/willville-world-v1.png");
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

const townLandPath = translatePath(layout.landPath, townOffset.x, townOffset.y);
const townShorePath = translatePath(
  layout.shoreWallPath,
  townOffset.x,
  townOffset.y,
);
const canalPath = translatePath(layout.canal.pathD, townOffset.x, townOffset.y);

const isthmusPath =
  "M 505 -260 C 610 20, 675 205, 664 382 C 650 610, 582 760, 676 915 C 748 1032, 762 1212, 695 1450 C 660 1570, 662 1715, 710 2060 L 1834 2060 C 1775 1755, 1788 1588, 1844 1434 C 1934 1206, 1916 1032, 1816 882 C 1715 730, 1740 570, 1814 362 C 1880 172, 1838 10, 1700 -260 Z";

const westCoastPath =
  "M 505 -260 C 610 20, 675 205, 664 382 C 650 610, 582 760, 676 915 C 748 1032, 762 1212, 695 1450 C 660 1570, 662 1715, 710 2060";

const eastCoastPath =
  "M 1700 -260 C 1838 10, 1880 172, 1814 362 C 1740 570, 1715 730, 1816 882 C 1916 1032, 1934 1206, 1844 1434 C 1788 1588, 1775 1755, 1834 2060";

const riverPath =
  "M 1188 -140 C 1115 130, 1212 306, 1168 462 C 1110 660, 1252 790, 1208 930 C 1174 1040, 1100 1124, 1138 1262 C 1180 1418, 1288 1566, 1234 1930";

const farmBands = [
  "M 730 150 C 965 215, 1265 214, 1650 120",
  "M 672 412 C 930 492, 1210 500, 1768 390",
  "M 640 696 C 920 625, 1245 645, 1798 740",
  "M 700 1238 C 1010 1118, 1365 1135, 1842 1288",
  "M 690 1510 C 1010 1415, 1395 1450, 1818 1588",
];

const hillMarks = [
  { x: 735, y: 250, s: 1.1 },
  { x: 1540, y: 255, s: 0.92 },
  { x: 700, y: 1345, s: 1 },
  { x: 1588, y: 1420, s: 1.18 },
  { x: 980, y: 1640, s: 0.78 },
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${world.width}" height="${world.height}" viewBox="0 0 ${world.width} ${world.height}">
  <defs>
    <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a5075" />
      <stop offset="48%" stop-color="#073b61" />
      <stop offset="100%" stop-color="#042844" />
    </linearGradient>
    <radialGradient id="sea-glow" cx="50%" cy="46%" r="68%">
      <stop offset="0%" stop-color="#2d8fb0" stop-opacity="0.18" />
      <stop offset="78%" stop-color="#053456" stop-opacity="0.05" />
      <stop offset="100%" stop-color="#010a1a" stop-opacity="0.38" />
    </radialGradient>
    <linearGradient id="isthmus-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#79ad62" />
      <stop offset="45%" stop-color="#5f9658" />
      <stop offset="100%" stop-color="#7fb15e" />
    </linearGradient>
    <filter id="soft-world-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#041b20" flood-opacity="0.32" />
    </filter>
    <pattern id="water-ripples" patternUnits="userSpaceOnUse" width="220" height="160" patternTransform="rotate(-8)">
      <path d="M -40 48 C 20 18, 76 18, 132 48 S 245 78, 286 46" fill="none" stroke="#7fc6d3" stroke-width="4" opacity="0.14" />
      <path d="M -28 116 C 35 86, 92 86, 154 116 S 260 144, 304 110" fill="none" stroke="#e3f6e9" stroke-width="2" opacity="0.09" />
    </pattern>
    <pattern id="field-grain" patternUnits="userSpaceOnUse" width="118" height="118" patternTransform="rotate(7)">
      <rect width="118" height="118" fill="transparent" />
      <path d="M 0 22 H 118 M 0 58 H 118 M 0 94 H 118" fill="none" stroke="#a5c977" stroke-width="3" opacity="0.27" />
      <path d="M 24 0 V 118 M 74 0 V 118" fill="none" stroke="#376841" stroke-width="2" opacity="0.18" />
      <circle cx="22" cy="32" r="2.2" fill="#dbe7a5" opacity="0.2" />
      <circle cx="83" cy="78" r="1.8" fill="#2f613e" opacity="0.2" />
    </pattern>
    <clipPath id="isthmus-clip"><path d="${isthmusPath}" /></clipPath>
    <clipPath id="town-land-clip"><path d="${townLandPath}" /></clipPath>
  </defs>

  <rect width="${world.width}" height="${world.height}" fill="url(#sea)" />
  <rect width="${world.width}" height="${world.height}" fill="url(#water-ripples)" />
  <rect width="${world.width}" height="${world.height}" fill="url(#sea-glow)" />

  <g filter="url(#soft-world-shadow)">
    <path d="${isthmusPath}" fill="url(#isthmus-fill)" />
    <path d="${isthmusPath}" fill="url(#field-grain)" opacity="0.58" />
    ${farmBands
      .map(
        (path) =>
          `<path d="${path}" fill="none" stroke="#d5cf8a" stroke-width="15" stroke-linecap="round" opacity="0.28" clip-path="url(#isthmus-clip)" />`,
      )
      .join("\n    ")}
    <path d="${westCoastPath}" fill="none" stroke="#97cf6a" stroke-width="17" stroke-linecap="round" opacity="0.72" />
    <path d="${eastCoastPath}" fill="none" stroke="#97cf6a" stroke-width="17" stroke-linecap="round" opacity="0.72" />
    <path d="${westCoastPath}" fill="none" stroke="#205c48" stroke-width="6" stroke-linecap="round" opacity="0.44" />
    <path d="${eastCoastPath}" fill="none" stroke="#205c48" stroke-width="6" stroke-linecap="round" opacity="0.44" />
    <path d="${riverPath}" fill="none" stroke="#146fb4" stroke-width="13" stroke-linecap="round" opacity="0.64" clip-path="url(#isthmus-clip)" />
    <path d="${riverPath}" fill="none" stroke="#73bdd4" stroke-width="4" stroke-linecap="round" stroke-dasharray="30 36" opacity="0.42" clip-path="url(#isthmus-clip)" />
    ${hillMarks
      .map(
        ({ x, y, s }) => `
    <g transform="translate(${x} ${y}) scale(${s})" opacity="0.24" clip-path="url(#isthmus-clip)">
      <path d="M -118 72 C -78 -8, -20 -62, 44 -42 C 96 -26, 126 30, 152 82" fill="none" stroke="#6b4d21" stroke-width="12" stroke-linecap="round" />
      <path d="M -66 80 C -38 22, 8 6, 58 42" fill="none" stroke="#f1ce73" stroke-width="7" stroke-linecap="round" />
    </g>`,
      )
      .join("\n")}
    <path d="${townLandPath}" fill="#5f9658" opacity="0.72" />
    <path d="${townLandPath}" fill="url(#field-grain)" opacity="0.36" />
    <path d="${townShorePath}" fill="none" stroke="#d8c391" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="18 9" opacity="0.48" />
    <path d="${canalPath}" fill="none" stroke="#0c345e" stroke-width="92" stroke-linecap="round" stroke-linejoin="round" opacity="0.82" />
    <path d="${canalPath}" fill="none" stroke="#1e6ea0" stroke-width="62" stroke-linecap="round" stroke-linejoin="round" opacity="0.72" />
  </g>
</svg>
`;

const contract = {
  version: "willville-world-backdrop-v1",
  size: world,
  townOffset,
  townSize: layout.size,
  assets: {
    svg: "/art/town/willville-world-v1.svg",
    png: "/art/town/willville-world-v1.png",
  },
  sourceGeometry: {
    townLayoutVersion: layout.version,
    translatedLandPath: townLandPath,
    translatedShoreWallPath: townShorePath,
    translatedCanalPath: canalPath,
    isthmusPath,
    westCoastPath,
    eastCoastPath,
    riverPath,
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

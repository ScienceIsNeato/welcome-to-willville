#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { hashStr } from "../lib/town-layout-engine.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(new URL("..", import.meta.url).pathname);
const source = await readFile(
  resolve(root, "lib/willville.heuristics.ts"),
  "utf8",
);
const outputDir = resolve(root, "public/art/stops");
const manifestPath = resolve(root, "data/town-site-sprites.v1.json");

const DISTRICT_PALETTES = {
  "mirrored-mile": ["#d4a574", "#f2ddb0", "#6d4b2f"],
  "the-zeitgeist": ["#4a90d9", "#b8e7ff", "#244f7a"],
  "the-graveyard": ["#d97757", "#f0b184", "#3f332a"],
  "halls-of-judgement": ["#8a1c3b", "#d9a0a8", "#4b1726"],
  "town-square": ["#8b6f47", "#d9c18b", "#4d3b28"],
  "slop-wharf": ["#2da89c", "#a1eadc", "#1c5d62"],
  "dogwallow-ramble-ii": ["#c97c5d", "#f0c095", "#6b3e2f"],
  "gates-of-hell": ["#7a3da6", "#cba1ff", "#3c2358"],
};

const ICON_HINTS = new Map([
  ["book", "library"],
  ["coffin", "monument"],
  ["pipe organ", "tower"],
  ["kennel", "workshop"],
  ["compiler forge", "forge"],
  ["gene greenhouse", "greenhouse"],
  ["slop mop", "depot"],
  ["bucket", "depot"],
  ["mop", "depot"],
  ["court", "civic"],
  ["scaffold", "civic"],
  ["navigation", "tower"],
  ["vampire", "monument"],
  ["tracker", "gate"],
]);

function parseStops(text) {
  const stops = [];
  const objectRegex = /\{\s*repo:\s*"([^"]+)"([\s\S]*?)\n\s*\}/g;
  let match;
  while ((match = objectRegex.exec(text))) {
    const body = match[2];
    const stopId = body.match(/stopId:\s*"([^"]+)"/)?.[1];
    const district = body.match(/district:\s*"([^"]+)"/)?.[1];
    const glyph = body.match(/glyph:\s*\{[\s\S]*?label:\s*"([^"]+)"/)?.[1];
    if (stopId && district) {
      stops.push({
        repo: match[1],
        stopId,
        district,
        glyph: glyph ?? "workshop",
      });
    }
  }
  return stops;
}

function structureKind(glyph) {
  const lower = glyph.toLowerCase();
  for (const [needle, kind] of ICON_HINTS) {
    if (lower.includes(needle)) return kind;
  }
  if (lower.includes("gate")) return "gate";
  if (lower.includes("green")) return "greenhouse";
  if (lower.includes("forge")) return "forge";
  if (lower.includes("book")) return "library";
  return "workshop";
}

function makeSvg(stop) {
  const [base, light, dark] = DISTRICT_PALETTES[stop.district] ?? [
    "#b89b72",
    "#ead7b4",
    "#5c4936",
  ];
  const seed = hashStr(stop.stopId);
  const kind = structureKind(stop.glyph);
  const roof = seed % 2 === 0 ? "#5b3326" : "#38475a";
  const accent = seed % 3 === 0 ? "#f2c94c" : light;
  const chimneyX = 54 + (seed % 14);
  const windowCount = 2 + (seed % 3);
  const windows = Array.from({ length: windowCount }, (_, index) => {
    const x = 25 + index * 16;
    return `<rect x="${x}" y="49" width="8" height="10" rx="1.5" fill="${accent}" opacity="0.9" />`;
  }).join("");

  const body =
    kind === "tower"
      ? `<rect x="34" y="25" width="30" height="54" rx="4" fill="${base}" stroke="${dark}" stroke-width="4" />
         <polygon points="29,29 49,10 69,29" fill="${roof}" stroke="${dark}" stroke-width="4" />
         <rect x="45" y="38" width="9" height="18" rx="2" fill="${accent}" />`
      : kind === "gate"
        ? `<path d="M 20 80 V 44 C 20 28 34 18 50 18 C 66 18 80 28 80 44 V 80 H 66 V 47 C 66 39 59 33 50 33 C 41 33 34 39 34 47 V 80 Z" fill="${base}" stroke="${dark}" stroke-width="4" />
           <circle cx="50" cy="48" r="7" fill="${accent}" />`
        : kind === "greenhouse"
          ? `<path d="M 18 78 V 48 C 18 30 32 18 50 18 C 68 18 82 30 82 48 V 78 Z" fill="${light}" opacity="0.78" stroke="${dark}" stroke-width="4" />
             <path d="M 26 78 V 49 C 26 38 36 28 50 28 C 64 28 74 38 74 49 V 78" fill="none" stroke="${base}" stroke-width="3" />
             <path d="M 50 28 V 78 M 20 55 H 80" stroke="${dark}" stroke-width="2" opacity="0.55" />`
          : kind === "forge"
            ? `<rect x="18" y="43" width="60" height="35" rx="5" fill="${base}" stroke="${dark}" stroke-width="4" />
               <path d="M 26 43 C 30 23 68 23 74 43 Z" fill="${roof}" stroke="${dark}" stroke-width="4" />
               <rect x="${chimneyX}" y="21" width="12" height="23" rx="2" fill="${dark}" />
               <circle cx="36" cy="61" r="9" fill="#ff8b3d" opacity="0.8" />`
            : kind === "library"
              ? `<rect x="18" y="39" width="64" height="39" rx="5" fill="${base}" stroke="${dark}" stroke-width="4" />
                 <polygon points="14,42 50,20 86,42" fill="${roof}" stroke="${dark}" stroke-width="4" />
                 <rect x="29" y="50" width="8" height="21" fill="${light}" />
                 <rect x="46" y="48" width="8" height="23" fill="${accent}" />
                 <rect x="63" y="51" width="8" height="20" fill="${light}" />`
              : kind === "depot"
                ? `<rect x="17" y="43" width="66" height="35" rx="5" fill="${base}" stroke="${dark}" stroke-width="4" />
                   <polygon points="14,45 50,22 86,45" fill="${roof}" stroke="${dark}" stroke-width="4" />
                   <path d="M 33 74 C 42 59 58 59 67 74" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round" />
                   <circle cx="27" cy="62" r="5" fill="${accent}" />`
                : `<rect x="18" y="42" width="64" height="36" rx="5" fill="${base}" stroke="${dark}" stroke-width="4" />
                   <polygon points="14,44 50,22 86,44" fill="${roof}" stroke="${dark}" stroke-width="4" />
                   <rect x="${chimneyX}" y="25" width="10" height="20" rx="2" fill="${dark}" />
                   ${windows}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#100b08" flood-opacity="0.45" />
  </filter>
  <ellipse cx="50" cy="82" rx="34" ry="8" fill="#150f0b" opacity="0.28" />
  <g filter="url(#shadow)">
    ${body}
    <path d="M 20 78 H 80" stroke="#20170f" stroke-width="4" stroke-linecap="round" opacity="0.42" />
  </g>
</svg>`;
}

await mkdir(outputDir, { recursive: true });
const stops = parseStops(source);
const manifest = {
  version: "town-site-sprites-v1",
  frame: { width: 100, height: 100, anchorX: 50, anchorY: 78 },
  generatedFrom: "lib/willville.heuristics.ts",
  sprites: [],
};

for (const stop of stops) {
  const fileBase = stop.stopId.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const svgPath = resolve(outputDir, `${fileBase}.svg`);
  const pngPath = resolve(outputDir, `${fileBase}.png`);
  await writeFile(svgPath, makeSvg(stop));
  await execFileAsync("rsvg-convert", [
    "--format=png",
    "--width=100",
    "--height=100",
    "--output",
    pngPath,
    svgPath,
  ]);
  manifest.sprites.push({
    stopId: stop.stopId,
    district: stop.district,
    kind: structureKind(stop.glyph),
    src: `/art/stops/${fileBase}.png`,
    width: 100,
    height: 100,
    anchorX: 50,
    anchorY: 78,
  });
}

await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${manifest.sprites.length} site sprites to ${outputDir}`);
console.log(`wrote ${manifestPath}`);

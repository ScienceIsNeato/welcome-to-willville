#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(new URL("..", import.meta.url).pathname);
const svgOutput = resolve(root, "public/art/sprites/mop-worker.svg");
const pngOutput = resolve(root, "public/art/sprites/mop-worker.png");

const frame = { width: 48, height: 48 };
const rows = ["walk", "sweep", "idle", "bucket"];
const cols = 8;
const size = {
  width: frame.width * cols,
  height: frame.height * rows.length,
};

function frameSvg(col, row, mode) {
  const x = col * frame.width;
  const y = row * frame.height;
  const cycle = col / cols;
  const bob = Math.sin(cycle * Math.PI * 2) * 2.2;
  const lean = Math.sin(cycle * Math.PI * 2) * 3.5;
  const sweep = Math.sin(cycle * Math.PI * 2) * 10;
  const bucketLift = mode === "bucket" ? Math.sin(cycle * Math.PI * 2) * 2 : 0;
  const mopAngle =
    mode === "sweep" ? -26 + sweep : mode === "idle" ? -18 : -34 + lean;
  const handleX = mode === "bucket" ? -2 : 7;
  const bucketOpacity = mode === "bucket" ? 1 : 0.28;
  const sudsOpacity = mode === "sweep" ? 0.78 : 0.24;

  return `<g transform="translate(${x + 24} ${y + 25 + bob})">
    <ellipse cx="0" cy="14" rx="14" ry="4" fill="#0c1f2a" opacity="0.28" />
    <g transform="rotate(${lean * 0.7})">
      <path d="M -8 -7 C -11 -15, -4 -20, 3 -17 C 9 -14, 10 -7, 5 -2 Z" fill="#f1d2a2" stroke="#3a2114" stroke-width="1.5" />
      <path d="M -11 -2 C -5 -9, 7 -9, 13 -1 L 10 13 C 4 17, -6 17, -12 11 Z" fill="#38546b" stroke="#17293a" stroke-width="2" />
      <path d="M -12 4 C -5 7, 4 7, 12 3" fill="none" stroke="#72c7d0" stroke-width="3" stroke-linecap="round" opacity="0.8" />
      <path d="M -7 13 L -14 22 M 7 13 L 15 21" fill="none" stroke="#2a1b17" stroke-width="3" stroke-linecap="round" />
      <path d="M -10 2 L -19 10 M 10 2 L 18 9" fill="none" stroke="#2a1b17" stroke-width="2.5" stroke-linecap="round" />
    </g>
    <g transform="translate(${handleX} -2) rotate(${mopAngle})">
      <path d="M 0 -20 L 0 24" fill="none" stroke="#7b4b25" stroke-width="3" stroke-linecap="round" />
      <path d="M -8 20 C -4 15, 5 15, 9 20 C 5 27, -5 27, -8 20 Z" fill="#d7d5bd" stroke="#6c6754" stroke-width="1.5" />
      <path d="M -4 20 L -9 27 M 0 19 L 0 29 M 4 20 L 9 27" fill="none" stroke="#f4f2da" stroke-width="1.2" stroke-linecap="round" />
    </g>
    <g transform="translate(${-16 + bucketLift} ${5 - bucketLift})" opacity="${bucketOpacity}">
      <path d="M -5 2 H 7 L 5 13 H -3 Z" fill="#1f85a8" stroke="#0c3850" stroke-width="1.5" />
      <path d="M -5 2 C -2 -3, 4 -3, 7 2" fill="none" stroke="#d8e8e1" stroke-width="1.2" />
      <circle cx="2" cy="5" r="1.4" fill="#d9f7ff" opacity="0.75" />
    </g>
    <g opacity="${sudsOpacity}">
      <circle cx="${10 + sweep * 0.16}" cy="21" r="1.8" fill="#dff8ff" />
      <circle cx="${15 + sweep * 0.1}" cy="18" r="1.2" fill="#bcefff" />
      <circle cx="${-8 - sweep * 0.1}" cy="20" r="1.1" fill="#dff8ff" />
    </g>
  </g>`;
}

const frames = rows
  .flatMap((mode, row) =>
    Array.from({ length: cols }, (_unused, col) => frameSvg(col, row, mode)),
  )
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">
  <rect width="${size.width}" height="${size.height}" fill="transparent" />
  ${frames}
</svg>
`;

await mkdir(dirname(svgOutput), { recursive: true });
await writeFile(svgOutput, svg);
await execFileAsync("rsvg-convert", [
  "--format=png",
  "--width",
  String(size.width),
  "--height",
  String(size.height),
  "--output",
  pngOutput,
  svgOutput,
]);
console.log(`wrote ${svgOutput}`);
console.log(`wrote ${pngOutput}`);

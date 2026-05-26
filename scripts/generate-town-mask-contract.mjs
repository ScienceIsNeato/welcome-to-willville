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
const layoutSource = JSON.parse(
  await readFile(resolve(root, "data/town-layout.v1.json"), "utf8"),
);
const layout = resolveTownLayout(layoutSource);
const canalSection = resolveCanalSection(layoutSource);
const output = resolve(root, "docs/generated/town-mask-contract.v1.json");
const maskRoot = resolve(root, "public/art/town/masks");

function boundsFor(points) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function svgMask(path, options = {}) {
  const fill = options.fill ?? "white";
  const background = options.background ?? "black";
  const extra = options.extra ?? "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.size.width}" height="${layout.size.height}" viewBox="0 0 ${layout.size.width} ${layout.size.height}">
  <rect width="${layout.size.width}" height="${layout.size.height}" fill="${background}" />
  <path d="${path}" fill="${fill}" ${extra} />
</svg>
`;
}

function svgTownFootprintClippedMask(basePath, options = {}) {
  const subtractPath = options.subtractPath;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.size.width}" height="${layout.size.height}" viewBox="0 0 ${layout.size.width} ${layout.size.height}">
  <defs>
    <clipPath id="town-footprint-clip"><path d="${layout.townFootprintPath}" /></clipPath>
  </defs>
  <rect width="${layout.size.width}" height="${layout.size.height}" fill="black" />
  <path d="${basePath}" fill="white" clip-path="url(#town-footprint-clip)" />
  ${subtractPath ? `<path d="${subtractPath}" fill="black" />` : ""}
</svg>
`;
}

function svgStrokeMask(path, options = {}) {
  const width = options.width ?? 24;
  const clipPath = options.clipPath;
  const subtractPath = options.subtractPath;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.size.width}" height="${layout.size.height}" viewBox="0 0 ${layout.size.width} ${layout.size.height}">
  ${
    clipPath
      ? `<defs><clipPath id="stroke-mask-clip"><path d="${clipPath}" /></clipPath></defs>`
      : ""
  }
  <rect width="${layout.size.width}" height="${layout.size.height}" fill="black" />
  <path d="${path}" fill="none" stroke="white" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${clipPath ? 'clip-path="url(#stroke-mask-clip)"' : ""} />
  ${subtractPath ? `<path d="${subtractPath}" fill="black" />` : ""}
</svg>
`;
}

async function writeMask(relativePath, svg) {
  const svgOutput = resolve(maskRoot, relativePath.replace(/\.png$/, ".svg"));
  const pngOutput = resolve(maskRoot, relativePath);
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
  return {
    png: `/art/town/masks/${relativePath}`,
    svg: `/art/town/masks/${relativePath.replace(/\.png$/, ".svg")}`,
  };
}

async function connectedComponentsForMask(relativePath) {
  const pngOutput = resolve(maskRoot, relativePath);
  const { stdout } = await execFileAsync("magick", [
    pngOutput,
    "-threshold",
    "50%",
    "-define",
    "connected-components:verbose=true",
    "-connected-components",
    "8",
    "null:",
  ]);
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(
        /^(\d+):\s+(\d+)x(\d+)\+(-?\d+)\+(-?\d+)\s+([\d.]+),([\d.]+)\s+([\deE+.-]+)\s+(.+)$/,
      );
      if (!match) return null;
      const [, id, width, height, x, y, cx, cy, area, color] = match;
      if (color !== "gray(255)" && color !== "srgb(255,255,255)") {
        return null;
      }
      return {
        id: Number(id),
        bounds: {
          x: Number(x),
          y: Number(y),
          width: Number(width),
          height: Number(height),
        },
        centroid: {
          x: Number(cx),
          y: Number(cy),
        },
        area: Number(area),
      };
    })
    .filter((component) => component && component.area > 64)
    .sort((a, b) => b.area - a.area)
    .map((component, index) => ({
      ...component,
      id: `${relativePath
        .replace(/\.png$/, "")
        .split("/")
        .pop()}-${index + 1}`,
    }));
}

const districtMasks = new Map();
for (const district of layout.districts) {
  const districtPath = pointsToPath(district.polygon);
  const mask = await writeMask(
    `districts/${district.id}.png`,
    svgTownFootprintClippedMask(districtPath),
  );
  const artMaskRelativePath = `district-art/${district.id}.png`;
  const artMask = await writeMask(
    artMaskRelativePath,
    svgTownFootprintClippedMask(districtPath, {
      subtractPath: pointsToPath(canalSection.polygon),
    }),
  );
  districtMasks.set(district.id, {
    mask,
    artMask,
    artComponents: await connectedComponentsForMask(artMaskRelativePath),
  });
}

const globalMasks = {
  land: await writeMask("land.png", svgMask(layout.landPath)),
  townFootprint: await writeMask(
    "town-footprint.png",
    svgMask(layout.townFootprintPath),
  ),
  shoreWall: await writeMask(
    "shore-wall.png",
    svgStrokeMask(layout.landPath, { width: 24 }),
  ),
  canal: await writeMask(
    "canal.png",
    svgStrokeMask(layout.canal.pathD, { clipPath: layout.landPath, width: 86 }),
  ),
  canalSection: await writeMask(
    "canal-section.png",
    svgTownFootprintClippedMask(pointsToPath(canalSection.polygon)),
  ),
  canalBanks: await writeMask(
    "canal-banks.png",
    svgStrokeMask(
      `${canalSection.northBankPath} ${canalSection.southBankPath}`,
      {
        clipPath: layout.townFootprintPath,
        width: 10,
      },
    ),
  ),
  districtWalls: await writeMask(
    "district-walls.png",
    svgStrokeMask(
      layout.districts
        .map((district) => pointsToPath(district.wallLoop))
        .join(" "),
      {
        clipPath: layout.townFootprintPath,
        subtractPath: pointsToPath(canalSection.polygon),
        width: 24,
      },
    ),
  ),
};

const contract = {
  version: layout.version,
  size: layout.size,
  generation: layout.generation,
  landPath: layout.landPath,
  shoreWallPath: layout.shoreWallPath,
  townFootprintPath: layout.townFootprintPath,
  canalPath: layout.canal.pathD,
  canalSection: {
    id: canalSection.id,
    displayName: canalSection.displayName,
    width: canalSection.width,
    siteClearance: canalSection.siteClearance,
    pointCount: canalSection.polygon.length,
    bounds: boundsFor(canalSection.polygon),
    centerline: canalSection.centerline,
    northBank: canalSection.northBank,
    southBank: canalSection.southBank,
    polygon: canalSection.polygon,
    path: pointsToPath(canalSection.polygon),
    northBankPath: canalSection.northBankPath,
    southBankPath: canalSection.southBankPath,
  },
  masks: globalMasks,
  districts: layout.districts.map((district) => ({
    id: district.id,
    displayName: district.displayName,
    label: district.label,
    sourceVertexIds: district.vertexIds,
    pointCount: district.polygon.length,
    bounds: boundsFor(district.polygon),
    path: pointsToPath(district.polygon),
    points: district.polygon,
    mask: districtMasks.get(district.id).mask,
    artMask: districtMasks.get(district.id).artMask,
    artComponents: districtMasks.get(district.id).artComponents,
  })),
  landmarks: layout.landmarks,
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(contract, null, 2)}\n`);
console.log(`wrote ${output}`);

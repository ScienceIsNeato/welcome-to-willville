#!/usr/bin/env node
/**
 * resolve-site-positions.mjs — Deterministic collision resolver for Willville stops
 *
 * Reads heuristic positions from willville.heuristics.ts, resolves overlaps using
 * force-directed relaxation, and writes the resolved positions back.
 *
 * Usage:
 *   node scripts/resolve-site-positions.mjs              # preview changes
 *   node scripts/resolve-site-positions.mjs --apply      # write changes to heuristics file
 *   node scripts/resolve-site-positions.mjs --verbose    # show iteration details
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveTownLayout } from "../lib/town-layout-engine.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const heuristicsPath = resolve(root, "lib/willville.heuristics.ts");
const layoutPath = resolve(root, "data/town-layout.v1.json");
const spritePath = resolve(root, "data/town-site-sprites.v1.json");

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const verbose = args.has("--verbose");

// ── Config ──────────────────────────────────────────────────────────────────

const ITERATIONS = 80;
const MIN_LABEL_SPACING_X = 90; // min horizontal distance between label centers
const MIN_LABEL_SPACING_Y = 36; // min vertical distance
const MIN_SPRITE_SPACING = 50; // min distance between sprite centers
const DISTRICT_LABEL_REPEL = 70; // min distance from district label center
const REPEL_STRENGTH = 0.22; // how far to push per iteration (0-1, gentler = more stable)
const DISTRICT_MARGIN = 15; // stay this far inside district bounds
const SEED = 42; // deterministic jitter seed

// ── Load data ───────────────────────────────────────────────────────────────

const layout = JSON.parse(readFileSync(layoutPath, "utf8"));
const resolved = resolveTownLayout(layout);
const sprites = JSON.parse(readFileSync(spritePath, "utf8"));
const spriteMap = new Map(sprites.sprites.map((s) => [s.stopId, s]));

const heuristicsSrc = readFileSync(heuristicsPath, "utf8");

// Parse stops from heuristics
const stops = [];
const stopRegex =
  /\{\s*repo:\s*"([^"]+)"[\s\S]*?stopId:\s*"([^"]+)"[\s\S]*?district:\s*"([^"]+)"[\s\S]*?position:\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+)\s*\}/g;
let match;
while ((match = stopRegex.exec(heuristicsSrc))) {
  const [, repo, stopId, district, x, y] = match;
  const sprite = spriteMap.get(stopId);
  const label = repo.split("/").pop() ?? stopId;
  stops.push({
    stopId,
    district,
    repo,
    x: +x,
    y: +y,
    origX: +x,
    origY: +y,
    labelW: Math.max(72, label.length * 8 + 20),
    labelH: 24,
    spriteW: sprite ? 68 : 12,
    spriteH: sprite ? 68 : 12,
  });
}

// Build district bounds lookup
const districtBounds = new Map();
for (const d of resolved.districts) {
  const xs = d.polygon.map((p) => p.x);
  const ys = d.polygon.map((p) => p.y);
  districtBounds.set(d.id, {
    minX: Math.min(...xs) + DISTRICT_MARGIN,
    maxX: Math.max(...xs) - DISTRICT_MARGIN,
    minY: Math.min(...ys) + DISTRICT_MARGIN,
    maxY: Math.max(...ys) - DISTRICT_MARGIN,
    labelX: d.label.x,
    labelY: d.label.y,
  });
}

// ── Seeded random ───────────────────────────────────────────────────────────

let rngState = SEED;
function seededRandom() {
  rngState = (rngState * 1664525 + 1013904223) & 0xffffffff;
  return (rngState >>> 0) / 0xffffffff;
}

// ── Force-directed relaxation ───────────────────────────────────────────────

function computeOverlaps() {
  let count = 0;
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      const a = stops[i];
      const b = stops[j];
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      if (dx < MIN_LABEL_SPACING_X && dy < MIN_LABEL_SPACING_Y) count++;
    }
  }
  return count;
}

console.log(
  `Loaded ${stops.length} stops across ${districtBounds.size} districts`,
);
console.log(`Initial overlaps: ${computeOverlaps()}`);
console.log(`Running ${ITERATIONS} relaxation iterations...`);

for (let iter = 0; iter < ITERATIONS; iter++) {
  let totalForce = 0;

  for (let i = 0; i < stops.length; i++) {
    let fx = 0;
    let fy = 0;
    const a = stops[i];
    const bounds = districtBounds.get(a.district);
    if (!bounds) continue;

    // Repel from other stops
    for (let j = 0; j < stops.length; j++) {
      if (i === j) continue;
      const b = stops[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.max(1, Math.hypot(dx, dy));

      // Near-field repulsion — prevents stops from collapsing to same spot
      if (dist < 10) {
        const push = 15 * REPEL_STRENGTH;
        const angle = seededRandom() * Math.PI * 2;
        fx += Math.cos(angle) * push;
        fy += Math.sin(angle) * push;
        continue;
      }

      // Label-label repulsion
      const overlapX = MIN_LABEL_SPACING_X - Math.abs(dx);
      const overlapY = MIN_LABEL_SPACING_Y - Math.abs(dy);
      if (overlapX > 0 && overlapY > 0) {
        const push = Math.min(overlapX, overlapY) * REPEL_STRENGTH;
        fx += (dx / dist) * push;
        fy += (dy / dist) * push;
      }

      // Sprite-sprite repulsion (tighter)
      if (dist < MIN_SPRITE_SPACING) {
        const push = (MIN_SPRITE_SPACING - dist) * REPEL_STRENGTH * 0.5;
        fx += (dx / dist) * push;
        fy += (dy / dist) * push;
      }
    }

    // Repel from district label
    {
      const dx = a.x - bounds.labelX;
      const dy = a.y - bounds.labelY;
      const dist = Math.max(1, Math.hypot(dx, dy));
      if (dist < DISTRICT_LABEL_REPEL) {
        const push = (DISTRICT_LABEL_REPEL - dist) * REPEL_STRENGTH * 0.8;
        fx += (dx / dist) * push;
        fy += (dy / dist) * push;
      }
    }

    // Small jitter to break ties deterministically
    fx += (seededRandom() - 0.5) * 0.5;
    fy += (seededRandom() - 0.5) * 0.5;

    // Apply force
    a.x += fx;
    a.y += fy;

    // Clamp to district bounds
    a.x = Math.max(bounds.minX, Math.min(bounds.maxX, a.x));
    a.y = Math.max(bounds.minY, Math.min(bounds.maxY, a.y));

    // Round to integers
    a.x = Math.round(a.x);
    a.y = Math.round(a.y);

    totalForce += Math.abs(fx) + Math.abs(fy);
  }

  if (verbose) {
    console.log(
      `  Iteration ${iter + 1}: overlaps=${computeOverlaps()} force=${totalForce.toFixed(1)}`,
    );
  }

  if (totalForce < 0.5) {
    console.log(`  Converged at iteration ${iter + 1}`);
    break;
  }
}

const finalOverlaps = computeOverlaps();
console.log(`Final overlaps: ${finalOverlaps}`);
console.log("");

// ── Report changes ──────────────────────────────────────────────────────────

let changeCount = 0;
for (const s of stops) {
  const dx = s.x - s.origX;
  const dy = s.y - s.origY;
  if (dx !== 0 || dy !== 0) {
    changeCount++;
    console.log(
      `  ${s.stopId.padEnd(30)} (${s.origX},${s.origY}) -> (${s.x},${s.y})  delta=(${dx > 0 ? "+" : ""}${dx},${dy > 0 ? "+" : ""}${dy})`,
    );
  }
}
console.log(`\n${changeCount} stops moved out of ${stops.length} total`);

// ── Apply changes ───────────────────────────────────────────────────────────

if (!apply) {
  console.log("\nDry run — pass --apply to write changes to heuristics file");
  process.exit(0);
}

let updated = heuristicsSrc;
for (const s of stops) {
  if (s.x === s.origX && s.y === s.origY) continue;
  // Replace the position in the heuristics source
  const pattern = new RegExp(
    `(stopId:\\s*"${s.stopId}"[\\s\\S]*?position:\\s*\\{\\s*x:\\s*)${s.origX}(,\\s*y:\\s*)${s.origY}`,
  );
  updated = updated.replace(pattern, `$1${s.x}$2${s.y}`);
}

writeFileSync(heuristicsPath, updated);
console.log(`\nWrote updated positions to ${heuristicsPath}`);

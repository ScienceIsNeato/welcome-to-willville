#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const layout = JSON.parse(
  await readFile(resolve(root, "data/town-layout.v1.json"), "utf8"),
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function edgeKey(a, b) {
  return [a, b].sort().join("::");
}

function signedArea(vertexIds) {
  let area = 0;
  for (let i = 0; i < vertexIds.length; i += 1) {
    const a = layout.vertices[vertexIds[i]];
    const b = layout.vertices[vertexIds[(i + 1) % vertexIds.length]];
    assert(a, `Unknown vertex ${vertexIds[i]}`);
    assert(b, `Unknown vertex ${vertexIds[(i + 1) % vertexIds.length]}`);
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

const edgeOwners = new Map();

assert(layout.generation, "layout must define generation parameters");
for (const key of [
  "edgeSampleSteps",
  "edgeCurveFactor",
  "edgeSquiggleFactor",
  "sitePadding",
  "siteColumns",
  "siteRows",
]) {
  assert(
    typeof layout.generation[key] === "number" &&
      Number.isFinite(layout.generation[key]),
    `generation.${key} must be a finite number`,
  );
}
assert(
  layout.generation.edgeSampleSteps >= 4,
  "generation.edgeSampleSteps must be at least 4",
);
assert(
  layout.generation.siteColumns > 0 && layout.generation.siteRows > 0,
  "generation site grid must have positive dimensions",
);

for (const district of layout.districts) {
  assert(
    Array.isArray(district.vertexIds) && district.vertexIds.length >= 3,
    `${district.id} must have at least 3 vertexIds`,
  );
  assert(
    signedArea(district.vertexIds) > 0,
    `${district.id} polygon must be clockwise in screen coordinates`,
  );

  for (let i = 0; i < district.vertexIds.length; i += 1) {
    const a = district.vertexIds[i];
    const b = district.vertexIds[(i + 1) % district.vertexIds.length];
    const key = edgeKey(a, b);
    const owners = edgeOwners.get(key) ?? [];
    owners.push(`${district.id}:${a}->${b}`);
    edgeOwners.set(key, owners);
  }
}

for (const [key, owners] of edgeOwners) {
  assert(
    owners.length <= 2,
    `Edge ${key} is owned by more than two districts: ${owners.join(", ")}`,
  );
}

const sharedEdges = [...edgeOwners.values()].filter(
  (owners) => owners.length === 2,
).length;

assert(
  sharedEdges >= 8,
  `Expected at least 8 shared district edges, saw ${sharedEdges}`,
);

console.log(
  `validated ${layout.districts.length} districts, ${Object.keys(layout.vertices).length} vertices, ${sharedEdges} exact shared edges`,
);

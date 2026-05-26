const DEFAULT_GENERATION = {
  edgeSampleSteps: 56,
  edgeCurveFactor: 0.055,
  edgeSquiggleFactor: 0.09,
  sitePadding: 34,
  siteColumns: 9,
  siteRows: 7,
};

const SHORELINE_VERTEX_RING = [
  "nw_coast",
  "north_ridge_w",
  "north_ridge_m",
  "north_saddle",
  "sign_hill",
  "graveyard_peak",
  "east_bluff",
  "east_green",
  "grave_hell",
  "halls_canal",
  "hell_bridge",
  "hell_gate_e",
  "hell_coast",
  "south_bay_e",
  "south_bay_m",
  "dog_coast",
  "slop_dog",
  "wharf_s",
  "wharf_w",
  "wharf_nw",
];

function generationFor(layout) {
  return { ...DEFAULT_GENERATION, ...(layout.generation ?? {}) };
}

function pointForVertex(layout, vertexId) {
  const point = layout.vertices[vertexId];
  if (!point) {
    throw new Error(`Unknown town layout vertex: ${vertexId}`);
  }
  return point;
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x:
      mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y:
      mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
  };
}

function cubicSegmentPoint(segment, t) {
  return cubicPoint(segment.p0, segment.p1, segment.p2, segment.p3, t);
}

export function hashStr(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function hashUnit(input) {
  return hashStr(input) / 0xffffffff;
}

function canonicalEdgeSpline(layout, canonicalStartId, canonicalEndId) {
  const generation = generationFor(layout);
  const p0 = pointForVertex(layout, canonicalStartId);
  const p3 = pointForVertex(layout, canonicalEndId);
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const edgeKey = `${canonicalStartId}:${canonicalEndId}`;
  const bend =
    (hashUnit(`${edgeKey}:bend`) * 2 - 1) * length * generation.edgeCurveFactor;
  const c1 = lerpPoint(p0, p3, 1 / 3);
  const c2 = lerpPoint(p0, p3, 2 / 3);
  return [
    p0,
    { x: c1.x + normal.x * bend, y: c1.y + normal.y * bend },
    { x: c2.x + normal.x * bend, y: c2.y + normal.y * bend },
    p3,
  ];
}

function squiggleAt(edgeKey, t) {
  const envelope = Math.sin(Math.PI * t);
  const f1 = 2 + Math.floor(hashUnit(`${edgeKey}:f1`) * 4);
  const f2 = 7 + Math.floor(hashUnit(`${edgeKey}:f2`) * 6);
  const f3 = 15 + Math.floor(hashUnit(`${edgeKey}:f3`) * 10);
  const p1 = hashUnit(`${edgeKey}:p1`);
  const p2 = hashUnit(`${edgeKey}:p2`);
  const p3 = hashUnit(`${edgeKey}:p3`);
  const twoPi = Math.PI * 2;
  return (
    envelope *
    (Math.sin(twoPi * (f1 * t + p1)) * 0.52 +
      Math.sin(twoPi * (f2 * t + p2)) * 0.3 +
      Math.sin(twoPi * (f3 * t + p3)) * 0.18)
  );
}

function sampledEdgePoints(layout, startVertexId, endVertexId) {
  const generation = generationFor(layout);
  const [canonicalStartId, canonicalEndId] = [
    startVertexId,
    endVertexId,
  ].sort();
  const [p0, p1, p2, p3] = canonicalEdgeSpline(
    layout,
    canonicalStartId,
    canonicalEndId,
  );
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const edgeKey = `${canonicalStartId}:${canonicalEndId}`;
  const points = [];
  for (let step = 0; step < generation.edgeSampleSteps; step += 1) {
    const canonicalT =
      startVertexId === canonicalStartId
        ? step / generation.edgeSampleSteps
        : 1 - step / generation.edgeSampleSteps;
    const point = cubicPoint(p0, p1, p2, p3, canonicalT);
    const offset =
      squiggleAt(edgeKey, canonicalT) * length * generation.edgeSquiggleFactor;
    points.push({
      x: Math.round((point.x + normal.x * offset) * 100) / 100,
      y: Math.round((point.y + normal.y * offset) * 100) / 100,
    });
  }
  return points;
}

function resolveDistrictPolygon(layout, vertexIds) {
  const points = [];
  for (let i = 0; i < vertexIds.length; i += 1) {
    const start = vertexIds[i];
    const end = vertexIds[(i + 1) % vertexIds.length];
    points.push(...sampledEdgePoints(layout, start, end));
  }
  return points;
}

function resolveShoreWallPath(layout) {
  const shorelinePoints = [];
  for (let i = 0; i < SHORELINE_VERTEX_RING.length; i += 1) {
    const start = SHORELINE_VERTEX_RING[i];
    const end = SHORELINE_VERTEX_RING[(i + 1) % SHORELINE_VERTEX_RING.length];
    shorelinePoints.push(...sampledEdgePoints(layout, start, end));
  }
  return pointsToPath(shorelinePoints);
}

export function resolveTownLayout(layout) {
  const shoreWallPath = resolveShoreWallPath(layout);
  return {
    ...layout,
    shoreWallPath,
    townFootprintPath: layout.townFootprintPath ?? shoreWallPath,
    districts: layout.districts.map((district) => {
      const polygon = resolveDistrictPolygon(layout, district.vertexIds);
      return {
        ...district,
        vertexIds: [...district.vertexIds],
        polygon,
        wallLoop: polygon,
      };
    }),
  };
}

function openPath(points) {
  if (points.length === 0) return "";
  return [
    `M ${points[0].x} ${points[0].y}`,
    ...points.slice(1).map((point) => `L ${point.x} ${point.y}`),
  ].join(" ");
}

function sampledCanalCenterline(layout, sampleSteps) {
  const points = [];
  for (const [index, segment] of layout.canal.segments.entries()) {
    for (let step = 0; step <= sampleSteps; step += 1) {
      if (index > 0 && step === 0) continue;
      const point = cubicSegmentPoint(segment, step / sampleSteps);
      points.push({
        x: Math.round(point.x * 100) / 100,
        y: Math.round(point.y * 100) / 100,
      });
    }
  }
  return points;
}

function canalBanksForCenterline(centerline, width) {
  const halfWidth = width / 2;
  const northBank = [];
  const southBank = [];

  for (let index = 0; index < centerline.length; index += 1) {
    const point = centerline[index];
    const prev = centerline[Math.max(0, index - 1)];
    const next = centerline[Math.min(centerline.length - 1, index + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const length = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / length, y: dx / length };
    northBank.push({
      x: Math.round((point.x + normal.x * halfWidth) * 100) / 100,
      y: Math.round((point.y + normal.y * halfWidth) * 100) / 100,
    });
    southBank.push({
      x: Math.round((point.x - normal.x * halfWidth) * 100) / 100,
      y: Math.round((point.y - normal.y * halfWidth) * 100) / 100,
    });
  }

  return { northBank, southBank };
}

export function resolveCanalSection(layout, options = {}) {
  const width = options.width ?? layout.generation?.canalSectionWidth ?? 92;
  const siteClearance =
    options.siteClearance ?? layout.generation?.canalSiteClearance ?? 24;
  const sampleSteps =
    options.sampleSteps ?? layout.generation?.canalSampleStepsPerSegment ?? 28;
  const centerline = sampledCanalCenterline(layout, sampleSteps);
  const { northBank, southBank } = canalBanksForCenterline(centerline, width);
  const polygon = [...northBank, ...southBank.slice().reverse()];
  return {
    id: "willville-canal",
    displayName: "The Canal",
    width,
    siteClearance,
    centerline,
    northBank,
    southBank,
    polygon,
    path: layout.canal.pathD,
    northBankPath: openPath(northBank),
    southBankPath: openPath(southBank),
  };
}

export function pointsToPath(points) {
  if (points.length === 0) return "";
  return [
    `M ${points[0].x} ${points[0].y}`,
    ...points.slice(1).map((point) => `L ${point.x} ${point.y}`),
    "Z",
  ].join(" ");
}

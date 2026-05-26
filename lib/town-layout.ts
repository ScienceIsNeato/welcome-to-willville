import rawTownLayout from "@/data/town-layout.v1.json";
import {
  hashStr,
  resolveCanalSection,
  resolveTownLayout,
  type Point,
} from "./town-layout-engine.mjs";

export type { Point };

export type CubicSegment = {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
};

type LayoutDistrictId = (typeof rawTownLayout.districts)[number]["id"];
type LayoutLineId = (typeof rawTownLayout.lines)[number]["id"];

type SitePlacement = {
  stopId: string;
  districtId: string;
  position: Point;
};

export type CanalSection = {
  id: "willville-canal";
  displayName: "The Canal";
  width: number;
  siteClearance: number;
  centerline: Point[];
  northBank: Point[];
  southBank: Point[];
  polygon: Point[];
  path: string;
  northBankPath: string;
  southBankPath: string;
};

const SITE_PADDING = rawTownLayout.generation.sitePadding;
const SITE_COLUMNS = rawTownLayout.generation.siteColumns;
const SITE_ROWS = rawTownLayout.generation.siteRows;

type RawDistrict = (typeof rawTownLayout.districts)[number];

type LayoutDistrict = Omit<RawDistrict, "vertexIds"> & {
  vertexIds: string[];
  polygon: Point[];
  wallLoop: Point[];
};

export const GENERATED_TOWN_LAYOUT = resolveTownLayout(rawTownLayout);
export const CANAL_SEGMENTS = rawTownLayout.canal.segments as CubicSegment[];
export const CANAL_SECTION: CanalSection = resolveCanalSection(rawTownLayout);

function distancePointToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq),
  );
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

export function pointsToPolygon(points: Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

export function pointsToPath(points: Point[]): string {
  if (points.length === 0) return "";
  return [
    `M ${points[0]!.x} ${points[0]!.y}`,
    ...points.slice(1).map((p) => `L ${p.x} ${p.y}`),
    "Z",
  ].join(" ");
}

function smoothClosedPath(points: Point[], tension = 0.18): string {
  if (points.length === 0) return "";
  if (points.length < 3) return pointsToPath(points);

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length; i += 1) {
    const p0 = points[(i - 1 + points.length) % points.length]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % points.length]!;
    const p3 = points[(i + 2) % points.length]!;
    const c1x = p1.x + (p2.x - p0.x) * tension;
    const c1y = p1.y + (p2.y - p0.y) * tension;
    const c2x = p2.x - (p3.x - p1.x) * tension;
    const c2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return `${d} Z`;
}

function boundsFor(points: Point[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInCanalSection(point: Point): boolean {
  const threshold = CANAL_SECTION.width / 2 + CANAL_SECTION.siteClearance;
  for (let index = 0; index < CANAL_SECTION.centerline.length - 1; index += 1) {
    if (
      distancePointToSegment(
        point,
        CANAL_SECTION.centerline[index]!,
        CANAL_SECTION.centerline[index + 1]!,
      ) <= threshold
    ) {
      return true;
    }
  }
  return false;
}

function candidateSlotsForDistrict(districtId: string): Point[] {
  const district = GENERATED_TOWN_LAYOUT.districts.find(
    (d) => d.id === districtId,
  );
  if (!district)
    return [
      {
        x: GENERATED_TOWN_LAYOUT.landmarks.townHall.x,
        y: GENERATED_TOWN_LAYOUT.landmarks.townHall.y,
      },
    ];

  const polygon = district.polygon;
  const bounds = boundsFor(polygon);
  const slots: Point[] = [];
  for (let row = 0; row < SITE_ROWS; row += 1) {
    for (let col = 0; col < SITE_COLUMNS; col += 1) {
      const x =
        bounds.minX +
        SITE_PADDING +
        ((bounds.maxX - bounds.minX - SITE_PADDING * 2) * (col + 0.5)) /
          SITE_COLUMNS;
      const y =
        bounds.minY +
        SITE_PADDING +
        ((bounds.maxY - bounds.minY - SITE_PADDING * 2) * (row + 0.5)) /
          SITE_ROWS;
      const point = { x: Math.round(x), y: Math.round(y) };
      if (pointInPolygon(point, polygon) && !pointInCanalSection(point)) {
        slots.push(point);
      }
    }
  }

  return slots.length > 0 ? slots : [district.label];
}

export function sitePositionForStop(
  districtId: string,
  stopId: string,
  repo: string,
): Point {
  const slots = candidateSlotsForDistrict(districtId);
  const seed = `${districtId}:${stopId}:${repo}`;
  return slots[hashStr(seed) % slots.length]!;
}

export function serviceRouteForStop(position: Point): string {
  const depot = GENERATED_TOWN_LAYOUT.landmarks.slopDepot;
  const midX = Math.round((depot.x + position.x) / 2);
  const canalBias = Math.max(760, Math.min(960, position.y + 80));
  return `M ${depot.x} ${depot.y} C ${midX} ${canalBias}, ${midX} ${position.y}, ${position.x} ${position.y}`;
}

function serviceLoopRouteForStop(position: Point): string {
  const depot = GENERATED_TOWN_LAYOUT.landmarks.slopDepot;
  const midX = Math.round((depot.x + position.x) / 2);
  const canalBias = Math.max(760, Math.min(960, position.y + 80));
  const returnBias = Math.max(730, Math.min(940, position.y + 120));
  return [
    `M ${depot.x} ${depot.y}`,
    `C ${midX} ${canalBias}, ${midX} ${position.y}, ${position.x} ${position.y}`,
    `C ${midX} ${position.y}, ${midX} ${returnBias}, ${depot.x} ${depot.y}`,
  ].join(" ");
}

function cubicPointAt(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): Point {
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

function approximateCubicLength(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  steps = 32,
): number {
  let length = 0;
  let previous = p0;
  for (let step = 1; step <= steps; step += 1) {
    const point = cubicPointAt(p0, p1, p2, p3, step / steps);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

function serviceLoopSiteKeyPointForStop(position: Point): number {
  const depot = GENERATED_TOWN_LAYOUT.landmarks.slopDepot;
  const midX = Math.round((depot.x + position.x) / 2);
  const canalBias = Math.max(760, Math.min(960, position.y + 80));
  const returnBias = Math.max(730, Math.min(940, position.y + 120));
  const outboundLength = approximateCubicLength(
    depot,
    { x: midX, y: canalBias },
    { x: midX, y: position.y },
    position,
  );
  const returnLength = approximateCubicLength(
    position,
    { x: midX, y: position.y },
    { x: midX, y: returnBias },
    depot,
  );
  const total = outboundLength + returnLength;
  return total > 0 ? outboundLength / total : 0.5;
}

export function wallLoopPathForDistrict(districtId: string): string {
  const district = GENERATED_TOWN_LAYOUT.districts.find(
    (d) => d.id === districtId,
  );
  if (!district) return "";
  return pointsToPath(district.wallLoop);
}

import rawTownLayout from "../data/town-layout.v1.json" with { type: "json" };
import {
  hashStr,
  resolveCanalSection,
  resolveTownLayout,
  type Point,
} from "./town-layout-engine.mjs";

export type { Point };

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

export const GENERATED_TOWN_LAYOUT = resolveTownLayout(rawTownLayout);
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

export function wallLoopPathForDistrict(districtId: string): string {
  const district = GENERATED_TOWN_LAYOUT.districts.find(
    (d) => d.id === districtId,
  );
  if (!district) return "";
  return pointsToPath(district.wallLoop);
}

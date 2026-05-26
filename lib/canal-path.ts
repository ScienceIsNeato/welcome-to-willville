/**
 * Curved canal spine through Willville (1600×1240 viewbox).
 *
 * The canal geometry comes from the generated town layout so boats, gates,
 * masks, and the painted art brief all share a single source of truth.
 */

/**
 * Curved canal spine through Willville (1600×1240 viewbox).
 *
 * The canal geometry comes from the generated town layout so boats, gates,
 * masks, and the painted art brief all share a single source of truth.
 */

import { GENERATED_TOWN_LAYOUT } from "./town-layout";

export type Point = { x: number; y: number };

type Cubic = { p0: Point; p1: Point; p2: Point; p3: Point };

/**
 * SVG path for the canal centerline.
 *
 * Stays inside the generated harbor zone so SVG boats and gate lines land on
 * the same canal geometry used by masks and district art.
 */
export const CANAL_PATH_D = GENERATED_TOWN_LAYOUT.canal.pathD;

const SEGMENTS = GENERATED_TOWN_LAYOUT.canal.segments as Cubic[];

function cubicAt(seg: Cubic, t: number): Point {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x:
      uuu * seg.p0.x +
      3 * uu * t * seg.p1.x +
      3 * u * tt * seg.p2.x +
      ttt * seg.p3.x,
    y:
      uuu * seg.p0.y +
      3 * uu * t * seg.p1.y +
      3 * u * tt * seg.p2.y +
      ttt * seg.p3.y,
  };
}

function cubicTangentAt(seg: Cubic, t: number): Point {
  const u = 1 - t;
  return {
    x:
      3 * u * u * (seg.p1.x - seg.p0.x) +
      6 * u * t * (seg.p2.x - seg.p1.x) +
      3 * t * t * (seg.p3.x - seg.p2.x),
    y:
      3 * u * u * (seg.p1.y - seg.p0.y) +
      6 * u * t * (seg.p2.y - seg.p1.y) +
      3 * t * t * (seg.p3.y - seg.p2.y),
  };
}

/** Approximate arc-length weights per segment (proportional to chord lengths). */
const SEGMENT_WEIGHTS = [0.82, 1.06, 0.91, 1.06] as const;
const TOTAL_WEIGHT = SEGMENT_WEIGHTS.reduce((a, b) => a + b, 0);

/**
 * Point and tangent on the canal centerline.
 * @param t Progress along the path, 0 = southwest inlet, 1 = open sea.
 */
function canalPointAt(t: number): Point & { angle: number } {
  const clamped = Math.min(1, Math.max(0, t));
  let remaining = clamped * TOTAL_WEIGHT;
  for (let i = 0; i < SEGMENTS.length; i += 1) {
    const w = SEGMENT_WEIGHTS[i] ?? 1;
    if (remaining <= w || i === SEGMENTS.length - 1) {
      const localT = w > 0 ? remaining / w : 0;
      const seg = SEGMENTS[i]!;
      const p = cubicAt(seg, localT);
      const tan = cubicTangentAt(seg, localT);
      return { ...p, angle: Math.atan2(tan.y, tan.x) };
    }
    remaining -= w;
  }
  const last = SEGMENTS[SEGMENTS.length - 1]!;
  const p = cubicAt(last, 1);
  const tan = cubicTangentAt(last, 1);
  return { ...p, angle: Math.atan2(tan.y, tan.x) };
}

/** Lock chamber centers at even spacing along the curved canal. */
const LOCK_PATH_T = [0.08, 0.26, 0.44, 0.62, 0.8, 0.94] as const;

export function lockCenterAt(index: number): Point & { angle: number } {
  const t = LOCK_PATH_T[index] ?? 0.5;
  return canalPointAt(t);
}

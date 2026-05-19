/**
 * Curved canal spine through Willville (1600×1240 viewbox).
 *
 * Coordinates are tuned for a harbor that enters from the southwest, weaves
 * between Slop Wharf, Hearth, and Sawmill, then opens to the open sea on the
 * east. Lock chambers sit at fixed fractions along this path so boats, gates,
 * and labels follow the painted waterway rather than a bottom band.
 */

export type Point = { x: number; y: number };

type Cubic = { p0: Point; p1: Point; p2: Point; p3: Point };

/** SVG path for the canal centerline (matches painted water in willville.png). */
export const CANAL_PATH_D =
  "M 70 1235 C 130 1120, 210 1000, 300 920" +
  " S 520 800, 700 795" +
  " S 920 820, 1100 870" +
  " S 1380 960, 1575 1120";

const SEGMENTS: Cubic[] = [
  {
    p0: { x: 70, y: 1235 },
    p1: { x: 130, y: 1120 },
    p2: { x: 210, y: 1000 },
    p3: { x: 300, y: 920 },
  },
  {
    p0: { x: 300, y: 920 },
    p1: { x: 410, y: 860 },
    p2: { x: 610, y: 800 },
    p3: { x: 700, y: 795 },
  },
  {
    p0: { x: 700, y: 795 },
    p1: { x: 810, y: 795 },
    p2: { x: 910, y: 810 },
    p3: { x: 1100, y: 870 },
  },
  {
    p0: { x: 1100, y: 870 },
    p1: { x: 1240, y: 915 },
    p2: { x: 1450, y: 1000 },
    p3: { x: 1575, y: 1120 },
  },
];

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

/** Approximate arc-length weights per segment (precomputed, stable). */
const SEGMENT_WEIGHTS = [1, 0.92, 0.88, 1.05] as const;
const TOTAL_WEIGHT = SEGMENT_WEIGHTS.reduce((a, b) => a + b, 0);

/**
 * Point and tangent on the canal centerline.
 * @param t Progress along the path, 0 = southwest inlet, 1 = open sea.
 */
export function canalPointAt(t: number): Point & { angle: number } {
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
export const LOCK_PATH_T = [0.08, 0.26, 0.44, 0.62, 0.8, 0.94] as const;

export function lockCenterAt(index: number): Point & { angle: number } {
  const t = LOCK_PATH_T[index] ?? 0.5;
  return canalPointAt(t);
}

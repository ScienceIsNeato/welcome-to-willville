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

/**
 * SVG path for the canal centerline.
 *
 * Stays inside the painted harbor zone (TOWN y ≈ 1085–1230) so that SVG boats
 * and gate lines land on the actual water in willville.png.
 */
export const CANAL_PATH_D =
  "M 75 1225 C 140 1190, 260 1140, 380 1110" +
  " S 620 1085, 800 1085" +
  " S 1000 1090, 1160 1115" +
  " S 1400 1155, 1570 1200";

const SEGMENTS: Cubic[] = [
  {
    p0: { x: 75, y: 1225 },
    p1: { x: 140, y: 1190 },
    p2: { x: 260, y: 1140 },
    p3: { x: 380, y: 1110 },
  },
  {
    p0: { x: 380, y: 1110 },
    p1: { x: 500, y: 1080 },
    p2: { x: 620, y: 1085 },
    p3: { x: 800, y: 1085 },
  },
  {
    p0: { x: 800, y: 1085 },
    p1: { x: 980, y: 1085 },
    p2: { x: 1000, y: 1090 },
    p3: { x: 1160, y: 1115 },
  },
  {
    p0: { x: 1160, y: 1115 },
    p1: { x: 1320, y: 1140 },
    p2: { x: 1400, y: 1155 },
    p3: { x: 1570, y: 1200 },
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

/** Approximate arc-length weights per segment (proportional to chord lengths). */
const SEGMENT_WEIGHTS = [0.82, 1.06, 0.91, 1.06] as const;
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

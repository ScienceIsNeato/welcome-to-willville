/**
 * Willville core data model.
 *
 * The town island is 1600×1240 inside a 2400×1800 world canvas. Districts are polygons,
 * Lines are Bezier paths that snake serpentine through (and brush past) multiple
 * districts, and Stops are points inside districts whose live status is sourced
 * from each repo's .willville.json manifest (with heuristic fallbacks).
 */
import { CANAL_PATH_D } from "./canal-path";
import { GENERATED_TOWN_LAYOUT, pointsToPolygon } from "./town-layout";

/** Inner town map coordinate space (districts, stops, canal). */
export const TOWN = { width: 1600, height: 1240 } as const;

/** Full painted world including bucolic margins around the town. */
export const WORLD = { width: 2400, height: 1800 } as const;

/** Town art and gameplay geometry sit centered inside WORLD. */
export const TOWN_OFFSET = {
  x: (WORLD.width - TOWN.width) / 2,
  y: (WORLD.height - TOWN.height) / 2,
} as const;

/** Focal point for the default camera (center of the town island). */
export const TOWN_CENTER = {
  x: TOWN_OFFSET.x + TOWN.width / 2,
  y: TOWN_OFFSET.y + TOWN.height / 2,
} as const;

/** @deprecated Prefer WORLD — kept for callers that mean the full canvas. */
const VIEWBOX = WORLD;

/**
 * Coastal harbor canal woven through the lower town. PRs sail the curved
 * channel and nose up against lock chambers along the path. Geometry follows
 * `CANAL_PATH_D`; generated town layout data is the visual source of truth.
 */
export const CANAL = {
  /** Centerline path (Bezier) from southwest inlet to open sea on the east. */
  pathD: CANAL_PATH_D,
  /** Loose bounds for labels and fallback hit areas. */
  top: GENERATED_TOWN_LAYOUT.canal.bounds.top,
  bottom: GENERATED_TOWN_LAYOUT.canal.bounds.bottom,
  left: GENERATED_TOWN_LAYOUT.canal.bounds.left,
  right: GENERATED_TOWN_LAYOUT.canal.bounds.right,
  waterColor: "#1f4f7a",
  waterHighlight: "#3a82b8",
} as const;

export type DistrictId =
  | "mirrored-mile"
  | "slop-wharf"
  | "halls-of-judgement"
  | "the-zeitgeist"
  | "gates-of-hell"
  | "dogwallow-ramble-ii"
  | "town-square"
  | "the-graveyard";

export type LineId =
  | "ai"
  | "quality"
  | "web"
  | "writing"
  | "workshop"
  | "halloween";

export type District = {
  id: DistrictId;
  displayName: string;
  blurb: string;
  /** Polygon points string for the SVG zone. */
  polygon: string;
  /** Where to anchor floating labels / SPOG. */
  label: { x: number; y: number };
  /** CSS color variable token, e.g. "--willville-mirrored". */
  colorVar: string;
};

export type Line = {
  id: LineId;
  displayName: string;
  colorVar: string;
  /** SVG path "d" attribute (closed loop, serpentine). */
  path: string;
  /** Seconds to complete one full loop. */
  loopSeconds: number;
  /** Number of vehicles animating along the line. */
  vehicleCount: number;
  /** Sprite style (placeholder SVG element selected in Train.tsx). */
  vehicle: "trolley" | "steam" | "hearse" | "cart" | "paperboy";
};

const DISTRICT_BLURBS: Record<DistrictId, string> = {
  "mirrored-mile": "Published works and reflective long-form projects.",
  "slop-wharf": "Central slop-mop orchestration and helpers.",
  "halls-of-judgement": "AI evaluations and training work.",
  "the-zeitgeist": "Web-facing projects that interface with the people.",
  "gates-of-hell": "Anything Halloween related.",
  "dogwallow-ramble-ii": "Homesteading projects and household work.",
  "town-square": "The central hub.",
  "the-graveyard": "Inactive projects, old experiments, and reference work.",
};

const DISTRICT_COLOR_VARS: Record<DistrictId, string> = {
  "mirrored-mile": "--willville-mirrored",
  "slop-wharf": "--willville-slop",
  "halls-of-judgement": "--willville-judgement",
  "the-zeitgeist": "--willville-zeitgeist",
  "gates-of-hell": "--willville-hell",
  "dogwallow-ramble-ii": "--willville-dogwallow",
  "town-square": "--willville-town-square",
  "the-graveyard": "--willville-graveyard",
};

const LINE_META: Record<LineId, Omit<Line, "id" | "path">> = {
  ai: {
    displayName: "The AI Line",
    colorVar: "--willville-judgement",
    loopSeconds: 28,
    vehicleCount: 3,
    vehicle: "steam",
  },
  quality: {
    displayName: "The Quality Line",
    colorVar: "--willville-slop",
    loopSeconds: 36,
    vehicleCount: 3,
    vehicle: "cart",
  },
  web: {
    displayName: "The Web Line",
    colorVar: "--willville-zeitgeist",
    loopSeconds: 22,
    vehicleCount: 2,
    vehicle: "trolley",
  },
  writing: {
    displayName: "The Writing Line",
    colorVar: "--willville-mirrored",
    loopSeconds: 44,
    vehicleCount: 4,
    vehicle: "paperboy",
  },
  workshop: {
    displayName: "The Workshop Line",
    colorVar: "--willville-dogwallow",
    loopSeconds: 32,
    vehicleCount: 3,
    vehicle: "cart",
  },
  halloween: {
    displayName: "The Halloween Line",
    colorVar: "--willville-hell",
    loopSeconds: 26,
    vehicleCount: 3,
    vehicle: "hearse",
  },
};

/**
 * Districts laid out roughly clockwise around a central plaza.
 * Polygons are intentionally non-rectangular so the camera + transit lines
 * have organic edges to rub against.
 */
export const DISTRICTS: District[] = [
  ...GENERATED_TOWN_LAYOUT.districts.map((district) => ({
    id: district.id as DistrictId,
    displayName: district.displayName,
    blurb: DISTRICT_BLURBS[district.id as DistrictId],
    polygon: pointsToPolygon(district.polygon),
    label: district.label,
    colorVar: DISTRICT_COLOR_VARS[district.id as DistrictId],
  })),
];

/**
 * Transit lines. Each path is a closed loop that intentionally weaves
 * through several districts so different lines visibly rub against
 * different combinations as the camera pans/zooms.
 */
export const LINES: Line[] = [
  ...GENERATED_TOWN_LAYOUT.lines.map((line) => ({
    id: line.id as LineId,
    displayName: LINE_META[line.id as LineId].displayName,
    colorVar: LINE_META[line.id as LineId].colorVar,
    path: line.path,
    loopSeconds: LINE_META[line.id as LineId].loopSeconds,
    vehicleCount: LINE_META[line.id as LineId].vehicleCount,
    vehicle: LINE_META[line.id as LineId].vehicle,
  })),
];

/** Manual stops have no repo but still occupy a place on the map. */
export type ManualStop = {
  id: string;
  displayName: string;
  district: DistrictId;
  lines: LineId[];
  position: { x: number; y: number };
  homepage?: string;
  blurb?: string;
  glyph?: SiteGlyph;
  /** Explicit status state for non-repo stops. Defaults to "unknown" if omitted. */
  statusState?: import("./town").StatusState;
};

export type SiteGlyph = {
  /** Stable short noun used by future glyph-generation and masking passes. */
  label: string;
  /** Prompt seed for rendering the object in the town art style. */
  prompt: string;
  /** Whether this has been custom-designed or is still a registration placeholder. */
  state: "placeholder" | "designed";
};

export const MANUAL_STOPS: ManualStop[] = [];

/**
 * Willville core data model.
 *
 * The town island is 1600×1240 inside a 2400×1800 world canvas. Districts are polygons,
 * Lines are Bezier paths that snake serpentine through (and brush past) multiple
 * districts, and Stops are points inside districts whose live status is sourced
 * from each repo's .willville.json manifest (with heuristic fallbacks).
 */
import { CANAL_PATH_D } from "./canal-path";

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
export const VIEWBOX = WORLD;

/**
 * Coastal harbor canal woven through the lower town. PRs sail the curved
 * channel and nose up against lock chambers along the path. Geometry follows
 * `CANAL_PATH_D`; the painted map in `willville.png` is the visual source of
 * truth — the SVG layer only adds gates, labels, and boats.
 */
export const CANAL = {
  /** Centerline path (Bezier) from southwest inlet to open sea on the east. */
  pathD: CANAL_PATH_D,
  /** Loose bounds for labels and fallback hit areas. */
  top: 1080,
  bottom: 1240,
  left: 50,
  right: 1590,
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

/**
 * Districts laid out roughly clockwise around a central plaza.
 * Polygons are intentionally non-rectangular so the camera + transit lines
 * have organic edges to rub against.
 */
export const DISTRICTS: District[] = [
  {
    id: "mirrored-mile",
    displayName: "Mirrored Mile",
    blurb: "Published works and reflective long-form projects.",
    polygon: "60,120 360,80 420,260 320,360 80,340",
    label: { x: 220, y: 220 },
    colorVar: "--willville-mirrored",
  },
  {
    id: "the-zeitgeist",
    displayName: "The Zeitgeist",
    blurb: "Web-facing projects that interface with the people.",
    polygon: "440,80 760,90 800,300 540,320 420,260",
    label: { x: 600, y: 200 },
    colorVar: "--willville-zeitgeist",
  },
  {
    id: "the-graveyard",
    displayName: "The Graveyard",
    blurb: "Inactive projects, old experiments, and things kept for reference.",
    polygon: "820,100 1140,90 1200,300 1080,420 820,400 780,260",
    label: { x: 1000, y: 240 },
    colorVar: "--willville-graveyard",
  },
  {
    id: "halls-of-judgement",
    displayName: "The Halls of Judgement",
    blurb: "AI evaluations and training work.",
    polygon: "1200,300 1540,260 1540,500 1300,540 1180,460",
    label: { x: 1360, y: 400 },
    colorVar: "--willville-judgement",
  },
  {
    id: "slop-wharf",
    displayName: "Slop Wharf",
    blurb: "Central slop-mop orchestration and helpers.",
    polygon: "60,400 320,400 420,580 320,720 60,700",
    label: { x: 200, y: 560 },
    colorVar: "--willville-slop",
  },
  {
    id: "gates-of-hell",
    displayName: "The Gates of Hell",
    blurb: "Anything Halloween related.",
    polygon: "1280,560 1540,540 1540,900 1280,920 1220,720",
    label: { x: 1400, y: 740 },
    colorVar: "--willville-hell",
  },
  {
    id: "town-square",
    displayName: "Town Square",
    blurb: "The central hub.",
    polygon: "560,420 980,420 1060,560 980,720 700,740 540,620",
    label: { x: 800, y: 560 },
    colorVar: "--willville-town-square",
  },
  {
    id: "dogwallow-ramble-ii",
    displayName: "Dogwallow Ramble II",
    blurb: "Homesteading projects and household work.",
    polygon: "60,760 360,760 420,920 240,960 60,920",
    label: { x: 220, y: 860 },
    colorVar: "--willville-dogwallow",
  },
];

/**
 * Transit lines. Each path is a closed loop that intentionally weaves
 * through several districts so different lines visibly rub against
 * different combinations as the camera pans/zooms.
 */
export const LINES: Line[] = [
  {
    id: "ai",
    displayName: "The AI Line",
    colorVar: "--willville-judgement",
    path: "M 1000,200 C 1200,140 1380,260 1400,400 C 1420,540 1240,540 1100,460 C 960,380 820,440 900,320 C 980,200 1000,200 1000,200 Z",
    loopSeconds: 28,
    vehicleCount: 3,
    vehicle: "steam",
  },
  {
    id: "quality",
    displayName: "The Quality Line",
    colorVar: "--willville-slop",
    path: "M 200,500 C 80,580 200,720 360,640 C 520,560 700,640 900,520 C 1080,420 1280,420 1380,380 C 1240,540 1100,560 900,620 C 700,680 520,720 360,720 C 200,720 80,640 200,500 Z",
    loopSeconds: 36,
    vehicleCount: 3,
    vehicle: "cart",
  },
  {
    id: "web",
    displayName: "The Web Line",
    colorVar: "--willville-zeitgeist",
    path: "M 600,180 C 760,220 800,300 700,360 C 540,400 380,300 320,200 C 260,120 440,80 600,180 Z",
    loopSeconds: 22,
    vehicleCount: 2,
    vehicle: "trolley",
  },
  {
    id: "writing",
    displayName: "The Writing Line",
    colorVar: "--willville-mirrored",
    path: "M 220,200 C 320,300 280,420 220,560 C 180,700 280,820 420,860 C 560,900 720,840 800,720 C 880,600 800,460 700,420 C 600,380 540,520 480,700 C 420,860 220,820 180,640 C 140,460 220,200 220,200 Z",
    loopSeconds: 44,
    vehicleCount: 4,
    vehicle: "paperboy",
  },
  {
    id: "workshop",
    displayName: "The Workshop Line",
    colorVar: "--willville-dogwallow",
    path: "M 240,820 C 380,760 540,840 700,820 C 880,800 1040,820 1240,820 C 1380,820 1400,720 1280,680 C 1100,640 900,720 700,720 C 540,720 380,680 240,720 C 120,760 100,860 240,820 Z",
    loopSeconds: 32,
    vehicleCount: 3,
    vehicle: "cart",
  },
  {
    id: "halloween",
    displayName: "The Halloween Line",
    colorVar: "--willville-hell",
    path: "M 1400,700 C 1300,580 1100,560 900,620 C 720,680 580,820 700,860 C 820,900 1000,860 1180,820 C 1340,780 1500,820 1400,700 Z",
    loopSeconds: 26,
    vehicleCount: 3,
    vehicle: "hearse",
  },
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

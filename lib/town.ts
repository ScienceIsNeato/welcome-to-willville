/**
 * Town data merge logic.
 *
 * Combines:
 *   1. Manual stops from willville.ts
 *   2. Per-repo heuristics from willville.heuristics.ts (position, district, lines)
 *   3. Live GitHub repo metadata (description, pushed_at, open milestones)
 *
 * No .willville.json required — everything is derived from the repo itself.
 * The result is a flat array of Stop objects that the SVG layer renders.
 */
import {
  DISTRICTS,
  LINES,
  MANUAL_STOPS,
  type District,
  type DistrictId,
  type LineId,
} from "./willville";
import { HEURISTICS, type Heuristic } from "./willville.heuristics";

export type StatusState =
  | "idea"
  | "wip"
  | "shipping"
  | "maintenance"
  | "dormant"
  | "unknown";

export type QueueEntry = {
  active: boolean;
  milestone?: string;
  etaDays?: number;
  priority?: number;
};

export type Stop = {
  id: string;
  displayName: string;
  district: DistrictId;
  lines: LineId[];
  position: { x: number; y: number };
  repo?: string;
  homepage?: string;
  blurb?: string;
  visibility: "public" | "mayor";
  isPrivate?: boolean;
  isManual?: boolean;
  status: {
    state: StatusState;
    summary?: string;
    blockers: string[];
    next: string[];
    updated?: string;
  };
  queue?: QueueEntry;
};

/**
 * Days until the milestone, derived from `eta_days` first, then `target_date`.
 * Returns Number.POSITIVE_INFINITY when nothing is set.
 */
export function deriveEtaDays(
  input:
    | {
        eta_days?: number;
        target_date?: string;
      }
    | undefined,
): number {
  if (!input) return Number.POSITIVE_INFINITY;
  if (typeof input.eta_days === "number" && Number.isFinite(input.eta_days)) {
    return input.eta_days;
  }
  if (input.target_date) {
    const t = Date.parse(input.target_date);
    if (!Number.isNaN(t)) {
      return Math.max(0, Math.round((t - Date.now()) / 86_400_000));
    }
  }
  return Number.POSITIVE_INFINITY;
}

/** Sorts active queue stops: smallest ETA first; priority then displayName tiebreak. */
export function compareQueue(a: Stop, b: Stop): number {
  const aEta = a.queue?.etaDays ?? Number.POSITIVE_INFINITY;
  const bEta = b.queue?.etaDays ?? Number.POSITIVE_INFINITY;
  if (aEta !== bEta) return aEta - bEta;
  const aP = a.queue?.priority ?? 9999;
  const bP = b.queue?.priority ?? 9999;
  if (aP !== bP) return aP - bP;
  return a.displayName.localeCompare(b.displayName);
}

/** Returns the active queue, sorted next-stop-first. */
export function activeQueue(stops: Stop[]): Stop[] {
  return stops
    .filter((s) => s.queue?.active)
    .slice()
    .sort(compareQueue);
}

export type OpenMilestone = {
  title: string;
  dueOn: string | null;
  openIssues: number;
};

export type RepoMeta = {
  repo: string; // "owner/name"
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  pushedAt: string;
  defaultBranch: string;
  homepage?: string;
  /** GitHub repo description — used as status.summary. */
  description?: string;
  /** GitHub topics — used to auto-assign district and transit lines. */
  topics?: string[];
  /** Open milestones sorted by due date ascending. */
  openMilestones?: OpenMilestone[];
};

// ---------------------------------------------------------------------------
// Topic-based auto-layout
// ---------------------------------------------------------------------------

/** Maps GitHub topic strings to Willville district IDs. First match wins. */
const TOPIC_DISTRICT: Partial<Record<string, DistrictId>> = {
  // The Foundry
  ai: "the-foundry",
  "machine-learning": "the-foundry",
  "deep-learning": "the-foundry",
  llm: "the-foundry",
  gpt: "the-foundry",
  openai: "the-foundry",
  ganglia: "the-foundry",
  // Web Row
  web: "web-row",
  react: "web-row",
  nextjs: "web-row",
  "next-js": "web-row",
  frontend: "web-row",
  website: "web-row",
  // The Press Row
  writing: "the-press-row",
  blog: "the-press-row",
  novel: "the-press-row",
  fiction: "the-press-row",
  // Slop Wharf
  quality: "slop-wharf",
  testing: "slop-wharf",
  linting: "slop-wharf",
  ci: "slop-wharf",
  "github-actions": "slop-wharf",
  "code-quality": "slop-wharf",
  // The Sawmill District
  hardware: "the-sawmill-district",
  arduino: "the-sawmill-district",
  "raspberry-pi": "the-sawmill-district",
  iot: "the-sawmill-district",
  electronics: "the-sawmill-district",
  // Hallow Hollow
  halloween: "hallow-hollow",
  spooky: "hallow-hollow",
  horror: "hallow-hollow",
  // The Audit Yard
  monitoring: "the-audit-yard",
  observability: "the-audit-yard",
  analytics: "the-audit-yard",
  audit: "the-audit-yard",
};

/** Maps GitHub topic strings to Willville transit line IDs. All matches kept. */
const TOPIC_LINE: Partial<Record<string, LineId>> = {
  ai: "ai",
  "machine-learning": "ai",
  llm: "ai",
  gpt: "ai",
  quality: "quality",
  testing: "quality",
  ci: "quality",
  web: "web",
  react: "web",
  nextjs: "web",
  frontend: "web",
  writing: "writing",
  blog: "writing",
  novel: "writing",
  halloween: "halloween",
  spooky: "halloween",
};

function topicsToDistrict(topics: string[]): DistrictId {
  for (const t of topics) {
    const d = TOPIC_DISTRICT[t.toLowerCase()];
    if (d) return d;
  }
  return "the-hearth";
}

function topicsToLines(topics: string[]): LineId[] {
  const seen = new Set<LineId>();
  for (const t of topics) {
    const l = TOPIC_LINE[t.toLowerCase()];
    if (l) seen.add(l);
  }
  return [...seen];
}

/** AABB of a district polygon (used to scatter auto-positioned stops). */
function districtBounds(
  district: District,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const pts = district.polygon
    .trim()
    .split(/\s+/)
    .map((p) => {
      const [x, y] = p.split(",").map(Number);
      return { x: x!, y: y! };
    });
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

/** FNV-1a 32-bit hash — fast, deterministic, good distribution. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/**
 * Deterministic position within a district derived from the repo full name.
 * Stable across syncs — same repo always lands in the same spot.
 */
function autoPosition(
  districtId: DistrictId,
  repo: string,
): { x: number; y: number } {
  const district = DISTRICTS.find((d) => d.id === districtId);
  const bounds = district
    ? districtBounds(district)
    : { minX: 600, maxX: 1000, minY: 400, maxY: 700 };
  const pad = 40;
  const w = Math.max(1, bounds.maxX - bounds.minX - pad * 2);
  const h = Math.max(1, bounds.maxY - bounds.minY - pad * 2);
  const hx = hashStr(repo);
  const hy = hashStr(repo + "\x00y");
  return {
    x: Math.round(bounds.minX + pad + ((hx % 1000) / 999) * w),
    y: Math.round(bounds.minY + pad + ((hy % 1000) / 999) * h),
  };
}

// ---------------------------------------------------------------------------

/**
 * Derive project status state from GitHub push recency and milestone presence.
 * Open milestone → wip. Recent push → shipping. Otherwise maintenance/dormant.
 */
function deriveState(
  pushedAt: string,
  hasOpenMilestone: boolean,
): StatusState {
  if (hasOpenMilestone) return "wip";
  const daysSince = (Date.now() - Date.parse(pushedAt)) / 86_400_000;
  if (daysSince <= 14) return "shipping";
  if (daysSince <= 90) return "maintenance";
  return "dormant";
}

/**
 * Derive queue entry from GitHub open milestones.
 * Falls back to heuristic queue if no milestones exist.
 */
function deriveQueue(
  openMilestones: OpenMilestone[] | undefined,
  heuristicQueue: Heuristic["queue"] | undefined,
): QueueEntry | undefined {
  if (openMilestones && openMilestones.length > 0) {
    const m = openMilestones[0]!;
    const etaDays = m.dueOn
      ? deriveEtaDays({ target_date: m.dueOn })
      : undefined;
    return {
      active: true,
      milestone: m.title,
      etaDays: Number.isFinite(etaDays ?? NaN) ? etaDays : undefined,
    };
  }
  if (!heuristicQueue) return undefined;
  return {
    active: heuristicQueue.active,
    milestone: heuristicQueue.milestone,
    etaDays: heuristicQueue.etaDays,
    priority: heuristicQueue.priority,
  };
}

/** Build a Stop from GitHub repo metadata + optional heuristic layout overrides. */
export function buildStop(meta: RepoMeta, heuristic?: Heuristic): Stop {
  const hasOpenMilestone = (meta.openMilestones?.length ?? 0) > 0;
  const district =
    heuristic?.district ?? topicsToDistrict(meta.topics ?? []);
  const lines = heuristic?.lines ?? topicsToLines(meta.topics ?? []);
  const stopId = heuristic?.stopId ?? meta.repo.split("/")[1]!.toLowerCase();
  const displayName = heuristic?.displayName ?? repoDisplayName(meta.repo);
  const position = heuristic?.position ?? autoPosition(district, meta.repo);
  const queue = deriveQueue(meta.openMilestones, heuristic?.queue);
  return {
    id: stopId,
    displayName,
    district,
    lines,
    position,
    repo: meta.repo,
    homepage: meta.homepage,
    blurb: heuristic?.blurb,
    visibility: "public",
    isPrivate: meta.isPrivate,
    status: {
      state: deriveState(meta.pushedAt, hasOpenMilestone),
      summary: meta.description,
      blockers: [],
      next: [],
      updated: meta.pushedAt,
    },
    queue,
  };
}

/** Build the full Stop array including manual stops + repo-driven stops. */
export function buildTown(
  repoMetas: RepoMeta[],
  options: { isMayor: boolean } = { isMayor: false },
): Stop[] {
  const stops: Stop[] = [];

  // Manual stops first.
  for (const m of MANUAL_STOPS) {
    stops.push({
      id: m.id,
      displayName: m.displayName,
      district: m.district,
      lines: m.lines,
      position: m.position,
      homepage: m.homepage,
      blurb: m.blurb,
      visibility: "public",
      isManual: true,
      status: {
        state: "unknown",
        blockers: [],
        next: [],
      },
    });
  }

  // Repo-driven stops.
  for (const meta of repoMetas) {
    const heuristic = HEURISTICS.find(
      (h) => h.repo.toLowerCase() === meta.repo.toLowerCase(),
    );
    const stop = buildStop(meta, heuristic);
    if (stop.visibility === "mayor" && !options.isMayor) continue;
    if (stop.isPrivate && !options.isMayor) continue;
    stops.push(stop);
  }

  return stops;
}

export { DISTRICTS, LINES };

/**
 * Build the initial (offline) stop list from heuristics + manual stops only.
 * Used at static-export build time so the site renders fully populated even
 * without /api/town. Live status overrides arrive client-side via fetch.
 */
export function buildInitialStops(): Stop[] {
  const stops: Stop[] = [];
  for (const m of MANUAL_STOPS) {
    stops.push({
      id: m.id,
      displayName: m.displayName,
      district: m.district,
      lines: m.lines,
      position: m.position,
      homepage: m.homepage,
      blurb: m.blurb,
      visibility: "public",
      isManual: true,
      status: { state: "unknown", blockers: [], next: [] },
    });
  }
  for (const h of HEURISTICS) {
    stops.push({
      id: h.stopId,
      displayName: h.displayName,
      district: h.district,
      lines: h.lines,
      position: h.position ?? { x: 800, y: 500 },
      repo: h.repo,
      blurb: h.blurb,
      visibility: "public",
      status: { state: "unknown", blockers: [], next: [] },
      queue: h.queue,
    });
  }
  return stops;
}

function repoDisplayName(repo: string): string {
  const slug = repo.split("/").at(-1) ?? repo;
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

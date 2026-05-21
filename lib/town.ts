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
  type SiteGlyph,
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

export type ActiveBranch = {
  name: string;
  compareUrl: string;
  pushedAt?: string;
  isDefault: boolean;
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
  glyph?: SiteGlyph;
  visibility: "public" | "mayor";
  isPrivate?: boolean;
  isManual?: boolean;
  status: {
    state: StatusState;
    /** What the agent is actively doing. */
    doing?: string;
    /** Recently completed work. */
    done?: string;
    /** What's coming next. */
    next?: string;
    /** Current blocker, if any. */
    blocked?: string;
    /** Risk level + reason. */
    risk?: string;
    /** Legacy summary (fallback if no doing/done). */
    summary?: string;
    updated?: string;
  };
  queue?: QueueEntry;
  /** Open issues + PRs on GitHub. */
  openIssues?: number;
  /** GitHub star count. */
  stars?: number;
  /** Primary language reported by GitHub. */
  language?: string;
  /** Commit count over the last 3 calendar days. */
  commits3d?: number;
  /** Commit count over the last 7 calendar days. */
  commits7d?: number;
  /** Commit count over the last 21 calendar days (3 weekly buckets). */
  commits21d?: number;
  /** Most recently committed branch in the repo. */
  activeBranch?: ActiveBranch;
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

/** Returns the active queue, sorted next-stop-first (the 5 repos with the most commits in the last 7 days). */
export function activeQueue(stops: Stop[]): Stop[] {
  return stops
    .slice()
    .sort((a, b) => {
      const commitsA = a.commits7d ?? 0;
      const commitsB = b.commits7d ?? 0;
      if (commitsA !== commitsB) {
        return commitsB - commitsA;
      }
      const starsA = a.stars ?? 0;
      const starsB = b.stars ?? 0;
      if (starsA !== starsB) {
        return starsB - starsA;
      }
      return a.displayName.localeCompare(b.displayName);
    })
    .slice(0, 5);
}

/** Top 5 most active repos by recent commit activity (3d > 7d > 21d). */
export function mostActiveStops(stops: Stop[], limit = 5): Stop[] {
  return stops
    .filter((s) => s.repo && (s.commits3d ?? 0) + (s.commits7d ?? 0) > 0)
    .slice()
    .sort((a, b) => {
      const a3 = a.commits3d ?? 0;
      const b3 = b.commits3d ?? 0;
      if (a3 !== b3) return b3 - a3;
      const a7 = a.commits7d ?? 0;
      const b7 = b.commits7d ?? 0;
      if (a7 !== b7) return b7 - a7;
      const a21 = a.commits21d ?? 0;
      const b21 = b.commits21d ?? 0;
      return b21 - a21;
    })
    .slice(0, limit);
}

/** Returns the 1-based rank of a stop in the Mayor's Express queue, or null. */
export function expressRank(stop: Stop, allStops: Stop[]): number | null {
  const queue = mostActiveStops(allStops);
  const idx = queue.findIndex(
    (s) => s.id === stop.id && s.district === stop.district,
  );
  return idx >= 0 ? idx + 1 : null;
}

export type OpenMilestone = {
  title: string;
  dueOn: string | null;
  openIssues: number;
};

/**
 * Structured data parsed from a `<!-- willville ... -->` block in STATUS.md.
 * Agents write this; Willville reads it. Designed as a compressed standup:
 * what's happening, what just happened, what's stuck, should I worry.
 */
export type WillvillePacket = {
  /** What the agent is actively working on right now. */
  doing?: string;
  /** Most recent completed items (comma-separated). */
  done?: string;
  /** What comes after the current task. */
  next?: string;
  /** Single most important blocker, if any. */
  blocked?: string;
  /** low | medium | high — with brief reason if not low. */
  risk?: string;
  /** Active milestone title. */
  milestone?: string;
  /** ISO date string (YYYY-MM-DD) for milestone target. */
  eta?: string;
  // ---- backward compat (old-format fields still parsed) ----
  /** @deprecated Use `doing` instead. */
  status?: StatusState;
  /** @deprecated Use `doing` + `done` instead. */
  summary?: string;
  /** @deprecated Renamed to `eta`. */
  etaDate?: string;
  /** @deprecated Use singular `blocked` instead. */
  blockers?: string[];
};

export type RepoMeta = {
  repo: string; // "owner/name"
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  pushedAt: string;
  defaultBranch: string;
  homepage?: string;
  /** GitHub repo description — fallback summary if no willville packet. */
  description?: string;
  /** GitHub topics — used to auto-assign district and transit lines. */
  topics?: string[];
  /** Open milestones sorted by due date ascending. */
  openMilestones?: OpenMilestone[];
  /** Parsed willville packet from STATUS.md, if present. Agent-written data. */
  willvillePacket?: WillvillePacket;
  /** Open issues + PRs count from GitHub. */
  openIssuesCount?: number;
  /** GitHub star count. */
  stars?: number;
  /** Primary language reported by GitHub. */
  language?: string;
  /** Commit count over the last 3 calendar days. */
  commits3d?: number;
  /** Commit count over the last 7 calendar days. */
  commits7d?: number;
  /** Commit count over the last 21 calendar days (3 weekly buckets). */
  commits21d?: number;
  /** Most recently committed branch in the repo. */
  activeBranch?: ActiveBranch;
};

// ---------------------------------------------------------------------------
// Topic-based auto-layout
// ---------------------------------------------------------------------------

/** Maps GitHub topic strings to Willville district IDs. First match wins. */
const TOPIC_DISTRICT: Partial<Record<string, DistrictId>> = {
  // The Graveyard (inactive AI/misc projects)
  ai: "the-graveyard",
  "machine-learning": "the-graveyard",
  "deep-learning": "the-graveyard",
  llm: "the-graveyard",
  gpt: "the-graveyard",
  openai: "the-graveyard",
  ganglia: "the-graveyard",
  // The Zeitgeist (web-facing)
  web: "the-zeitgeist",
  react: "the-zeitgeist",
  nextjs: "the-zeitgeist",
  "next-js": "the-zeitgeist",
  frontend: "the-zeitgeist",
  website: "the-zeitgeist",
  // Mirrored Mile (published works)
  writing: "mirrored-mile",
  blog: "mirrored-mile",
  novel: "mirrored-mile",
  fiction: "mirrored-mile",
  // Slop Wharf
  quality: "slop-wharf",
  testing: "slop-wharf",
  linting: "slop-wharf",
  ci: "slop-wharf",
  "github-actions": "slop-wharf",
  "code-quality": "slop-wharf",
  // Dogwallow Ramble II (homesteading)
  hardware: "dogwallow-ramble-ii",
  arduino: "dogwallow-ramble-ii",
  "raspberry-pi": "dogwallow-ramble-ii",
  iot: "dogwallow-ramble-ii",
  electronics: "dogwallow-ramble-ii",
  // Gates of Hell (Halloween)
  halloween: "gates-of-hell",
  spooky: "gates-of-hell",
  horror: "gates-of-hell",
  // Halls of Judgement (evals/audit)
  monitoring: "halls-of-judgement",
  observability: "halls-of-judgement",
  analytics: "halls-of-judgement",
  audit: "halls-of-judgement",
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
  return "the-graveyard";
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
function districtBounds(district: District): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
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

function repoGlyphLabel(repo: string): string {
  return repo.split("/").at(-1)!.replace(/[-_]+/g, " ").trim().toLowerCase();
}

function defaultGlyphForRepo(repo: string): SiteGlyph {
  const label = repoGlyphLabel(repo);
  return {
    label,
    prompt: `small labeled project marker for ${label} in the painted town style`,
    state: "placeholder",
  };
}

// ---------------------------------------------------------------------------

/**
 * Derive project status state from GitHub push recency and milestone presence.
 * Open milestone → wip. Recent push → shipping. Otherwise maintenance/dormant.
 */
function deriveState(pushedAt: string, hasOpenMilestone: boolean): StatusState {
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
  const pkt = meta.willvillePacket;
  const hasOpenMilestone = (meta.openMilestones?.length ?? 0) > 0;
  const district = heuristic?.district ?? topicsToDistrict(meta.topics ?? []);
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
    glyph: heuristic?.glyph ?? defaultGlyphForRepo(meta.repo),
    visibility: "public",
    isPrivate: meta.isPrivate,
    status: {
      state: pkt?.doing
        ? "wip"
        : (pkt?.status ?? deriveState(meta.pushedAt, hasOpenMilestone)),
      doing: pkt?.doing,
      done: pkt?.done,
      next: pkt?.next,
      blocked: pkt?.blocked ?? pkt?.blockers?.[0],
      risk: pkt?.risk,
      summary: pkt?.summary ?? meta.description,
      updated: meta.pushedAt,
    },
    queue,
    openIssues: meta.openIssuesCount,
    stars: meta.stars,
    language: meta.language,
    commits3d: meta.commits3d,
    commits7d: meta.commits7d,
    commits21d: meta.commits21d,
    activeBranch: meta.activeBranch,
  };
}

/** Build the full Stop array including manual stops + repo-driven stops. */
export function buildTown(repoMetas: RepoMeta[]): Stop[] {
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
      glyph: m.glyph,
      visibility: "public",
      isManual: true,
      status: {
        state: m.statusState ?? "unknown",
      },
    });
  }

  // Repo-driven stops.
  for (const meta of repoMetas) {
    const heuristic = HEURISTICS.find(
      (h) => h.repo.toLowerCase() === meta.repo.toLowerCase(),
    );
    const stop = buildStop(meta, heuristic);
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
      glyph: m.glyph,
      visibility: "public",
      isManual: true,
      status: { state: m.statusState ?? "unknown" },
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
      glyph: h.glyph ?? defaultGlyphForRepo(h.repo),
      visibility: "public",
      status: { state: "unknown" },
      queue: h.queue,
    });
  }
  return stops;
}

function repoDisplayName(repo: string): string {
  return repo.split("/").at(-1) ?? repo;
}

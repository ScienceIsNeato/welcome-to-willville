/**
 * Town data merge logic.
 *
 * Combines:
 *   1. Manual stops from willville.ts
 *   2. Per-repo heuristics from willville.heuristics.ts (position, district, lines)
 *   3. Live GitHub repo metadata (description, pushed_at, open milestones)
 *
 * Repo manifests are hydrated separately by the bell path and held in memory.
 * The result is a flat array of Stop objects that the SVG layer renders.
 */
import {
  DISTRICTS,
  LINES,
  MANUAL_STOPS,
  type DistrictId,
  type LineId,
  type SiteGlyph,
} from "./willville";
import { HEURISTICS, type Heuristic } from "./willville.heuristics";
import { sitePositionForStop } from "./town-layout";
import allyAlleyConfig from "../data/ally-alley.v1.json";

/** My contribution footprint in an ally repo (one I help on but don't own). */
export type Contribution = {
  /** Whose contributions these are (the site owner's GitHub login). */
  login: string;
  /** Commits authored by me (capped at one page; treat 100 as "100+"). */
  commits?: number;
  /** ISO timestamp of my most recent commit. */
  lastCommitAt?: string;
  /** PRs I've opened that are still open. */
  openPrs?: number;
  /** PRs I've opened that have merged. */
  mergedPrs?: number;
};

/** A repo I contribute to but don't own, declared in data/ally-alley.v1.json. */
export type AllyConfigEntry = {
  repo: string;
  displayName?: string;
  blurb?: string;
  /** Persisted City Planner placement (town coords). Falls back to auto-layout. */
  position?: { x: number; y: number };
};

/** Fetched ally repo metadata plus its config slot, ready to fold into a Stop. */
export type AllyInput = {
  meta: RepoMeta;
  /** Stable index from the config list — drives the isle's position. */
  index: number;
  displayName?: string;
  blurb?: string;
  position?: { x: number; y: number };
};

/** The curated ally list, in declaration order. */
export function allyEntries(): AllyConfigEntry[] {
  return (allyAlleyConfig.allies ?? []) as AllyConfigEntry[];
}

/** The GitHub login whose contributions Ally Alley tracks. */
export function allyContributorLogin(): string {
  return (
    (allyAlleyConfig as { contributorLogin?: string }).contributorLogin ??
    "ScienceIsNeato"
  );
}

type StatusState =
  | "idea"
  | "wip"
  | "shipping"
  | "maintenance"
  | "dormant"
  | "unknown";

type QueueEntry = {
  active: boolean;
  milestone?: string;
  etaDays?: number;
  priority?: number;
};

type ActiveBranch = {
  name: string;
  compareUrl: string;
  pushedAt?: string;
  commitHash?: string;
  isDefault: boolean;
};

type ReleaseInfo = {
  name: string;
  tagName?: string;
  publishedAt?: string;
};

export type GitHubWorkflowRun = {
  name: string;
  status: "success" | "running" | "failed" | "neutral";
  url: string;
};

type GitHubRecentCommit = {
  message: string;
  url: string;
  committedAt: string;
};

type WillvilleManifestProject = {
  name?: string;
  displayName?: string;
  district?: string;
  stop?: string;
  lines?: string[];
  visibility?: "public" | "mayor";
  homepage?: string;
  repo?: string;
};

type WillvilleManifestStatus = {
  state?: StatusState;
  summary?: string;
  blockers?: string[];
  next?: string[];
  updated?: string;
};

type WillvilleManifestQueue = {
  active?: boolean;
  milestone?: string;
  etaDays?: number;
  targetDate?: string;
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
    /** Repo-authored summary/headline. */
    summary?: string;
    updated?: string;
  };
  queue?: QueueEntry;
  /** When the repo was created (ISO string). */
  createdAt?: string;
  /** Repo size in KB as reported by GitHub. */
  sizeKb?: number;
  /** Total commits on the default branch. */
  totalCommits?: number;
  /** Open issues + PRs on GitHub. */
  openIssues?: number;
  /** GitHub star count. */
  stars?: number;
  /** Primary language reported by GitHub. */
  language?: string;
  /** Open pull requests on GitHub. */
  openPrCount?: number;
  /** Total branches in the repository. */
  branchCount?: number;
  /** Commit count over the last 3 calendar days. */
  commits3d?: number;
  /** Commit count over the last 7 calendar days. */
  commits7d?: number;
  /** Commit count over the last 21 calendar days (3 weekly buckets). */
  commits21d?: number;
  /** Timestamp for the latest commit returned by GitHub's commits endpoint. */
  lastCommitAt?: string;
  /** Timestamp for the most recently merged pull request. */
  lastMergeAt?: string;
  /** Latest published release, if any. */
  latestRelease?: ReleaseInfo;
  /** Most recently committed branch in the repo. */
  activeBranch?: ActiveBranch;
  /** Last 3 commits for the repo in reverse chronological order. */
  recentCommits?: GitHubRecentCommit[];
  /** Last 3 GitHub Actions workflow runs for the repo. */
  workflowRuns?: GitHubWorkflowRun[];
  /** Committed Willville agent packet from .willville.json, if present. */
  agent?: WillvilleAgentPacket;
  /** "owned" (default, my town) or "ally" (a repo I contribute to, in Ally Alley). */
  source?: "owned" | "ally";
  /** My contribution footprint — populated for ally stops only. */
  contribution?: Contribution;
};

/**
 * Days until the milestone, derived from `eta_days` first, then `target_date`.
 * Returns Number.POSITIVE_INFINITY when nothing is set.
 */
function deriveEtaDays(
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

type OpenMilestone = {
  title: string;
  dueOn: string | null;
  openIssues: number;
};

type WillvilleAgentPacket = {
  status?: string;
  direction?: string;
  difficulties?: string;
  needsHuman?: string;
  lastUpdate?: string;
  sourceBranch?: string;
  sourceCommitHash?: string;
  sourceBlobSha?: string;
};

export type WillvilleManifest = {
  schemaVersion?: number;
  project?: WillvilleManifestProject;
  status?: WillvilleManifestStatus;
  queue?: WillvilleManifestQueue;
  agent?: WillvilleAgentPacket;
};

export type RepoMeta = {
  repo: string; // "owner/name"
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  pushedAt: string;
  createdAt?: string;
  defaultBranch: string;
  homepage?: string;
  /** GitHub repo description — fallback summary if no willville packet. */
  description?: string;
  /** Repo size in KB as reported by GitHub. */
  sizeKb?: number;
  /** Total commits on default branch. */
  totalCommits?: number;
  /** GitHub topics — used to auto-assign district and transit lines. */
  topics?: string[];
  /** Open milestones sorted by due date ascending. */
  openMilestones?: OpenMilestone[];
  /** Parsed committed .willville.json manifest, if present. */
  willvilleManifest?: WillvilleManifest;
  /** Open issues + PRs count from GitHub. */
  openIssuesCount?: number;
  /** GitHub star count. */
  stars?: number;
  /** Primary language reported by GitHub. */
  language?: string;
  /** Open pull requests on GitHub. */
  openPrCount?: number;
  /** Total branches in the repository. */
  branchCount?: number;
  /** Commit count over the last 3 calendar days. */
  commits3d?: number;
  /** Commit count over the last 7 calendar days. */
  commits7d?: number;
  /** Commit count over the last 21 calendar days (3 weekly buckets). */
  commits21d?: number;
  /** Timestamp for the latest commit returned by GitHub's commits endpoint. */
  lastCommitAt?: string;
  /** Timestamp for the most recently merged pull request. */
  lastMergeAt?: string;
  /** Latest published release, if any. */
  latestRelease?: ReleaseInfo;
  /** Most recently committed branch in the repo. */
  activeBranch?: ActiveBranch;
  /** Last 3 commits for the repo in reverse chronological order. */
  recentCommits?: GitHubRecentCommit[];
  /** Last 3 GitHub Actions workflow runs for the repo. */
  workflowRuns?: GitHubWorkflowRun[];
  /** "owned" (default) or "ally". */
  source?: "owned" | "ally";
  /** My contribution footprint — set for ally repos. */
  contribution?: Contribution;
};

// ---------------------------------------------------------------------------
// Topic-based line mapping
// ---------------------------------------------------------------------------

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

const DISTRICT_IDS = new Set<DistrictId>(DISTRICTS.map(({ id }) => id));
const LINE_IDS = new Set<LineId>(LINES.map(({ id }) => id));

function normalizeManifestDistrict(
  district: string | undefined,
): DistrictId | undefined {
  if (!district) return undefined;
  return DISTRICT_IDS.has(district as DistrictId)
    ? (district as DistrictId)
    : undefined;
}

function normalizeManifestLines(
  lines: string[] | undefined,
): LineId[] | undefined {
  if (!lines) return undefined;
  const valid = lines.filter((line): line is LineId =>
    LINE_IDS.has(line as LineId),
  );
  return valid.length > 0 ? [...new Set(valid)] : undefined;
}

function topicsToLines(topics: string[]): LineId[] {
  const seen = new Set<LineId>();
  for (const t of topics) {
    const l = TOPIC_LINE[t.toLowerCase()];
    if (l) seen.add(l);
  }
  return [...seen];
}

/**
 * Deterministic position within a district derived from the repo full name.
 * Stable across syncs — same repo always lands in the same spot.
 */
function autoPosition(
  districtId: DistrictId,
  repo: string,
  stopId: string,
): { x: number; y: number } {
  return sitePositionForStop(districtId, stopId, repo);
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
 * Derive queue entry from GitHub open milestones.
 * Falls back to heuristic queue if no milestones exist.
 */
function deriveQueue(
  manifestQueue: WillvilleManifestQueue | undefined,
  openMilestones: OpenMilestone[] | undefined,
  heuristicQueue: Heuristic["queue"] | undefined,
): QueueEntry | undefined {
  if (manifestQueue) {
    const etaDays = deriveEtaDays({
      eta_days: manifestQueue.etaDays,
      target_date: manifestQueue.targetDate,
    });
    return {
      active: manifestQueue.active ?? true,
      milestone: manifestQueue.milestone,
      etaDays: Number.isFinite(etaDays ?? NaN) ? etaDays : undefined,
      priority: manifestQueue.priority,
    };
  }
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
function buildStop(meta: RepoMeta, heuristic?: Heuristic): Stop {
  const manifest = meta.willvilleManifest;
  const manifestProject = manifest?.project;
  const manifestStatus = manifest?.status;
  const agent = manifest?.agent;
  const district =
    normalizeManifestDistrict(manifestProject?.district) ??
    heuristic?.district ??
    "the-nursery";
  const lines =
    normalizeManifestLines(manifestProject?.lines) ??
    heuristic?.lines ??
    topicsToLines(meta.topics ?? []);
  const stopId = meta.repo.split("/")[1]!.toLowerCase();
  const displayName =
    manifestProject?.displayName ?? repoDisplayName(meta.repo);
  const position =
    heuristic?.position ?? autoPosition(district, meta.repo, stopId);
  const queue = deriveQueue(
    manifest?.queue,
    meta.openMilestones,
    heuristic?.queue,
  );
  return {
    id: stopId,
    displayName,
    district,
    lines,
    position,
    repo: meta.repo,
    homepage: manifestProject?.homepage ?? meta.homepage,
    blurb: heuristic?.blurb,
    glyph: heuristic?.glyph ?? defaultGlyphForRepo(meta.repo),
    visibility: manifestProject?.visibility ?? "public",
    isPrivate: meta.isPrivate,
    status: {
      state: manifestStatus?.state ?? "unknown",
      doing: agent?.status,
      next: agent?.direction,
      blocked:
        manifestStatus?.blockers?.[0] ?? normalizeNone(agent?.difficulties),
      summary: manifestStatus?.summary,
      updated: agent?.lastUpdate ?? manifestStatus?.updated,
    },
    queue,
    createdAt: meta.createdAt,
    sizeKb: meta.sizeKb,
    totalCommits: meta.totalCommits,
    openIssues: meta.openIssuesCount,
    stars: meta.stars,
    language: meta.language,
    openPrCount: meta.openPrCount,
    branchCount: meta.branchCount,
    commits3d: meta.commits3d,
    commits7d: meta.commits7d,
    commits21d: meta.commits21d,
    lastCommitAt: meta.lastCommitAt,
    lastMergeAt: meta.lastMergeAt,
    latestRelease: meta.latestRelease,
    activeBranch: meta.activeBranch,
    recentCommits: meta.recentCommits,
    workflowRuns: meta.workflowRuns,
    agent,
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

// ---------------------------------------------------------------------------
// Ally Alley — repos I contribute to but don't own.
//
// Ally Alley is a real district (south of the Gates of Hell, on the green land),
// so ally stops get the same deterministic in-polygon placement as owned stops
// via sitePositionForStop. They skip the .willville.json / heuristic district
// assignment and are pinned to "ally-alley" with source: "ally".
// ---------------------------------------------------------------------------

/**
 * Ally repos don't broadcast a .willville.json packet, so there's no declared
 * lifecycle state — without this they'd always read "unknown" even when the
 * project is clearly active. Derive a sensible state from GitHub commit recency
 * so the isle reflects real liveliness.
 */
function allyStateFromSignals(meta: RepoMeta): StatusState {
  if (meta.isArchived) return "dormant";
  const commits7d = meta.commits7d ?? 0;
  const commits21d = meta.commits21d ?? 0;
  const lastCommit = meta.lastCommitAt ? Date.parse(meta.lastCommitAt) : NaN;
  const daysSinceCommit = Number.isFinite(lastCommit)
    ? (Date.now() - lastCommit) / 86_400_000
    : Infinity;
  if (commits7d > 0) return "wip"; // pushed something within the week
  if (commits21d > 0 || daysSinceCommit <= 60) return "maintenance"; // recent-ish
  return "dormant"; // quiet for a couple of months
}

function buildAllyStop(input: AllyInput): Stop {
  const { meta } = input;
  const stopId = meta.repo.split("/")[1]!.toLowerCase();
  const manifest = meta.willvilleManifest;
  const agent = manifest?.agent;
  const manifestStatus = manifest?.status;
  return {
    id: stopId,
    displayName: input.displayName ?? repoDisplayName(meta.repo),
    district: "ally-alley",
    lines: [],
    position:
      input.position ?? sitePositionForStop("ally-alley", stopId, meta.repo),
    repo: meta.repo,
    homepage: meta.homepage,
    blurb: input.blurb,
    glyph: defaultGlyphForRepo(meta.repo),
    visibility: "public",
    isPrivate: meta.isPrivate,
    source: "ally",
    contribution: meta.contribution,
    // Use .willville.json when present (same fields as owned repos: agent
    // status/direction, manifest state). Fall back to signal-derived state
    // (commit recency) so the building still reads as alive without a packet.
    status: {
      state: manifestStatus?.state ?? allyStateFromSignals(meta),
      doing: agent?.status,
      next: agent?.direction,
      blocked:
        manifestStatus?.blockers?.[0] ?? normalizeNone(agent?.difficulties),
      summary: manifestStatus?.summary ?? meta.description,
      updated: agent?.lastUpdate ?? manifestStatus?.updated,
    },
    createdAt: meta.createdAt,
    sizeKb: meta.sizeKb,
    totalCommits: meta.totalCommits,
    openIssues: meta.openIssuesCount,
    stars: meta.stars,
    language: meta.language,
    openPrCount: meta.openPrCount,
    branchCount: meta.branchCount,
    commits3d: meta.commits3d,
    commits7d: meta.commits7d,
    commits21d: meta.commits21d,
    lastCommitAt: meta.lastCommitAt,
    lastMergeAt: meta.lastMergeAt,
    latestRelease: meta.latestRelease,
    activeBranch: meta.activeBranch,
    recentCommits: meta.recentCommits,
    workflowRuns: meta.workflowRuns,
  };
}

/** Fold fetched ally repo metadata into ally Stops. */
export function buildAllyStops(inputs: AllyInput[]): Stop[] {
  return inputs.map(buildAllyStop);
}

// Remove re-export of DISTRICTS and LINES - not used by app

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
    const stopId = h.repo.split("/")[1]!.toLowerCase();
    stops.push({
      id: stopId,
      displayName: repoDisplayName(h.repo),
      district: h.district,
      lines: h.lines,
      position: h.position ?? autoPosition(h.district, h.repo, stopId),
      repo: h.repo,
      blurb: h.blurb,
      glyph: h.glyph ?? defaultGlyphForRepo(h.repo),
      visibility: "public",
      status: { state: "unknown" },
      queue: h.queue,
    });
  }
  // Ally Alley placeholders so the isles render on first paint; the live GitHub
  // signal + my contribution footprint arrive via /api/town after a bell ring.
  // Skip any ally whose slug already exists (owned repo wins) so stop ids stay
  // unique — the same dedup the snapshot builder applies.
  const existingIds = new Set(stops.map((stop) => stop.id));
  allyEntries().forEach((entry) => {
    const stopId = entry.repo.split("/")[1]!.toLowerCase();
    if (existingIds.has(stopId)) return;
    existingIds.add(stopId);
    stops.push({
      id: stopId,
      displayName: entry.displayName ?? repoDisplayName(entry.repo),
      district: "ally-alley",
      lines: [],
      position:
        entry.position ?? sitePositionForStop("ally-alley", stopId, entry.repo),
      repo: entry.repo,
      blurb: entry.blurb,
      glyph: defaultGlyphForRepo(entry.repo),
      visibility: "public",
      source: "ally",
      status: { state: "unknown" },
    });
  });
  return stops;
}

function repoDisplayName(repo: string): string {
  return repo.split("/").at(-1) ?? repo;
}

function normalizeNone(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.trim().toLowerCase() === "none" ? undefined : value;
}

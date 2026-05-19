/**
 * Town data merge logic.
 *
 * Combines:
 *   1. Manual stops from willville.ts
 *   2. Per-repo heuristics from willville.heuristics.ts
 *   3. .willville.json manifests fetched live from each repo's default branch
 *   4. Optional GitHub repo metadata (default branch, last pushed)
 *
 * The result is a flat array of Stop objects that the SVG layer renders.
 */
import {
  DISTRICTS,
  LINES,
  MANUAL_STOPS,
  type DistrictId,
  type LineId,
} from "./willville";
import { HEURISTICS, type Heuristic } from "./willville.heuristics";
import type { Manifest } from "./manifest";

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

export type RepoMeta = {
  repo: string; // "owner/name"
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  pushedAt: string;
  defaultBranch: string;
  homepage?: string;
};

export type RepoWithManifest = {
  meta: RepoMeta;
  manifest: Manifest | null;
};

/** Merge a heuristic + manifest into a Stop. */
export function buildStop(
  meta: RepoMeta,
  manifest: Manifest | null,
  heuristic?: Heuristic,
): Stop {
  const project = manifest?.project ?? {};
  const status = manifest?.status ?? {};
  const displayName =
    project.display_name ?? heuristic?.displayName ?? meta.repo.split("/")[1];
  const district =
    (project.district as DistrictId | undefined) ??
    heuristic?.district ??
    "the-hearth";
  const lines =
    (project.lines as LineId[] | undefined) ?? heuristic?.lines ?? [];
  const stopId =
    project.stop ?? heuristic?.stopId ?? meta.repo.split("/")[1].toLowerCase();
  const queue = mergeQueue(manifest?.queue, heuristic?.queue);
  return {
    id: stopId,
    displayName,
    district,
    lines,
    position: heuristic?.position ?? { x: 800, y: 500 },
    repo: meta.repo,
    homepage: project.homepage ?? meta.homepage,
    blurb: heuristic?.blurb,
    visibility: project.visibility ?? "public",
    isPrivate: meta.isPrivate,
    status: {
      state: status.state ?? "unknown",
      summary: status.summary,
      blockers: status.blockers ?? [],
      next: status.next ?? [],
      updated: status.updated ?? meta.pushedAt,
    },
    queue,
  };
}

/** Manifest queue wins over heuristic queue. Returns undefined if neither. */
function mergeQueue(
  fromManifest: Manifest["queue"] | undefined,
  fromHeuristic:
    | {
        active: boolean;
        milestone?: string;
        etaDays?: number;
        priority?: number;
      }
    | undefined,
): QueueEntry | undefined {
  if (!fromManifest && !fromHeuristic) return undefined;
  const etaFromManifest = fromManifest
    ? deriveEtaDays({
        eta_days: fromManifest.eta_days,
        target_date: fromManifest.target_date,
      })
    : Number.POSITIVE_INFINITY;
  return {
    active: fromManifest?.active ?? fromHeuristic?.active ?? false,
    milestone: fromManifest?.milestone ?? fromHeuristic?.milestone,
    etaDays: Number.isFinite(etaFromManifest)
      ? etaFromManifest
      : fromHeuristic?.etaDays,
    priority: fromManifest?.priority ?? fromHeuristic?.priority,
  };
}

/** Build the full Stop array including manual stops + heuristic-only stops. */
export function buildTown(
  reposWithManifests: RepoWithManifest[],
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
  for (const { meta, manifest } of reposWithManifests) {
    const heuristic = HEURISTICS.find(
      (h) => h.repo.toLowerCase() === meta.repo.toLowerCase(),
    );
    const stop = buildStop(meta, manifest, heuristic);
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

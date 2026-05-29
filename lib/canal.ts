/**
 * The Canal & Locks.
 *
 * Willville is a coastal town. PRs come in from the sea, queue up at the locks,
 * and either get raised through to the Open Sea (merged) or sit in the lock
 * they're "nosed up against" — Inspection, Review, Edits, or Final.
 *
 * Lock layout follows the curved canal path; boats offset perpendicular to the
 * channel at each chamber.
 */
import { CANAL } from "./willville";
import { lockCenterAt } from "./canal-path";
import type { DistrictId } from "./willville";

export type LockId =
  | "open-dock"
  | "inspection"
  | "review"
  | "edits"
  | "final"
  | "open-sea"
  | "scuttle";

export type Lock = {
  id: LockId;
  displayName: string;
  description: string;
  centerX: number;
  centerY: number;
  /** Radians — tangent along the canal at this chamber. */
  angle: number;
};

const LOCK_DEFS: Array<{
  id: LockId;
  displayName: string;
  description: string;
}> = [
  {
    id: "open-dock",
    displayName: "Open Dock",
    description: "Drafts and freshly opened PRs.",
  },
  {
    id: "inspection",
    displayName: "Inspection Lock",
    description: "Waiting on CI checks.",
  },
  {
    id: "review",
    displayName: "Holding Lock",
    description: "CI is red and there are no open threads yet — agent's move.",
  },
  {
    id: "edits",
    displayName: "Edits Eddy",
    description: "Open review threads to clear — agent's move.",
  },
  {
    id: "final",
    displayName: "The Narrows",
    description: "Green and clean. Mayor's move: merge me.",
  },
  {
    id: "open-sea",
    displayName: "Open Sea",
    description: "Merged. Off into the wide blue.",
  },
  {
    id: "scuttle",
    displayName: "The Scuttle",
    description: "Closed without merging. Hauled off-channel.",
  },
];

/** Perpendicular distance the scuttle sits off the main channel. */
const SCUTTLE_OFFSET = 150;

const OPEN_SEA_INDEX = LOCK_DEFS.findIndex((d) => d.id === "open-sea");

export const LOCKS: Lock[] = LOCK_DEFS.map((def, i) => {
  if (def.id === "scuttle") {
    // No path slot of its own — hauled perpendicular off the open-sea mouth.
    const sea = lockCenterAt(OPEN_SEA_INDEX);
    const perp = sea.angle + Math.PI / 2;
    return {
      ...def,
      centerX: sea.x + Math.cos(perp) * SCUTTLE_OFFSET,
      centerY: sea.y + Math.sin(perp) * SCUTTLE_OFFSET,
      angle: sea.angle,
    };
  }
  const c = lockCenterAt(i);
  return {
    ...def,
    centerX: c.x,
    centerY: c.y,
    angle: c.angle,
  };
});

/** Channel locks in order — excludes the off-channel scuttle. */
export const CHANNEL_LOCKS: Lock[] = LOCKS.filter((l) => l.id !== "scuttle");

export type CanalBoat = {
  prNumber: number;
  repo: string;
  title: string;
  author: string;
  url: string;
  lock: LockId;
  draft: boolean;
  createdAt: string;
  updatedAt: string;
  /** District color used to tint the hull. */
  district?: DistrictId;
  /** Stop the PR belongs to, when known. */
  stopId?: string;
  /** Buff rounds weathered, read from the `buff-rounds/N` PR label. */
  rounds: number;
  /** Latest CI rollup state for this PR. */
  ciState?: "success" | "failure" | "pending" | null;
  /** True when the PR still has unresolved review threads. */
  hasOpenComments?: boolean;
};

/**
 * GitHub PR signals → lock id.
 *
 * Solo workflow: nobody approves or requests changes. The only honest signals
 * are CI (red/green/pending) and whether unresolved review threads remain.
 * Those two combine into four states; everything else is a lifecycle edge.
 *
 *   CI     | comments | lock          | whose move
 *   -------+----------+---------------+-----------
 *   red    | open     | edits (deep)  | agent
 *   red    | none     | review (hold) | agent
 *   green  | open     | edits (shallow)| agent
 *   green  | none     | final/narrows | MAYOR
 */
export function lockForPr(input: {
  state: "open" | "closed";
  merged: boolean;
  draft: boolean;
  checksState: "success" | "failure" | "pending" | null;
  hasOpenComments: boolean;
}): LockId {
  if (input.merged) return "open-sea";
  if (input.state === "closed") return "scuttle";
  if (input.draft) return "open-dock";
  // CI still running (or not reported yet) — nose up against Inspection.
  if (input.checksState === "pending" || input.checksState === null)
    return "inspection";
  // Open threads pull the boat into the eddy regardless of CI color.
  if (input.hasOpenComments) return "edits";
  // Red CI with no threads yet — back to the bench in the holding lock.
  if (input.checksState === "failure") return "review";
  // Green and clean — riding the narrows, waiting on the Mayor.
  return "final";
}

/** Bow points west (into town) only for the Mayor's move; otherwise east. */
export function isMayorMove(lock: LockId): boolean {
  return lock === "final";
}

/**
 * Position boats inside a lock chamber, offset perpendicular to the canal.
 */
export function boatPosition(
  lock: LockId,
  indexInLock: number,
  opts?: { depth?: number },
): { x: number; y: number } {
  const l = LOCKS.find((x) => x.id === lock);
  if (!l) {
    return { x: CANAL.left + 40, y: CANAL.bottom - 80 };
  }
  const row = indexInLock % 3;
  const col = Math.floor(indexInLock / 3);
  const perp = l.angle + Math.PI / 2;
  const along = l.angle;
  // Eddy depth (0..1) nudges threaded boats further into the chamber so a
  // red-CI boat sits visibly deeper than a green-CI one in the same eddy.
  const depth = Math.max(0, Math.min(1, opts?.depth ?? 0));
  const perpOffset = (col - 0.5) * 22 + depth * 18;
  const alongOffset = row * 28 - 14 + depth * 24;
  return {
    x: l.centerX + Math.cos(perp) * perpOffset + Math.cos(along) * alongOffset,
    y: l.centerY + Math.sin(perp) * perpOffset + Math.sin(along) * alongOffset,
  };
}

/** Half-width of gate posts drawn perpendicular to the canal. */
export const GATE_HALF_WIDTH = 52;

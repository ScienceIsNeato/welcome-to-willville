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
  | "open-sea";

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
    displayName: "Review Lock",
    description: "Awaiting human review.",
  },
  {
    id: "edits",
    displayName: "Edits Lock",
    description: "Changes requested. Back to the bench.",
  },
  {
    id: "final",
    displayName: "Final Lock",
    description: "Approved, mergeable, riding the last wave in.",
  },
  {
    id: "open-sea",
    displayName: "Open Sea",
    description: "Merged. Off into the wide blue.",
  },
];

export const LOCKS: Lock[] = LOCK_DEFS.map((def, i) => {
  const c = lockCenterAt(i);
  return {
    ...def,
    centerX: c.x,
    centerY: c.y,
    angle: c.angle,
  };
});

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
};

/**
 * GitHub PR signals → lock id.
 */
export function lockForPr(input: {
  state: "open" | "closed";
  merged: boolean;
  draft: boolean;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  checksState: "success" | "failure" | "pending" | null;
  mergeable: boolean | null;
}): LockId {
  if (input.merged) return "open-sea";
  if (input.state === "closed") return "open-sea";
  if (input.draft) return "open-dock";
  if (input.checksState === "pending") return "inspection";
  if (input.checksState === "failure") return "edits";
  if (input.reviewDecision === "CHANGES_REQUESTED") return "edits";
  if (input.reviewDecision === "APPROVED" && input.mergeable !== false)
    return "final";
  return "review";
}

/**
 * Position boats inside a lock chamber, offset perpendicular to the canal.
 */
export function boatPosition(
  lock: LockId,
  indexInLock: number,
): { x: number; y: number } {
  const l = LOCKS.find((x) => x.id === lock);
  if (!l) {
    return { x: CANAL.left + 40, y: CANAL.bottom - 80 };
  }
  const row = indexInLock % 3;
  const col = Math.floor(indexInLock / 3);
  const perp = l.angle + Math.PI / 2;
  const along = l.angle;
  const perpOffset = (col - 0.5) * 22;
  const alongOffset = row * 28 - 14;
  return {
    x: l.centerX + Math.cos(perp) * perpOffset + Math.cos(along) * alongOffset,
    y: l.centerY + Math.sin(perp) * perpOffset + Math.sin(along) * alongOffset,
  };
}

/** Half-width of gate posts drawn perpendicular to the canal. */
export const GATE_HALF_WIDTH = 52;

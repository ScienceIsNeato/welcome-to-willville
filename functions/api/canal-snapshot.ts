/**
 * Shared canal-boat builder + durable persistence.
 *
 * The bell (POST /api/manifests) is the sole writer of the canal snapshot. It
 * runs the live GitHub GraphQL query for PR state across every ScienceIsNeato
 * repo, maps each PR onto a canal lock, and persists the resulting boats here.
 * The read path (GET /api/canal) only ever reads this snapshot — it never
 * re-queries GitHub on read or writes to the DB.
 *
 * The snapshot is stored without a TTL, so it survives until the next bell ring
 * overwrites it: ringing the bell from any client refreshes the canal for every
 * future session.
 */

import { lockForPr, type CanalBoat, type LockId } from "../../lib/canal";
import { HEURISTICS } from "../../lib/willville.heuristics";
import allyAlleyConfig from "../../data/ally-alley.v1.json";
import { type ManifestCacheStore } from "./town-manifests";

const OWNER = "ScienceIsNeato";

/** owner/name slugs for the ally repos (someone else's repos I contribute to). */
function allyRepoFullNames(): string[] {
  const allies =
    (allyAlleyConfig as { allies?: Array<{ repo?: string }> }).allies ?? [];
  return allies
    .map((a) => a.repo)
    .filter((r): r is string => typeof r === "string" && r.includes("/"));
}

export const CANAL_SNAPSHOT_KEY = "willville:canal:snapshot:v1";

export type CanalSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  /**
   * When the bell last rang and this snapshot was committed. The next bell ring
   * uses this as its `since` date so it only fetches PRs merged after this
   * moment — keeping each ring bounded regardless of how far back history goes.
   * Absent on old snapshots; the next ring will treat that as "never rung" and
   * do the full 2-year backfill once.
   */
  lastBellRingAt?: string;
  manifestCachedAt?: string;
  boats: CanalBoat[];
};

type GraphQLPR = {
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  state: "OPEN" | "CLOSED" | "MERGED";
  createdAt: string;
  updatedAt: string;
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  author: { login: string } | null;
  repository: { nameWithOwner: string; isPrivate: boolean };
  labels: { nodes: Array<{ name: string }> } | null;
  reviewThreads: { nodes: Array<{ isResolved: boolean }> } | null;
  commits: {
    nodes: Array<{
      commit: {
        statusCheckRollup: {
          state: "SUCCESS" | "FAILURE" | "PENDING" | "ERROR";
        } | null;
      };
    }>;
  };
};

const QUERY = `
query ($q: String!, $cursor: String) {
  search(query: $q, type: ISSUE, first: 100, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number
        title
        url
        isDraft
        state
        createdAt
        updatedAt
        mergeable
        reviewDecision
        author { login }
        repository { nameWithOwner isPrivate }
        labels(first: 20) { nodes { name } }
        reviewThreads(first: 50) { nodes { isResolved } }
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup { state }
            }
          }
        }
      }
    }
  }
}`;

function repoToStop(repo: string) {
  const h = HEURISTICS.find((x) => x.repo.toLowerCase() === repo.toLowerCase());
  if (h) {
    return {
      district: h.district,
      stopId: h.repo.split("/")[1]!.toLowerCase(),
    };
  }
  // Ally repos aren't in HEURISTICS — they live in Ally Alley, with a stop id
  // that's the lowercase repo slug (matching buildAllyStop in lib/town).
  const ally = allyRepoFullNames().find(
    (r) => r.toLowerCase() === repo.toLowerCase(),
  );
  if (ally) {
    return {
      district: "ally-alley" as const,
      stopId: ally.split("/")[1]!.toLowerCase(),
    };
  }
  return undefined;
}

const BUFF_ROUNDS_PREFIX = "buff-rounds/";

/** Highest `buff-rounds/N` label value on the PR, or 0 when none present. */
function roundsFromLabels(pr: GraphQLPR): number {
  const names = pr.labels?.nodes ?? [];
  let rounds = 0;
  for (const { name } of names) {
    if (!name.startsWith(BUFF_ROUNDS_PREFIX)) continue;
    const n = Number.parseInt(name.slice(BUFF_ROUNDS_PREFIX.length), 10);
    if (Number.isFinite(n) && n > rounds) rounds = n;
  }
  return rounds;
}

function mapPr(pr: GraphQLPR): CanalBoat {
  const checkState =
    pr.commits.nodes[0]?.commit?.statusCheckRollup?.state ?? null;
  const checksState: "success" | "failure" | "pending" | null =
    checkState === "SUCCESS"
      ? "success"
      : checkState === "PENDING"
        ? "pending"
        : checkState === "FAILURE" || checkState === "ERROR"
          ? "failure"
          : null;
  const hasOpenComments = (pr.reviewThreads?.nodes ?? []).some(
    (t) => !t.isResolved,
  );
  const rounds = roundsFromLabels(pr);
  const lock: LockId = lockForPr({
    state: pr.state === "OPEN" ? "open" : "closed",
    merged: pr.state === "MERGED",
    draft: pr.isDraft,
    checksState,
    hasOpenComments,
  });
  const stop = repoToStop(pr.repository.nameWithOwner);
  return {
    prNumber: pr.number,
    repo: pr.repository.nameWithOwner,
    title: pr.repository.isPrivate ? "private" : pr.title,
    author: pr.author?.login ?? "unknown",
    url: pr.url,
    lock,
    draft: pr.isDraft,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    district: stop?.district,
    stopId: stop?.stopId,
    rounds,
    ciState: checksState,
    hasOpenComments,
  };
}

/**
 * Run the live GitHub GraphQL query and map every PR onto a canal boat.
 *
 * Throws if GitHub returns a non-OK response, so callers can decide how to
 * degrade. Requires a token; without one the canal is empty by definition.
 *
 * @param since - ISO date string for the merged-PR lower bound. When provided
 *   (subsequent bell rings) only PRs merged after this moment are fetched,
 *   keeping the query bounded. When absent (first ring / cold-DB) the full
 *   2-year backfill runs — expect ~3 min on the first ring.
 */
export async function buildCanalBoats(
  token: string,
  allyToken?: string,
  since?: string,
): Promise<CanalBoat[]> {
  const DAY = 24 * 60 * 60 * 1000;
  // First ring (no since) → 2-year backfill. Subsequent rings → delta only.
  const cutoffDate = since
    ? since.split("T")[0]!
    : new Date(Date.now() - 2 * 365 * DAY).toISOString().split("T")[0]!;
  const scuttleCutoffDate = new Date(Date.now() - DAY)
    .toISOString()
    .split("T")[0]!;

  async function fetchPage(
    q: string,
    cursor: string | null,
    authToken: string,
  ): Promise<{
    nodes: GraphQLPR[];
    hasNextPage: boolean;
    endCursor: string | null;
  }> {
    const r = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
        "User-Agent": "willville-edge",
      },
      body: JSON.stringify({ query: QUERY, variables: { q, cursor } }),
    });
    if (!r.ok) throw new Error(`GitHub GraphQL returned ${r.status}`);
    const payload = (await r.json()) as {
      data?: {
        search?: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: GraphQLPR[];
        };
      };
    };
    const search = payload.data?.search;
    return {
      nodes: (search?.nodes ?? []).filter((n) => n && n.repository),
      hasNextPage: search?.pageInfo.hasNextPage ?? false,
      endCursor: search?.pageInfo.endCursor ?? null,
    };
  }

  // Three bounded queries cover the full canal state with no page-size cap:
  //   1. All currently open PRs (may be older than a week — still on the canal).
  //   2. All PRs merged within the last 7 days (fills the Open Sea bay).
  //   3. All PRs closed-not-merged within the last day (scuttled wrecks).
  const queryShapes = (scope: string) => [
    `is:pr ${scope} is:open`,
    `is:pr ${scope} is:merged merged:>=${cutoffDate}`,
    `is:pr ${scope} is:closed is:unmerged closed:>=${scuttleCutoffDate}`,
  ];

  // Owner repos: searched by `user:` with the main token (fatal on failure —
  // the owner canal is the baseline). Ally repos: someone else's (often private)
  // repos the main fine-grained token can't read, so search them per-repo with
  // the dedicated ally token. Ally failures are non-fatal — a missing/invalid
  // ally token must never blank the owner canal.
  const ownerJobs = queryShapes(`user:${OWNER}`).map((q) => ({
    q,
    authToken: token,
    fatal: true,
  }));
  const allyAuth = allyToken ?? token;
  const allyJobs = allyRepoFullNames().flatMap((repo) =>
    queryShapes(`repo:${repo}`).map((q) => ({
      q,
      authToken: allyAuth,
      fatal: false,
    })),
  );

  const seen = new Set<string>();
  const nodes: GraphQLPR[] = [];
  for (const { q, authToken, fatal } of [...ownerJobs, ...allyJobs]) {
    try {
      let cursor: string | null = null;
      do {
        const page = await fetchPage(q, cursor, authToken);
        for (const node of page.nodes) {
          const key = `${node.repository.nameWithOwner}#${node.number}`;
          if (!seen.has(key)) {
            seen.add(key);
            nodes.push(node);
          }
        }
        cursor = page.hasNextPage ? page.endCursor : null;
      } while (cursor);
    } catch (err) {
      if (fatal) throw err;
      // Ally query failed (no ally token, expired, or lost access) — skip this
      // repo's boats and keep the rest of the canal afloat.
    }
  }

  let boats = nodes.map(mapPr);

  // Scuttled wrecks linger for a day then disappear — they don't accumulate.
  // Open-sea boats (merged PRs) are NOT filtered here: the bell ring caller
  // merges incoming boats with the accumulated fleet from previous rings, so
  // the full history lives in the snapshot rather than being re-fetched every
  // time. See mergeOpenSeaBoats + the bell handler in manifests.ts.
  const scuttleCutoff = Date.now() - DAY;
  boats = boats.filter((b) => {
    if (b.lock === "scuttle") return Date.parse(b.updatedAt) > scuttleCutoff;
    return true;
  });

  return boats;
}

/**
 * Merge two sets of open-sea boats, deduplicating by repo+prNumber.
 * Incoming boats with open-sea lock overwrite existing entries so metadata
 * stays fresh (title edits, author renames, etc.) while full history is kept.
 * Incoming boats with any other lock evict the old open-sea entry — this
 * handles PRs that reappear in the delta as scuttle or a canal lock (e.g.
 * a reopened PR), preventing the same PR from appearing twice in allBoats
 * and causing duplicate React keys on the map.
 */
export function mergeOpenSeaBoats(
  existing: CanalBoat[],
  incoming: CanalBoat[],
): CanalBoat[] {
  const map = new Map<string, CanalBoat>();
  for (const b of existing) {
    map.set(`${b.repo}#${b.prNumber}`, b);
  }
  for (const b of incoming) {
    const key = `${b.repo}#${b.prNumber}`;
    if (b.lock === "open-sea") {
      map.set(key, b);
    } else {
      // PR reappeared with a different lock — evict the stale open-sea entry
      // so it doesn't ghost alongside the boat's current position.
      map.delete(key);
    }
  }
  return [...map.values()];
}

export function parseCanalSnapshot(raw: unknown): CanalSnapshot | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const candidate = raw as Partial<CanalSnapshot>;
  if (candidate.schemaVersion !== 1) {
    return undefined;
  }

  if (typeof candidate.generatedAt !== "string") {
    return undefined;
  }

  if (!Array.isArray(candidate.boats)) {
    return undefined;
  }

  const manifestCachedAt =
    typeof candidate.manifestCachedAt === "string"
      ? candidate.manifestCachedAt
      : undefined;

  const lastBellRingAt =
    typeof candidate.lastBellRingAt === "string"
      ? candidate.lastBellRingAt
      : undefined;

  return {
    schemaVersion: 1,
    generatedAt: candidate.generatedAt,
    lastBellRingAt,
    manifestCachedAt,
    boats: candidate.boats as CanalBoat[],
  };
}

export async function readCanalSnapshot(
  store?: ManifestCacheStore,
): Promise<CanalSnapshot | undefined> {
  if (!store) {
    return undefined;
  }

  try {
    const raw = await store.get(CANAL_SNAPSHOT_KEY, { type: "json" });
    return parseCanalSnapshot(raw);
  } catch {
    return undefined;
  }
}

export async function persistCanalSnapshot(
  store: ManifestCacheStore | undefined,
  generatedAt: string,
  boats: CanalBoat[],
  manifestCachedAt?: string,
  lastBellRingAt?: string,
): Promise<void> {
  if (!store) {
    return;
  }

  try {
    // No TTL: the snapshot is owned by the bell and persists until the next
    // ring overwrites it, so a quiet canal never expires back to a blank DB.
    await store.put(
      CANAL_SNAPSHOT_KEY,
      JSON.stringify({
        schemaVersion: 1,
        generatedAt,
        lastBellRingAt,
        manifestCachedAt,
        boats,
      } satisfies CanalSnapshot),
    );
  } catch {
    // Keep the API available even if durable cache writes fail.
  }
}

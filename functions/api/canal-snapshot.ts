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
import { type ManifestCacheStore } from "./town-manifests";

const OWNER = "ScienceIsNeato";

export const CANAL_SNAPSHOT_KEY = "willville:canal:snapshot:v1";

export type CanalSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
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
  return h
    ? {
        district: h.district,
        stopId: h.repo.split("/")[1]!.toLowerCase(),
      }
    : undefined;
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
    title: pr.title,
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
 */
export async function buildCanalBoats(token: string): Promise<CanalBoat[]> {
  const DAY = 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - 7 * DAY)
    .toISOString()
    .split("T")[0]!;
  const scuttleCutoffDate = new Date(Date.now() - DAY)
    .toISOString()
    .split("T")[0]!;

  async function fetchPage(
    q: string,
    cursor: string | null,
  ): Promise<{
    nodes: GraphQLPR[];
    hasNextPage: boolean;
    endCursor: string | null;
  }> {
    const r = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
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
  const queries = [
    `is:pr user:${OWNER} is:open`,
    `is:pr user:${OWNER} is:merged merged:>=${cutoffDate}`,
    `is:pr user:${OWNER} is:closed is:unmerged closed:>=${scuttleCutoffDate}`,
  ];

  const seen = new Set<string>();
  const nodes: GraphQLPR[] = [];
  for (const q of queries) {
    let cursor: string | null = null;
    do {
      const page = await fetchPage(q, cursor);
      for (const node of page.nodes) {
        const key = `${node.repository.nameWithOwner}#${node.number}`;
        if (!seen.has(key)) {
          seen.add(key);
          nodes.push(node);
        }
      }
      cursor = page.hasNextPage ? page.endCursor : null;
    } while (cursor);
  }

  let boats = nodes.map(mapPr);

  // The Open Sea (the bay) shows merged PRs fanning out by age across rings that
  // run to a full week, so keep open-sea boats around for 7 days. Scuttled
  // wrecks still only linger for a day so they don't pile up forever.
  const openSeaCutoff = Date.now() - 7 * DAY;
  const scuttleCutoff = Date.now() - DAY;
  boats = boats.filter((b) => {
    if (b.lock === "open-sea") return Date.parse(b.updatedAt) > openSeaCutoff;
    if (b.lock === "scuttle") return Date.parse(b.updatedAt) > scuttleCutoff;
    return true;
  });

  return boats;
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

  return {
    schemaVersion: 1,
    generatedAt: candidate.generatedAt,
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
        boats,
      } satisfies CanalSnapshot),
    );
  } catch {
    // Keep the API available even if durable cache writes fail.
  }
}

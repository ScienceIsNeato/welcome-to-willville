/**
 * GET /api/canal
 *
 * Live PR status across all of Will's repos, mapped onto the canal's six locks.
 *
 * Uses the GitHub GraphQL API (requires a token) so we can get reviewDecision,
 * mergeable, and statusCheckRollup in a single round trip. The same GITHUB_PAT
 * already used by /api/town serves canal queries for all visitors; tourists
 * see only public-repo PRs, mayors see everything.
 *
 * Edge-cached. Tourists: s-maxage=45, stale-while-revalidate=180.
 * Mayors: private, no-store.
 */

import { HEURISTICS } from "../../lib/willville.heuristics";
import { lockForPr, type CanalBoat, type LockId } from "../../lib/canal";
import { withCorsHeaders } from "./cors";

interface Env {
  GITHUB_PAT?: string;
  WILLVILLE_MAYOR_KEY?: string;
}

const OWNER = "ScienceIsNeato";

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
query ($q: String!) {
  search(query: $q, type: ISSUE, first: 80) {
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

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const token = env.GITHUB_PAT;

  if (!token) {
    // Without a token we can't query GraphQL. Return an empty canal.
    return new Response(
      JSON.stringify({
        mayor: true,
        generatedAt: new Date().toISOString(),
        boats: [],
        warning: "GITHUB_PAT not configured — canal is empty.",
      }),
      {
        status: 200,
        headers: withCorsHeaders(request, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, s-maxage=30",
        }),
      },
    );
  }

  // Query open + recently merged PRs so the Open Sea isn't permanently empty.
  const query = `is:pr user:${OWNER} sort:updated-desc`;
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "willville-edge",
    },
    body: JSON.stringify({ query: QUERY, variables: { q: query } }),
  });

  if (!r.ok) {
    return new Response(
      JSON.stringify({
        mayor: true,
        generatedAt: new Date().toISOString(),
        boats: [],
        warning: `GitHub GraphQL returned ${r.status}`,
      }),
      {
        status: 200,
        headers: withCorsHeaders(request, {
          "Content-Type": "application/json; charset=utf-8",
        }),
      },
    );
  }

  const payload = (await r.json()) as {
    data?: { search?: { nodes: GraphQLPR[] } };
  };
  const nodes = (payload.data?.search?.nodes ?? []).filter(
    (n) => n && n.repository,
  );

  let boats = nodes.map(mapPr);

  // The Open Sea (the bay) shows merged PRs fanning out by age across rings that
  // run to a full week, so keep open-sea boats around for 7 days. Scuttled
  // wrecks still only linger for a day so they don't pile up forever.
  const DAY = 24 * 60 * 60 * 1000;
  const openSeaCutoff = Date.now() - 7 * DAY;
  const scuttleCutoff = Date.now() - DAY;
  boats = boats.filter((b) => {
    if (b.lock === "open-sea") return Date.parse(b.updatedAt) > openSeaCutoff;
    if (b.lock === "scuttle") return Date.parse(b.updatedAt) > scuttleCutoff;
    return true;
  });

  const cacheControl = "public, s-maxage=45, stale-while-revalidate=180";

  return new Response(
    JSON.stringify({
      mayor: true,
      generatedAt: new Date().toISOString(),
      boats,
    }),
    {
      headers: withCorsHeaders(request, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": cacheControl,
      }),
    },
  );
};

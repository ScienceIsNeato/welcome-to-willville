/**
 * POST /api/manifests
 *
 * Tolling the town bell:
 *   1. Query GitHub for the active ScienceIsNeato repo list
 *   2. Scrape `.willville.json` from each repo's active branch, with
 *      default-branch fallback
 *   3. Populate the runtime's in-memory manifest cache
 *   4. Return progress events so the UI can refresh against the hot cache
 *
 * Returns discovered, registered, newlyRegistered, cached, missing, errors.
 *
 * Requires GITHUB_PAT in env so private repos can be scraped too. Returns 403
 * without it.
 */

import type { PagesFunction } from "../types";
import type { RepoMeta, WillvilleManifest } from "../../lib/town";
import { heuristicForRepo } from "../../lib/willville.heuristics";
import { withCorsHeaders } from "./cors";
import {
  getManifestCacheCachedAt,
  type ManifestCacheStore,
  persistManifestCacheToStore,
  replaceManifestCache,
  WillvilleManifestClient,
} from "./town-manifests";
import { buildTownStops, persistTownSnapshot } from "./town-snapshot";
import {
  buildCanalBoats,
  mergeOpenSeaBoats,
  persistCanalSnapshot,
  readCanalSnapshot,
} from "./canal-snapshot";

interface Env {
  GITHUB_PAT?: string;
  /** Classic PAT with `repo` scope for ally repos (often private, other-owner). */
  ALLY_GITHUB_PAT?: string;
  WILLVILLE_MANIFEST_CACHE?: ManifestCacheStore;
}

const OWNER = "ScienceIsNeato";
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

type GitHubRepo = {
  full_name: string;
  fork: boolean;
  archived: boolean;
  pushed_at: string;
  default_branch: string;
};

type RegisteredRepo = {
  fullName: string;
  source: "registry" | "auto";
  stopId: string;
};

type ManifestStartEvent = {
  type: "start";
  discovered: string[];
  registered: RegisteredRepo[];
  newlyRegistered: string[];
  total: number;
};

type ManifestRepoEvent = {
  type: "repo";
  repo: string;
  stopId: string;
  result: "cached" | "missing" | "error";
};

type ManifestCompleteEvent = {
  type: "complete";
  cached: string[];
  missing: string[];
  errors: string[];
  discovered: string[];
  registered: RegisteredRepo[];
  newlyRegistered: string[];
  total: number;
};

function ghHeaders(token: string): Record<string, string> {
  return {
    "User-Agent": "willville-manifests",
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
  };
}

async function listRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  while (true) {
    const url = `https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner&sort=pushed&direction=desc`;
    const response = await fetch(url, { headers: ghHeaders(token) });
    if (!response.ok) break;
    const batch = (await response.json()) as GitHubRepo[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const repo of batch) {
      if (repo.full_name.startsWith(`${OWNER}/`)) {
        repos.push(repo);
      }
    }
    if (batch.length < 100) break;
    if (++page > 5) break;
  }
  return repos;
}

function compareUrl(
  fullName: string,
  baseBranch: string,
  branch: string,
): string {
  const safeBase = encodeURIComponent(baseBranch).replace(/%2F/g, "/");
  const safeBranch = encodeURIComponent(branch).replace(/%2F/g, "/");
  return `https://github.com/${fullName}/compare/${safeBase}...${safeBranch}`;
}

async function fetchActiveBranch(
  fullName: string,
  defaultBranch: string,
  token: string,
): Promise<RepoMeta["activeBranch"]> {
  const fallback: NonNullable<RepoMeta["activeBranch"]> = {
    name: defaultBranch,
    compareUrl: compareUrl(fullName, defaultBranch, defaultBranch),
    isDefault: true,
  };

  try {
    type GitHubPushEvent = {
      type: string;
      created_at: string;
      payload: { ref?: string; head?: string };
    };

    const response = await fetch(
      `https://api.github.com/repos/${fullName}/events?per_page=30`,
      { headers: ghHeaders(token) },
    );
    if (!response.ok) return fallback;

    const events = (await response.json()) as GitHubPushEvent[];
    if (!Array.isArray(events)) return fallback;

    const pushes = events.filter(
      (event) => event.type === "PushEvent" && event.payload?.ref,
    );
    const latestPush =
      pushes.find((event) => {
        const ref = (event.payload.ref ?? "").replace(/^refs\/heads\//, "");
        return ref !== defaultBranch;
      }) ?? pushes[0];

    if (!latestPush?.payload?.ref) return fallback;

    const branchName = latestPush.payload.ref.replace(/^refs\/heads\//, "");
    return {
      name: branchName,
      pushedAt: latestPush.created_at,
      commitHash: latestPush.payload.head,
      compareUrl: compareUrl(fullName, defaultBranch, branchName),
      isDefault: branchName === defaultBranch,
    };
  } catch {
    return fallback;
  }
}

function repoStopId(fullName: string): string {
  return fullName
    .split("/")
    .at(-1)!
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function registerRepo(fullName: string): RegisteredRepo {
  const heuristic = heuristicForRepo(fullName);
  const stopId = fullName.split("/")[1]!.toLowerCase();
  if (heuristic) {
    return {
      fullName,
      source: "registry",
      stopId,
    };
  }
  return {
    fullName,
    source: "auto",
    stopId,
  };
}

export const onRequestOptions: PagesFunction = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: withCorsHeaders(request),
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const token = env.GITHUB_PAT;
  if (!token) {
    return new Response(JSON.stringify({ error: "No GITHUB_PAT configured" }), {
      status: 403,
      headers: withCorsHeaders(request, {
        "Content-Type": "application/json",
      }),
    });
  }

  const repos = await listRepos(token);
  const cutoff = Date.now() - TWO_YEARS_MS;
  const candidates = repos.filter(
    (repo) =>
      !repo.fork && !repo.archived && Date.parse(repo.pushed_at) >= cutoff,
  );
  const registered = candidates.map((repo) => registerRepo(repo.full_name));
  const newlyRegistered = registered
    .filter((repo) => repo.source === "auto")
    .map((repo) => repo.fullName);
  const registeredByRepo = new Map(
    registered.map((repo) => [repo.fullName, repo] as const),
  );

  const manifestClient = new WillvilleManifestClient(token);
  const cached: string[] = [];
  const missing: string[] = [];
  const errors: string[] = [];
  const discovered = candidates.map((repo) => repo.full_name);
  const nextCache = new Map<string, WillvilleManifest>();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let streamClosed = false;
      const push = (
        event: ManifestStartEvent | ManifestRepoEvent | ManifestCompleteEvent,
      ) => {
        if (streamClosed) {
          return;
        }

        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          streamClosed = true;
        }
      };

      push({
        type: "start",
        discovered,
        registered,
        newlyRegistered,
        total: candidates.length,
      });

      await mapLimit(candidates, 8, async (repo) => {
        const registeredRepo = registeredByRepo.get(repo.full_name);

        try {
          const activeBranch = await fetchActiveBranch(
            repo.full_name,
            repo.default_branch,
            token,
          );
          const manifest = await manifestClient.fetchRepoManifest(
            repo.full_name,
            repo.default_branch,
            activeBranch,
          );

          if (!manifest) {
            missing.push(repo.full_name);
            push({
              type: "repo",
              repo: repo.full_name,
              stopId: registeredRepo?.stopId ?? repoStopId(repo.full_name),
              result: "missing",
            });
            return;
          }

          nextCache.set(repo.full_name, manifest);
          cached.push(repo.full_name);
          push({
            type: "repo",
            repo: repo.full_name,
            stopId: registeredRepo?.stopId ?? repoStopId(repo.full_name),
            result: "cached",
          });
        } catch {
          errors.push(repo.full_name);
          push({
            type: "repo",
            repo: repo.full_name,
            stopId: registeredRepo?.stopId ?? repoStopId(repo.full_name),
            result: "error",
          });
        }
      });

      replaceManifestCache(nextCache);
      await persistManifestCacheToStore(
        nextCache,
        env.WILLVILLE_MANIFEST_CACHE,
      );

      // The bell is the town's refresh trigger. Now that the manifest cache is
      // hot, run the full "huge query" and persist the rich town snapshot
      // (PR/commit/size/branch/workflow data) so the durable layer holds
      // everything a first client load needs — instead of deleting it and
      // forcing the next reader to rebuild from scratch.
      try {
        const stops = await buildTownStops(token, env.ALLY_GITHUB_PAT);
        const generatedAt = new Date().toISOString();
        const manifestCachedAt = getManifestCacheCachedAt() ?? generatedAt;
        await persistTownSnapshot(
          env.WILLVILLE_MANIFEST_CACHE,
          generatedAt,
          manifestCachedAt,
          stops,
        );
      } catch {
        // Keep bell response healthy even if snapshot rebuild fails.
      }

      // The bell also owns the canal: build the live PR/boat state once here
      // and persist it so GET /api/canal reads boats straight from the durable
      // layer instead of crawling GitHub GraphQL on every hard refresh.
      //
      // Delta strategy: read the existing snapshot to find when the bell last
      // rang. Pass that timestamp as `since` so we only fetch PRs merged after
      // that moment — keeping each ring fast regardless of history depth.
      // First ring (no lastBellRingAt) → full 2-year backfill (~3 min).
      // The accumulated open-sea fleet from prior rings is merged with the
      // new boats so the full history lives in the snapshot forever.
      //
      // canalSince/canalNewBoats are forwarded to the complete event so the
      // UI can report how much history was backfilled this ring.
      let canalSince: string | null | undefined = undefined;
      let canalNewBoats = 0;
      try {
        const existingSnapshot = await readCanalSnapshot(
          env.WILLVILLE_MANIFEST_CACHE,
        );
        // null = first ring (full backfill); string = delta from last bell.
        const since = existingSnapshot?.lastBellRingAt ?? null;
        const existingOpenSea = (existingSnapshot?.boats ?? []).filter(
          (b) => b.lock === "open-sea",
        );
        const bellRingAt = new Date().toISOString();
        const newBoats = await buildCanalBoats(
          token,
          env.ALLY_GITHUB_PAT,
          since ?? undefined,
        );
        // Merge the full fleet: existing history + new merges since last ring.
        // mergeOpenSeaBoats also evicts any boat that reappeared as non-open-sea.
        const existingKeys = new Set(
          existingOpenSea.map((b) => `${b.repo}#${b.prNumber}`),
        );
        const mergedOpenSea = mergeOpenSeaBoats(existingOpenSea, newBoats);
        const allBoats = [
          ...newBoats.filter((b) => b.lock !== "open-sea"),
          ...mergedOpenSea,
        ];
        await persistCanalSnapshot(
          env.WILLVILLE_MANIFEST_CACHE,
          bellRingAt,
          allBoats,
          getManifestCacheCachedAt() ?? undefined,
          bellRingAt,
        );
        // Only update reporting vars after a successful persist so the UI
        // doesn't show a fleet backfill line if the snapshot wasn't saved.
        canalSince = since;
        // Count truly new ships added to the fleet (deduped, excluding boats
        // already in existingOpenSea), not the raw delta result count.
        canalNewBoats = mergedOpenSea.filter(
          (b) => !existingKeys.has(`${b.repo}#${b.prNumber}`),
        ).length;
      } catch {
        // Keep bell response healthy even if canal rebuild fails.
        // canalSince stays undefined → UI skips the fleet line entirely.
      }

      push({
        type: "complete",
        cached,
        missing,
        errors,
        discovered,
        registered,
        newlyRegistered,
        total: candidates.length,
        ...(canalSince !== undefined && { canalSince, canalNewBoats }),
      });

      if (!streamClosed) {
        try {
          controller.close();
        } catch {
          streamClosed = true;
        }
      }
    },
  });

  return new Response(stream, {
    headers: withCorsHeaders(request, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    }),
  });
};

/**
 * GET /api/canal
 *
 * PR status across all of Will's repos, mapped onto the canal's six locks.
 *
 * Pure reader of the bell-written canal snapshot. The bell (POST /api/manifests)
 * is the primary writer: it runs the live GitHub GraphQL query and persists the
 * boats to the durable cache. This endpoint reads that snapshot — so a hard
 * refresh paints the canal straight from KV instead of waiting on a multi-page
 * GraphQL crawl.
 *
 * Self-heal: if the snapshot fell behind the manifest cache (a bell ring
 * refreshed manifests but the canal persist step failed), this endpoint
 * rebuilds it once and persists the result (read-repair) so it recovers instead
 * of serving stale boats indefinitely.
 *
 * Cold-DB fallback: if no snapshot exists yet (the bell has never rung), we run
 * one live build so the first visitor still sees boats, but we do NOT persist
 * it — the DB stays bell-owned.
 *
 * Edge-cached. Tourists: s-maxage=45, stale-while-revalidate=180.
 */

import { type CanalBoat } from "../../lib/canal";
import { withCorsHeaders } from "./cors";
import {
  buildCanalBoats,
  mergeOpenSeaBoats,
  persistCanalSnapshot,
  readCanalSnapshot,
  type CanalSnapshot,
} from "./canal-snapshot";
import {
  hydrateManifestCacheFromStore,
  readPersistedManifestCacheCachedAt,
  type ManifestCacheStore,
} from "./town-manifests";
import { isMayorRequest } from "./mayor-auth";

interface Env {
  GITHUB_PAT?: string;
  /** Classic PAT with `repo` scope for ally repos (often private, other-owner). */
  ALLY_GITHUB_PAT?: string;
  WILLVILLE_MAYOR_KEY?: string;
  WILLVILLE_MANIFEST_CACHE?: ManifestCacheStore;
}

function parseTimestamp(value: string | null | undefined): number {
  if (!value) {
    return Number.NaN;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/**
 * A snapshot is stale when the manifest cache has been refreshed more recently
 * than the manifest data the snapshot was built from. This happens when a bell
 * ring updated the manifest cache but the canal rebuild/persist step failed —
 * the old snapshot would otherwise be served indefinitely.
 */
function isCanalSnapshotStale(
  snapshot: CanalSnapshot,
  manifestCachedAt: string | null,
): boolean {
  const manifestTime = parseTimestamp(manifestCachedAt);
  // Older KV rows persisted before manifestCachedAt existed fall back to
  // generatedAt so they can still qualify for read-repair instead of being
  // treated as permanently fresh.
  const snapshotManifestTime = parseTimestamp(
    snapshot.manifestCachedAt ?? snapshot.generatedAt,
  );

  if (
    !Number.isFinite(manifestTime) ||
    !Number.isFinite(snapshotManifestTime)
  ) {
    return false;
  }

  return manifestTime > snapshotManifestTime;
}

function redactForTourist(boats: CanalBoat[]): CanalBoat[] {
  // Default-redact: keep a real title only when the boat is *explicitly* public
  // (isPrivate === false). Durable snapshots persisted before isPrivate existed
  // lack the field; treating "unknown" as private prevents leaking real private
  // PR titles from pre-deploy KV rows until the next bell rebuild stamps it.
  return boats.map((b) =>
    b.isPrivate === false ? b : { ...b, title: "private" },
  );
}

function canalResponse(
  request: Request,
  mayor: boolean,
  generatedAt: string,
  boats: CanalBoat[],
  extra?: Record<string, unknown>,
): Response {
  const visibleBoats = mayor ? boats : redactForTourist(boats);
  return new Response(
    JSON.stringify({
      mayor,
      generatedAt,
      boats: visibleBoats,
      ...extra,
    }),
    {
      headers: withCorsHeaders(request, {
        "Content-Type": "application/json; charset=utf-8",
        // The payload depends on the mayor cookie, so Vary on Cookie — otherwise
        // an edge cache could serve a redacted tourist body to a mayor request
        // (or a cached body across the mayor/tourist boundary). CORS appends Origin.
        Vary: "Cookie",
        "Cache-Control": mayor
          ? "private, no-store"
          : "public, s-maxage=45, stale-while-revalidate=180",
      }),
    },
  );
}

/**
 * Run the live canal build, persist it as the durable snapshot (read-repair),
 * and return it. Persisting keeps the recovery self-healing — a stale snapshot
 * is fixed once instead of re-crawling GitHub GraphQL on every request. The
 * bell remains the primary writer; this is a bounded recovery path.
 *
 * Preserves the accumulated open-sea fleet from the existing snapshot and uses
 * lastBellRingAt as the delta `since` date so we only fetch new merges.
 */
async function rebuildAndPersistCanalSnapshot(
  env: Env,
  token: string,
  manifestCachedAt: string | null,
  existingSnapshot?: CanalSnapshot,
): Promise<{ generatedAt: string; boats: CanalBoat[] }> {
  const since = existingSnapshot?.lastBellRingAt;
  const existingOpenSea = (existingSnapshot?.boats ?? []).filter(
    (b) => b.lock === "open-sea",
  );
  const newBoats = await buildCanalBoats(token, env.ALLY_GITHUB_PAT, since);
  const mergedOpenSea = mergeOpenSeaBoats(existingOpenSea, newBoats);
  const allBoats = [
    ...newBoats.filter((b) => b.lock !== "open-sea"),
    ...mergedOpenSea,
  ];
  const generatedAt = new Date().toISOString();
  await persistCanalSnapshot(
    env.WILLVILLE_MANIFEST_CACHE,
    generatedAt,
    allBoats,
    manifestCachedAt ?? generatedAt,
    // If a bell has rung before, preserve its timestamp so the next real ring
    // fetches only the delta from that point. If no bell has ever rung (cold
    // boot), stamp generatedAt so repeated read-repairs don't re-crawl 2 years
    // every time — the next bell ring will delta from here.
    existingSnapshot?.lastBellRingAt ?? generatedAt,
  );
  return { generatedAt, boats: allBoats };
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Resolve mayor status once (verifies the signed cookie) and thread the
  // boolean through every response path — cheaper than re-checking per branch.
  const mayor = await isMayorRequest(request, env);

  // Fast path: serve the durable snapshot the bell persisted. No GitHub round
  // trip, so a hard refresh paints the canal immediately — unless the snapshot
  // fell behind the manifest cache (a bell ring refreshed manifests but the
  // canal rebuild/persist failed), in which case we self-heal below.
  const snapshot = await readCanalSnapshot(env.WILLVILLE_MANIFEST_CACHE);
  if (snapshot) {
    const manifestCachedAt = await readPersistedManifestCacheCachedAt(
      env.WILLVILLE_MANIFEST_CACHE,
    );
    if (!isCanalSnapshotStale(snapshot, manifestCachedAt)) {
      return canalResponse(request, mayor, snapshot.generatedAt, snapshot.boats, {
        ...(snapshot.lastBellRingAt && {
          lastBellRingAt: snapshot.lastBellRingAt,
        }),
      });
    }

    const token = env.GITHUB_PAT;
    if (token) {
      try {
        await hydrateManifestCacheFromStore(env.WILLVILLE_MANIFEST_CACHE);
        const repaired = await rebuildAndPersistCanalSnapshot(
          env,
          token,
          manifestCachedAt,
          snapshot,
        );
        return canalResponse(request, mayor, repaired.generatedAt, repaired.boats);
      } catch {
        // Rebuild failed — fall back to serving the stale snapshot so the
        // canal stays available rather than blank.
      }
    }

    return canalResponse(request, mayor, snapshot.generatedAt, snapshot.boats);
  }

  const token = env.GITHUB_PAT;
  if (!token) {
    // Without a token we can't query GraphQL. Return an empty canal.
    return canalResponse(request, mayor, new Date().toISOString(), [], {
      warning: "GITHUB_PAT not configured — canal is empty.",
    });
  }

  // Cold DB: the bell has never rung. Run one live build so the first visitor
  // still sees boats, but do not persist — the bell remains the sole writer.
  try {
    const boats = await buildCanalBoats(token, env.ALLY_GITHUB_PAT);
    return canalResponse(request, mayor, new Date().toISOString(), boats);
  } catch (err) {
    return canalResponse(request, mayor, new Date().toISOString(), [], {
      warning: String(err),
    });
  }
};

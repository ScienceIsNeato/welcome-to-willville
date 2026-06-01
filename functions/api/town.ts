/**
 * GET /api/town
 *
 * Pure reader of the durable town snapshot. The snapshot is written *only* by
 * the bell (POST /api/manifests); this endpoint never rebuilds-on-read or
 * writes to the DB. Whoever rings the bell refreshes the data for every future
 * session — this handler just serves whatever the last bell ring stored.
 *
 * The only exception is a cold DB that no bell has ever populated: to avoid a
 * blank first load, we build a live snapshot and return it *without* persisting
 * it, keeping the DB strictly bell-owned.
 *
 * Tourists see public repos only. Mayors (with the willville_mayor cookie)
 * also see private repos and stops marked visibility: mayor.
 */

import { withCorsHeaders } from "./cors";
import {
  type ManifestCacheStore,
  hydrateManifestCacheFromStore,
  readPersistedManifestCacheCachedAt,
} from "./town-manifests";
import {
  buildTownStops,
  persistTownSnapshot,
  readTownSnapshot,
  type TownSnapshot,
} from "./town-snapshot";

interface Env {
  GITHUB_PAT?: string;
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
 * ring updates the manifest cache but the town rebuild/persist step fails — the
 * old snapshot would otherwise be served indefinitely.
 */
function isTownSnapshotStale(
  snapshot: TownSnapshot,
  manifestCachedAt: string | null,
): boolean {
  const manifestTime = parseTimestamp(manifestCachedAt);
  const snapshotManifestTime = parseTimestamp(snapshot.manifestCachedAt);

  if (
    !Number.isFinite(manifestTime) ||
    !Number.isFinite(snapshotManifestTime)
  ) {
    return false;
  }

  return manifestTime > snapshotManifestTime;
}

function townResponse(request: Request, snapshot: TownSnapshot): Response {
  return new Response(
    JSON.stringify({
      mayor: true,
      generatedAt: snapshot.generatedAt,
      stops: snapshot.stops,
    }),
    {
      headers: withCorsHeaders(request, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=45, stale-while-revalidate=180",
      }),
    },
  );
}

/**
 * Run the live "huge query" town build, persist it as the durable snapshot
 * (read-repair / explicit-refresh path), and return it. Persisting keeps the
 * refresh self-healing — a forced rebuild fixes the stored snapshot so later
 * reads serve a fixed result instead of re-crawling GitHub on every request.
 */
async function rebuildAndPersistTownSnapshot(
  env: Env,
  manifestCachedAt: string | null,
): Promise<TownSnapshot> {
  await hydrateManifestCacheFromStore(env.WILLVILLE_MANIFEST_CACHE);
  const stops = await buildTownStops(env.GITHUB_PAT);
  const generatedAt = new Date().toISOString();
  await persistTownSnapshot(
    env.WILLVILLE_MANIFEST_CACHE,
    generatedAt,
    manifestCachedAt ?? generatedAt,
    stops,
  );
  return {
    schemaVersion: 1,
    generatedAt,
    manifestCachedAt: manifestCachedAt ?? undefined,
    stops,
  };
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // An explicit ?refresh= cache-buster (used by the bell flow and the repaint
  // accept flow) forces a live rebuild so freshly-updated heuristics land in
  // the durable snapshot immediately instead of waiting for the next bell ring.
  const wantsRefresh = new URL(request.url).searchParams.has("refresh");
  if (wantsRefresh) {
    const manifestCachedAt = await readPersistedManifestCacheCachedAt(
      env.WILLVILLE_MANIFEST_CACHE,
    );
    return townResponse(
      request,
      await rebuildAndPersistTownSnapshot(env, manifestCachedAt),
    );
  }

  // Read the bell-written snapshot. The bell is the primary writer, so this
  // handler avoids rebuilding on read — but it does guard against a snapshot
  // that fell behind the manifest cache (e.g. a bell ring updated manifests but
  // the town rebuild/persist failed). A stale snapshot is rebuilt and persisted
  // once as a read-repair so it self-heals instead of re-crawling every request.
  const snapshot = await readTownSnapshot(env.WILLVILLE_MANIFEST_CACHE);
  if (snapshot) {
    const manifestCachedAt = await readPersistedManifestCacheCachedAt(
      env.WILLVILLE_MANIFEST_CACHE,
    );
    if (!isTownSnapshotStale(snapshot, manifestCachedAt)) {
      return townResponse(request, snapshot);
    }

    try {
      return townResponse(
        request,
        await rebuildAndPersistTownSnapshot(env, manifestCachedAt),
      );
    } catch {
      // Rebuild failed — serve the stale snapshot so the town stays available
      // rather than erroring (mirrors the canal stale-path fallback).
      return townResponse(request, snapshot);
    }
  }

  // Cold DB: nothing has rung the bell yet. Build a live snapshot so the first
  // load isn't blank, but do NOT persist it — the DB only changes on a bell
  // ring. Always use the PAT when available to dodge unauthenticated limits.
  await hydrateManifestCacheFromStore(env.WILLVILLE_MANIFEST_CACHE);
  const stops = await buildTownStops(env.GITHUB_PAT);
  return townResponse(request, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    stops,
  });
};

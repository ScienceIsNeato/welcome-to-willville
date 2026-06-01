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

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Read the bell-written snapshot. The bell is the sole writer, so this handler
  // never persists — but it does guard against a snapshot that fell behind the
  // manifest cache (e.g. a bell ring updated manifests but the town rebuild
  // failed). A stale snapshot is rebuilt live and served without persisting.
  const snapshot = await readTownSnapshot(env.WILLVILLE_MANIFEST_CACHE);
  if (snapshot) {
    const manifestCachedAt = await readPersistedManifestCacheCachedAt(
      env.WILLVILLE_MANIFEST_CACHE,
    );
    if (!isTownSnapshotStale(snapshot, manifestCachedAt)) {
      return townResponse(request, snapshot);
    }

    // Stale snapshot: the manifest cache moved ahead of the town snapshot
    // (e.g. a bell ring refreshed manifests but the town rebuild/persist step
    // failed). Rebuild once and persist it as a read-repair so this self-heals
    // instead of re-crawling GitHub on every subsequent request. The bell is
    // still the primary writer; this is a bounded recovery path.
    await hydrateManifestCacheFromStore(env.WILLVILLE_MANIFEST_CACHE);
    const stops = await buildTownStops(env.GITHUB_PAT);
    const generatedAt = new Date().toISOString();
    const repaired: TownSnapshot = {
      schemaVersion: 1,
      generatedAt,
      manifestCachedAt: manifestCachedAt ?? undefined,
      stops,
    };
    await persistTownSnapshot(
      env.WILLVILLE_MANIFEST_CACHE,
      generatedAt,
      manifestCachedAt ?? generatedAt,
      stops,
    );
    return townResponse(request, repaired);
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

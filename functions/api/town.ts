/**
 * GET /api/town
 *
 * Discovers the town's live state by:
 *   1. Listing repos under ScienceIsNeato (non-fork, non-archived, <2y stale)
 *   2. For each, fetching open GitHub milestones (queue + ETA data)
 *   3. Reading bell-hydrated .willville.json manifests from in-memory cache,
 *      with durable-store hydration fallback when configured
 *   4. Merging with baked-in heuristics for layout (position, district, lines)
 *
 * Tourists see public repos only. Mayors (with the willville_mayor cookie)
 * also see private repos and stops marked visibility: mayor.
 *
 * Edge-cached. Tourists: s-maxage=60, stale-while-revalidate=300.
 * Mayors: private, no-store.
 */

import { withCorsHeaders } from "./cors";
import {
  getManifestCacheCachedAt,
  type ManifestCacheStore,
  hydrateManifestCacheFromStore,
  isManifestCacheOlderThan,
  readPersistedManifestCacheCachedAt,
} from "./town-manifests";
import {
  buildTownStops,
  isTownSnapshotStale,
  persistTownSnapshot,
  readTownSnapshot,
  snapshotBaselineCachedAt,
  type TownSnapshot,
} from "./town-snapshot";

interface Env {
  GITHUB_PAT?: string;
  WILLVILLE_MAYOR_KEY?: string;
  WILLVILLE_MANIFEST_CACHE?: ManifestCacheStore;
}

let townSnapshotMemory: TownSnapshot | null = null;

function newerTimestamp(
  first: string | null,
  second: string | null,
): string | null {
  const firstParsed = first ? Date.parse(first) : Number.NaN;
  const secondParsed = second ? Date.parse(second) : Number.NaN;

  if (Number.isFinite(firstParsed) && Number.isFinite(secondParsed)) {
    return firstParsed >= secondParsed ? first : second;
  }

  if (Number.isFinite(firstParsed)) {
    return first;
  }

  if (Number.isFinite(secondParsed)) {
    return second;
  }

  return first ?? second;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Always use PAT when available to avoid unauthenticated rate limits (60/hr).
  const token = env.GITHUB_PAT;
  await hydrateManifestCacheFromStore(env.WILLVILLE_MANIFEST_CACHE);
  const persistedManifestCachedAt = await readPersistedManifestCacheCachedAt(
    env.WILLVILLE_MANIFEST_CACHE,
  );
  if (isManifestCacheOlderThan(persistedManifestCachedAt)) {
    await hydrateManifestCacheFromStore(env.WILLVILLE_MANIFEST_CACHE, {
      force: true,
    });
  }
  const manifestCacheCachedAt = newerTimestamp(
    getManifestCacheCachedAt(),
    persistedManifestCachedAt,
  );

  const requestUrl = new URL(request.url);
  const forceRefresh = requestUrl.searchParams.has("refresh");

  if (!forceRefresh) {
    let persistedSnapshot: TownSnapshot | undefined;

    if (townSnapshotMemory && townSnapshotMemory.stops.length > 0) {
      if (!isTownSnapshotStale(townSnapshotMemory, manifestCacheCachedAt)) {
        persistedSnapshot = await readTownSnapshot(
          env.WILLVILLE_MANIFEST_CACHE,
        );
        if (
          persistedSnapshot &&
          !isTownSnapshotStale(persistedSnapshot, manifestCacheCachedAt) &&
          snapshotBaselineCachedAt(persistedSnapshot) >
            snapshotBaselineCachedAt(townSnapshotMemory)
        ) {
          townSnapshotMemory = persistedSnapshot;
          return new Response(
            JSON.stringify({
              mayor: true,
              generatedAt: persistedSnapshot.generatedAt,
              stops: persistedSnapshot.stops,
            }),
            {
              headers: withCorsHeaders(request, {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control":
                  "public, s-maxage=45, stale-while-revalidate=180",
              }),
            },
          );
        }

        return new Response(
          JSON.stringify({
            mayor: true,
            generatedAt: townSnapshotMemory.generatedAt,
            stops: townSnapshotMemory.stops,
          }),
          {
            headers: withCorsHeaders(request, {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control":
                "public, s-maxage=45, stale-while-revalidate=180",
            }),
          },
        );
      }

      townSnapshotMemory = null;
    }

    const snapshot =
      persistedSnapshot ??
      (await readTownSnapshot(env.WILLVILLE_MANIFEST_CACHE));
    if (snapshot && !isTownSnapshotStale(snapshot, manifestCacheCachedAt)) {
      townSnapshotMemory = snapshot;
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
  }

  const stops = await buildTownStops(token);
  const generatedAt = new Date().toISOString();
  const snapshotManifestCachedAt = manifestCacheCachedAt ?? generatedAt;
  townSnapshotMemory = {
    schemaVersion: 1,
    generatedAt,
    manifestCachedAt: snapshotManifestCachedAt,
    stops,
  };
  await persistTownSnapshot(
    env.WILLVILLE_MANIFEST_CACHE,
    generatedAt,
    snapshotManifestCachedAt,
    stops,
  );

  const cacheControl = "public, s-maxage=45, stale-while-revalidate=180";

  return new Response(
    JSON.stringify({
      mayor: true,
      generatedAt,
      stops,
    }),
    {
      headers: withCorsHeaders(request, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": cacheControl,
      }),
    },
  );
};

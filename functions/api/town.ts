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
} from "./town-manifests";
import {
  buildTownStops,
  readTownSnapshot,
  type TownSnapshot,
} from "./town-snapshot";

interface Env {
  GITHUB_PAT?: string;
  WILLVILLE_MAYOR_KEY?: string;
  WILLVILLE_MANIFEST_CACHE?: ManifestCacheStore;
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
  // Read the bell-written snapshot and serve it as-is — no staleness check, no
  // rebuild, no DB write. The bell is the sole writer.
  const snapshot = await readTownSnapshot(env.WILLVILLE_MANIFEST_CACHE);
  if (snapshot) {
    return townResponse(request, snapshot);
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

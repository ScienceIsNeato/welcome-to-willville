/**
 * GET /api/canal
 *
 * PR status across all of Will's repos, mapped onto the canal's six locks.
 *
 * Pure reader of the bell-written canal snapshot. The bell (POST /api/manifests)
 * is the sole writer: it runs the live GitHub GraphQL query and persists the
 * boats to the durable cache. This endpoint never re-queries GitHub on read and
 * never writes to the DB — so a hard refresh paints the canal straight from KV
 * instead of waiting on a multi-page GraphQL crawl.
 *
 * Cold-DB fallback: if no snapshot exists yet (the bell has never rung), we run
 * one live build so the first visitor still sees boats, but we do NOT persist
 * it — the DB stays bell-owned.
 *
 * Edge-cached. Tourists: s-maxage=45, stale-while-revalidate=180.
 */

import { type CanalBoat } from "../../lib/canal";
import { withCorsHeaders } from "./cors";
import { buildCanalBoats, readCanalSnapshot } from "./canal-snapshot";
import { type ManifestCacheStore } from "./town-manifests";

interface Env {
  GITHUB_PAT?: string;
  WILLVILLE_MAYOR_KEY?: string;
  WILLVILLE_MANIFEST_CACHE?: ManifestCacheStore;
}

function canalResponse(
  request: Request,
  generatedAt: string,
  boats: CanalBoat[],
  extra?: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify({
      mayor: true,
      generatedAt,
      boats,
      ...extra,
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
  // Fast path: serve the durable snapshot the bell persisted. No GitHub round
  // trip, so a hard refresh paints the canal immediately.
  const snapshot = await readCanalSnapshot(env.WILLVILLE_MANIFEST_CACHE);
  if (snapshot) {
    return canalResponse(request, snapshot.generatedAt, snapshot.boats);
  }

  const token = env.GITHUB_PAT;
  if (!token) {
    // Without a token we can't query GraphQL. Return an empty canal.
    return canalResponse(request, new Date().toISOString(), [], {
      warning: "GITHUB_PAT not configured — canal is empty.",
    });
  }

  // Cold DB: the bell has never rung. Run one live build so the first visitor
  // still sees boats, but do not persist — the bell remains the sole writer.
  try {
    const boats = await buildCanalBoats(token);
    return canalResponse(request, new Date().toISOString(), boats);
  } catch (err) {
    return canalResponse(request, new Date().toISOString(), [], {
      warning: String(err),
    });
  }
};

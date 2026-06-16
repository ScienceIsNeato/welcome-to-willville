/**
 * GET /api/commits?repo=<name>
 *
 * Public, no-auth commit-count lookup for a single repo. Returns the 3 / 7 /
 * 21-day commit counts the town board already shows.
 *
 * It is a pure reader of the bell-written town snapshot in KV — the SAME data
 * `/api/town` serves — so there is NO GitHub round-trip, NO PAT, and NO auth at
 * request time. (The counts are computed server-side with the PAT only when the
 * bell rings; this endpoint just reads the persisted result.) Intended as a
 * simple public lookup, e.g. for Ganglia quests.
 *
 * `repo` matches the stop id ("ganglia-core"), the full "owner/name", or an
 * owner-insensitive "/name" suffix. Response:
 *   { repo, commits3d, commits7d, commits21d, lastCommitAt, generatedAt }
 *
 * Edge-cached like the other public readers: s-maxage=45, swr=180.
 */

import { readTownSnapshot } from "./town-snapshot";
import { type ManifestCacheStore } from "./town-manifests";

interface Env {
  WILLVILLE_MANIFEST_CACHE?: ManifestCacheStore;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Fully public lookup (just commit counts, already shown on the board).
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control":
        status === 200
          ? "public, s-maxage=45, stale-while-revalidate=180"
          : "no-store",
    },
  });
}

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const repoParam = (new URL(request.url).searchParams.get("repo") ?? "")
    .trim()
    .toLowerCase();

  if (!repoParam) {
    return jsonResponse(
      { error: "Missing ?repo= parameter (e.g. ?repo=ganglia-core)" },
      400,
    );
  }

  const snapshot = await readTownSnapshot(env.WILLVILLE_MANIFEST_CACHE);
  if (!snapshot) {
    return jsonResponse(
      { error: "Town snapshot not available yet — ring the bell first." },
      503,
    );
  }

  const stop = snapshot.stops.find((s) => {
    const id = (s.id ?? "").toLowerCase();
    const repo = (s.repo ?? "").toLowerCase();
    return (
      id === repoParam || repo === repoParam || repo.endsWith(`/${repoParam}`)
    );
  });

  if (!stop) {
    return jsonResponse({ error: `Repo not found: ${repoParam}` }, 404);
  }

  return jsonResponse({
    repo: stop.repo ?? stop.id,
    commits3d: stop.commits3d ?? 0,
    commits7d: stop.commits7d ?? 0,
    commits21d: stop.commits21d ?? 0,
    lastCommitAt: stop.lastCommitAt ?? null,
    generatedAt: snapshot.generatedAt,
  });
};

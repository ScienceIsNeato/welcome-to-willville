/**
 * GET /api/town
 *
 * Discovers the town's live state by:
 *   1. Listing repos under ScienceIsNeato (non-fork, non-archived, <1y stale)
 *   2. For each, attempting to fetch `.willville.json` from the default branch
 *   3. Merging with baked-in heuristics + manual stops
 *
 * Tourists see public repos only. Mayors (with the willville_mayor cookie)
 * also see private repos and stops marked visibility: mayor.
 *
 * Edge-cached. Tourists: s-maxage=60, stale-while-revalidate=300.
 * Mayors: private, no-store.
 */

import {
  buildTown,
  type RepoMeta,
  type RepoWithManifest,
} from "../../lib/town";
import { parseManifest } from "../../lib/manifest";

interface Env {
  GITHUB_PAT?: string;
  WILLVILLE_MAYOR_KEY?: string;
}

const OWNER = "ScienceIsNeato";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

type GitHubRepo = {
  full_name: string;
  name: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  pushed_at: string;
  default_branch: string;
  homepage: string | null;
};

async function listOwnerRepos(token?: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  const headers: Record<string, string> = {
    "User-Agent": "willville-edge",
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let page = 1;
  while (true) {
    const url = token
      ? `https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner&sort=pushed&direction=desc`
      : `https://api.github.com/users/${OWNER}/repos?per_page=100&page=${page}&sort=pushed&direction=desc`;
    const r = await fetch(url, { headers });
    if (!r.ok) break;
    const batch = (await r.json()) as GitHubRepo[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const repo of batch) {
      if (token && !repo.full_name.startsWith(`${OWNER}/`)) continue;
      repos.push(repo);
    }
    if (batch.length < 100) break;
    page++;
    if (page > 5) break;
  }
  return repos;
}

async function fetchManifest(
  owner: string,
  name: string,
  branch: string,
  isPrivate: boolean,
  token?: string,
) {
  const headers: Record<string, string> = {
    "User-Agent": "willville-edge",
  };
  let url: string;
  if (isPrivate) {
    if (!token) return null;
    url = `https://api.github.com/repos/${owner}/${name}/contents/.willville.json?ref=${branch}`;
    headers.Authorization = `Bearer ${token}`;
    headers.Accept = "application/vnd.github.raw";
  } else {
    url = `https://raw.githubusercontent.com/${owner}/${name}/${branch}/.willville.json`;
  }
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) return null;
    const text = await r.text();
    return parseManifest(JSON.parse(text));
  } catch {
    return null;
  }
}

function isMayor(request: Request): boolean {
  const cookie = request.headers.get("Cookie") ?? "";
  return /(^|;\s*)willville_mayor=1\b/.test(cookie);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const mayor = isMayor(request);
  const token = mayor ? env.GITHUB_PAT : undefined;
  const repos = await listOwnerRepos(token);
  const cutoff = Date.now() - ONE_YEAR_MS;
  const candidates = repos.filter((r) => {
    if (r.fork || r.archived) return false;
    if (!mayor && r.private) return false;
    return Date.parse(r.pushed_at) >= cutoff;
  });

  const reposWithManifests: RepoWithManifest[] = await Promise.all(
    candidates.map(async (r) => {
      const manifest = await fetchManifest(
        OWNER,
        r.name,
        r.default_branch,
        r.private,
        token,
      );
      const meta: RepoMeta = {
        repo: r.full_name,
        isPrivate: r.private,
        isFork: r.fork,
        isArchived: r.archived,
        pushedAt: r.pushed_at,
        defaultBranch: r.default_branch,
        homepage: r.homepage ?? undefined,
      };
      return { meta, manifest };
    }),
  );

  const stops = buildTown(reposWithManifests, { isMayor: mayor });

  const cacheControl = mayor
    ? "private, no-store"
    : "public, s-maxage=60, stale-while-revalidate=300";

  return new Response(
    JSON.stringify({ mayor, generatedAt: new Date().toISOString(), stops }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": cacheControl,
      },
    },
  );
};

/**
 * GET /api/town
 *
 * Discovers the town's live state by:
 *   1. Listing repos under ScienceIsNeato (non-fork, non-archived, <1y stale)
 *   2. For each, fetching open GitHub milestones (queue + ETA data)
 *   3. Merging with baked-in heuristics for layout (position, district, lines)
 *
 * No .willville.json required — everything is derived from the repo itself.
 *
 * Tourists see public repos only. Mayors (with the willville_mayor cookie)
 * also see private repos and stops marked visibility: mayor.
 *
 * Edge-cached. Tourists: s-maxage=60, stale-while-revalidate=300.
 * Mayors: private, no-store.
 */

import { buildTown, type RepoMeta, type WillvillePacket } from "../../lib/town";

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
  description: string | null;
  open_issues_count: number;
  stargazers_count: number;
  language: string | null;
  topics: string[];
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

type GitHubMilestone = {
  title: string;
  due_on: string | null;
  open_issues: number;
  state: "open" | "closed";
};

async function fetchMilestones(
  owner: string,
  name: string,
  token?: string,
): Promise<GitHubMilestone[]> {
  const headers: Record<string, string> = {
    "User-Agent": "willville-edge",
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `https://api.github.com/repos/${owner}/${name}/milestones?state=open&sort=due_on&direction=asc&per_page=5`;
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) return [];
    const data = (await r.json()) as GitHubMilestone[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function isMayor(request: Request): boolean {
  const cookie = request.headers.get("Cookie") ?? "";
  return /(^|;\s*)willville_mayor=1\b/.test(cookie);
}

type CommitActivityWeek = {
  days: [number, number, number, number, number, number, number];
  total: number;
  week: number;
};

/**
 * Fetch commit counts for the last 3, 7, and 21 days.
 * Uses the commits list endpoint (no async 202 / stats-compute delays).
 * Capped at 100 commits per window — more than enough for portfolio repos.
 */
async function fetchCommitCounts(
  fullName: string,
  token?: string,
): Promise<{ d3: number; d7: number; d21: number } | undefined> {
  const headers: Record<string, string> = {
    "User-Agent": "willville-edge",
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const since = new Date(Date.now() - 21 * 86_400_000).toISOString();
  try {
    const r = await fetch(
      `https://api.github.com/repos/${fullName}/commits?since=${since}&per_page=100`,
      { headers },
    );
    if (!r.ok) return undefined;
    type CommitEntry = { commit: { author: { date: string } | null } };
    const commits = (await r.json()) as CommitEntry[];
    if (!Array.isArray(commits)) return undefined;

    const now = Date.now();
    let d3 = 0,
      d7 = 0,
      d21 = 0;
    for (const c of commits) {
      const t = Date.parse(c.commit?.author?.date ?? "");
      if (Number.isNaN(t)) continue;
      const daysAgo = (now - t) / 86_400_000;
      if (daysAgo <= 3) d3++;
      if (daysAgo <= 7) d7++;
      d21++; // all commits from the `since` window count
    }
    return { d3, d7, d21 };
  } catch {
    return undefined;
  }
}

const PACKET_RE = /<!--\s*willville\b([\s\S]*?)-->/;

/** Parse a raw STATUS.md string into a WillvillePacket, or return undefined. */
function parseWillvillePacket(body: string): WillvillePacket | undefined {
  const match = PACKET_RE.exec(body);
  if (!match) return undefined;
  const inner = match[1]!;
  const pkt: WillvillePacket = {};

  for (const line of inner.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    if (!val) continue;

    switch (key) {
      case "status":
        if (
          ["wip", "shipping", "maintenance", "dormant", "unknown"].includes(val)
        )
          pkt.status = val as WillvillePacket["status"];
        break;
      case "summary":
        pkt.summary = val;
        break;
      case "milestone":
        pkt.milestone = val;
        break;
      case "eta_date":
        pkt.etaDate = val;
        break;
    }
  }

  // Parse YAML-style list fields (blockers / next)
  for (const field of ["blockers", "next"] as const) {
    const listRe = new RegExp(`\\b${field}:[\\s\\S]*?(?=\\n\\w|$)`);
    const listMatch = listRe.exec(inner);
    if (listMatch) {
      const items = [...listMatch[0].matchAll(/^\s*-\s*(.+)/gm)]
        .map((m) => m[1]!.trim())
        .filter(Boolean);
      if (items.length) pkt[field] = items;
    }
  }

  return Object.keys(pkt).length > 0 ? pkt : undefined;
}

/** Fetch STATUS.md and parse the willville packet. Returns undefined on miss. */
async function fetchWillvillePacket(
  fullName: string,
  branch: string,
  token?: string,
): Promise<WillvillePacket | undefined> {
  const headers: Record<string, string> = {
    "User-Agent": "willville-edge",
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const r = await fetch(
      `https://api.github.com/repos/${fullName}/contents/STATUS.md?ref=${branch}`,
      { headers },
    );
    if (!r.ok) return undefined;
    const data = (await r.json()) as { content?: string; encoding?: string };
    if (!data.content || data.encoding !== "base64") return undefined;
    const body = atob(data.content.replace(/\s/g, ""));
    return parseWillvillePacket(body);
  } catch {
    return undefined;
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const mayor = isMayor(request);
  // Always use PAT when available to avoid unauthenticated rate limits (60/hr).
  // Private repos are still filtered out for non-mayors below.
  const token = env.GITHUB_PAT;
  const repos = await listOwnerRepos(token);
  const cutoff = Date.now() - ONE_YEAR_MS;
  const candidates = repos.filter((r) => {
    if (r.fork || r.archived) return false;
    if (!mayor && r.private) return false;
    return Date.parse(r.pushed_at) >= cutoff;
  });

  const repoMetas: RepoMeta[] = await Promise.all(
    candidates.map(async (r) => {
      const [milestones, willvillePacket, commitCounts] = await Promise.all([
        fetchMilestones(OWNER, r.name, token),
        fetchWillvillePacket(r.full_name, r.default_branch, token),
        fetchCommitCounts(r.full_name, token),
      ]);
      return {
        repo: r.full_name,
        isPrivate: r.private,
        isFork: r.fork,
        isArchived: r.archived,
        pushedAt: r.pushed_at,
        defaultBranch: r.default_branch,
        homepage: r.homepage ?? undefined,
        description: r.description ?? undefined,
        topics: r.topics ?? [],
        openMilestones: milestones.map((m) => ({
          title: m.title,
          dueOn: m.due_on,
          openIssues: m.open_issues,
        })),
        willvillePacket,
        openIssuesCount: r.open_issues_count,
        stars: r.stargazers_count,
        language: r.language ?? undefined,
        commits3d: commitCounts?.d3,
        commits7d: commitCounts?.d7,
        commits21d: commitCounts?.d21,
      };
    }),
  );

  const stops = buildTown(repoMetas, { isMayor: mayor });

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

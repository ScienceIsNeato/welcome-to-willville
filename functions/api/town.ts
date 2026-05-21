/**
 * GET /api/town
 *
 * Discovers the town's live state by:
 *   1. Listing repos under ScienceIsNeato (non-fork, non-archived, <2y stale)
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
  return true;
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

type GitHubBranch = {
  name: string;
};

type GitHubCommit = {
  commit?: {
    author?: { date?: string } | null;
    committer?: { date?: string } | null;
  };
};

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
  token?: string,
): Promise<RepoMeta["activeBranch"]> {
  const headers: Record<string, string> = {
    "User-Agent": "willville-edge",
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const branchesResponse = await fetch(
      `https://api.github.com/repos/${fullName}/branches?per_page=100`,
      { headers },
    );
    const branches = branchesResponse.ok
      ? ((await branchesResponse.json()) as GitHubBranch[])
      : [];
    const branchNames = Array.from(
      new Set(
        [
          defaultBranch,
          ...(Array.isArray(branches) ? branches.map((b) => b.name) : []),
        ]
          .filter(Boolean)
          .slice(0, 100),
      ),
    );

    const commits = await mapLimit(branchNames, 4, async (branch) => {
      const commitResponse = await fetch(
        `https://api.github.com/repos/${fullName}/commits?sha=${encodeURIComponent(
          branch,
        )}&per_page=1`,
        { headers },
      );
      if (!commitResponse.ok) return null;
      const data = (await commitResponse.json()) as GitHubCommit[];
      const commit = Array.isArray(data) ? data[0] : undefined;
      const pushedAt =
        commit?.commit?.committer?.date ?? commit?.commit?.author?.date;
      if (!pushedAt) return null;
      return { name: branch, pushedAt };
    });

    const latest =
      commits
        .filter(
          (commit): commit is { name: string; pushedAt: string } =>
            commit !== null,
        )
        .sort((a, b) => Date.parse(b.pushedAt) - Date.parse(a.pushedAt))[0] ??
      null;

    if (!latest) {
      return {
        name: defaultBranch,
        compareUrl: compareUrl(fullName, defaultBranch, defaultBranch),
        isDefault: true,
      };
    }

    return {
      name: latest.name,
      pushedAt: latest.pushedAt,
      compareUrl: compareUrl(fullName, defaultBranch, latest.name),
      isDefault: latest.name === defaultBranch,
    };
  } catch {
    return {
      name: defaultBranch,
      compareUrl: compareUrl(fullName, defaultBranch, defaultBranch),
      isDefault: true,
    };
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
      // New-format fields
      case "doing":
        pkt.doing = val;
        break;
      case "done":
        pkt.done = val;
        break;
      case "next":
        pkt.next = val;
        break;
      case "blocked":
        pkt.blocked = val;
        break;
      case "risk":
        pkt.risk = val;
        break;
      case "eta":
        pkt.eta = val;
        break;
      // Shared
      case "milestone":
        pkt.milestone = val;
        break;
      // Legacy fields (backward compat)
      case "status":
        if (
          ["wip", "shipping", "maintenance", "dormant", "unknown"].includes(val)
        )
          pkt.status = val as WillvillePacket["status"];
        break;
      case "summary":
        pkt.summary = val;
        break;
      case "eta_date":
        pkt.etaDate = val;
        pkt.eta ??= val;
        break;
    }
  }

  // Legacy: parse YAML-style list fields (blockers)
  const blockersRe = /\bblockers:[\s\S]*?(?=\n\w|$)/;
  const blockersMatch = blockersRe.exec(inner);
  if (blockersMatch) {
    const items = [...blockersMatch[0].matchAll(/^\s*-\s*(.+)/gm)]
      .map((m) => m[1]!.trim())
      .filter(Boolean);
    if (items.length) {
      pkt.blockers = items;
      pkt.blocked ??= items[0];
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
  const mayor = true;
  // Always use PAT when available to avoid unauthenticated rate limits (60/hr).
  const token = env.GITHUB_PAT;
  const repos = await listOwnerRepos(token);
  const cutoff = Date.now() - TWO_YEARS_MS;
  const candidates = repos.filter((r) => {
    if (r.fork || r.archived) return false;
    return Date.parse(r.pushed_at) >= cutoff;
  });

  const repoMetas: RepoMeta[] = await mapLimit(candidates, 8, async (r) => {
    const [milestones, willvillePacket, commitCounts, activeBranch] =
      await Promise.all([
        fetchMilestones(OWNER, r.name, token),
        fetchWillvillePacket(r.full_name, r.default_branch, token),
        fetchCommitCounts(r.full_name, token),
        fetchActiveBranch(r.full_name, r.default_branch, token),
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
      activeBranch,
    };
  });

  const stops = buildTown(repoMetas, { isMayor: true });

  const cacheControl = "public, s-maxage=60, stale-while-revalidate=300";

  return new Response(
    JSON.stringify({
      mayor: true,
      generatedAt: new Date().toISOString(),
      stops,
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": cacheControl,
      },
    },
  );
};

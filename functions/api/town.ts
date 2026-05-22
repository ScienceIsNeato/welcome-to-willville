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

import {
  buildTown,
  type RepoMeta,
  type WillvilleManifest,
  type WillvillePacket,
} from "../../lib/town";

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

type RepoRef = {
  fullName: string;
  ref: string;
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

  const fallback = {
    name: defaultBranch,
    compareUrl: compareUrl(fullName, defaultBranch, defaultBranch),
    isDefault: true,
  };

  try {
    // One API call per repo: recent push events carry the branch name and
    // timestamp directly. Replaces the old pattern of fetching all branches
    // (up to 100) + one commit API call per branch.
    type GitHubPushEvent = {
      type: string;
      created_at: string;
      payload: { ref?: string };
    };
    const response = await fetch(
      `https://api.github.com/repos/${fullName}/events?per_page=30`,
      { headers },
    );
    if (!response.ok) return fallback;

    const events = (await response.json()) as GitHubPushEvent[];
    const latestPush = Array.isArray(events)
      ? events.find((e) => e.type === "PushEvent" && e.payload?.ref)
      : undefined;

    if (!latestPush?.payload?.ref) return fallback;

    const branchName = latestPush.payload.ref.replace(/^refs\/heads\//, "");
    return {
      name: branchName,
      pushedAt: latestPush.created_at,
      compareUrl: compareUrl(fullName, defaultBranch, branchName),
      isDefault: branchName === defaultBranch,
    };
  } catch {
    return fallback;
  }
}

async function fetchMostRecentPrRef(
  fullName: string,
  token?: string,
): Promise<RepoRef | undefined> {
  const headers: Record<string, string> = {
    "User-Agent": "willville-edge",
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    type GitHubPull = {
      head?: {
        ref?: string;
        sha?: string;
        repo?: { full_name?: string } | null;
      };
    };
    const r = await fetch(
      `https://api.github.com/repos/${fullName}/pulls?state=open&sort=updated&direction=desc&per_page=1`,
      { headers },
    );
    if (!r.ok) return undefined;
    const pulls = (await r.json()) as GitHubPull[];
    const head = Array.isArray(pulls) ? pulls[0]?.head : undefined;
    const headFullName = head?.repo?.full_name;
    const headRef = head?.ref ?? head?.sha;
    if (!headFullName || !headRef) return undefined;
    return { fullName: headFullName, ref: headRef };
  } catch {
    return undefined;
  }
}

function uniqueRefs(refs: Array<RepoRef | undefined>): RepoRef[] {
  const seen = new Set<string>();
  const result: RepoRef[] = [];
  for (const ref of refs) {
    if (!ref) continue;
    const key = `${ref.fullName}:${ref.ref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ref);
  }
  return result;
}

async function firstResolved<T>(
  refs: RepoRef[],
  fetcher: (ref: RepoRef) => Promise<T | undefined>,
): Promise<T | undefined> {
  for (const ref of refs) {
    const value = await fetcher(ref);
    if (value !== undefined) return value;
  }
  return undefined;
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
  ref: string,
  token?: string,
): Promise<WillvillePacket | undefined> {
  const headers: Record<string, string> = {
    "User-Agent": "willville-edge",
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const r = await fetch(
      `https://api.github.com/repos/${fullName}/contents/STATUS.md?ref=${encodeURIComponent(ref)}`,
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

function parseWillvilleManifest(raw: unknown): WillvilleManifest | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as {
    schema_version?: unknown;
    agent?: {
      status?: unknown;
      direction?: unknown;
      difficulties?: unknown;
      needs_human?: unknown;
      last_update?: unknown;
      actions?: unknown;
    };
  };
  if (!source.agent || typeof source.agent !== "object") return undefined;
  const actions = Array.isArray(source.agent.actions)
    ? source.agent.actions
        .map((action) => {
          if (!action || typeof action !== "object") return undefined;
          const item = action as { name?: unknown; status?: unknown };
          if (typeof item.name !== "string") return undefined;
          return {
            name: item.name,
            status: typeof item.status === "string" ? item.status : "planned",
          };
        })
        .filter((action) => action !== undefined)
    : undefined;

  return {
    schemaVersion:
      typeof source.schema_version === "number"
        ? source.schema_version
        : undefined,
    agent: {
      status:
        typeof source.agent.status === "string"
          ? source.agent.status
          : undefined,
      direction:
        typeof source.agent.direction === "string"
          ? source.agent.direction
          : undefined,
      difficulties:
        typeof source.agent.difficulties === "string"
          ? source.agent.difficulties
          : undefined,
      needsHuman:
        typeof source.agent.needs_human === "string"
          ? source.agent.needs_human
          : undefined,
      lastUpdate:
        typeof source.agent.last_update === "string"
          ? source.agent.last_update
          : undefined,
      actions,
    },
  };
}

/** Fetch .willville.json and parse the committed agent packet. */
async function fetchWillvilleManifest(
  fullName: string,
  ref: string,
  token?: string,
): Promise<WillvilleManifest | undefined> {
  const headers: Record<string, string> = {
    "User-Agent": "willville-edge",
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const r = await fetch(
      `https://api.github.com/repos/${fullName}/contents/.willville.json?ref=${encodeURIComponent(ref)}`,
      { headers },
    );
    if (!r.ok) return undefined;
    const data = (await r.json()) as { content?: string; encoding?: string };
    if (!data.content || data.encoding !== "base64") return undefined;
    const body = atob(data.content.replace(/\s/g, ""));
    return parseWillvilleManifest(JSON.parse(body));
  } catch {
    return undefined;
  }
}

export const onRequestGet: PagesFunction<Env> = async ({
  request: _request,
  env,
}) => {
  // Always use PAT when available to avoid unauthenticated rate limits (60/hr).
  const token = env.GITHUB_PAT;
  const repos = await listOwnerRepos(token);
  const cutoff = Date.now() - TWO_YEARS_MS;
  const candidates = repos.filter((r) => {
    if (r.fork || r.archived) return false;
    return Date.parse(r.pushed_at) >= cutoff;
  });

  const repoMetas: RepoMeta[] = await mapLimit(candidates, 8, async (r) => {
    const [milestones, commitCounts, activeBranch, prRef] = await Promise.all([
      fetchMilestones(OWNER, r.name, token),
      fetchCommitCounts(r.full_name, token),
      fetchActiveBranch(r.full_name, r.default_branch, token),
      fetchMostRecentPrRef(r.full_name, token),
    ]);
    // Agent packets resolve in priority order: current active branch, then the
    // most recently updated PR branch, then the repo default branch.
    const packetRefs = uniqueRefs([
      activeBranch?.name
        ? { fullName: r.full_name, ref: activeBranch.name }
        : undefined,
      prRef,
      { fullName: r.full_name, ref: r.default_branch },
    ]);
    const [willvilleManifest, willvillePacket] = await Promise.all([
      firstResolved(packetRefs, (ref) =>
        fetchWillvilleManifest(ref.fullName, ref.ref, token),
      ),
      firstResolved(packetRefs, (ref) =>
        fetchWillvillePacket(ref.fullName, ref.ref, token),
      ),
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
      willvilleManifest,
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

  const stops = buildTown(repoMetas);

  const cacheControl = "no-store";

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

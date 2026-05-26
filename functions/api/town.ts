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
  type GitHubWorkflowRun,
  type RepoMeta,
} from "../../lib/town";
import { WillvilleManifestClient } from "./town-manifests";

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

type GitHubWorkflowRunEntry = {
  name?: string | null;
  display_title?: string | null;
  html_url?: string | null;
  status?: string | null;
  conclusion?: string | null;
  head_branch?: string | null;
};

function workflowRunStatus(
  run: GitHubWorkflowRunEntry,
): GitHubWorkflowRun["status"] {
  if (run.status !== "completed") return "running";
  if (run.conclusion === "success") return "success";
  if (
    run.conclusion === "failure" ||
    run.conclusion === "cancelled" ||
    run.conclusion === "timed_out" ||
    run.conclusion === "action_required" ||
    run.conclusion === "startup_failure" ||
    run.conclusion === "stale"
  ) {
    return "failed";
  }
  return "neutral";
}

function workflowRunName(run: GitHubWorkflowRunEntry): string {
  const label =
    typeof run.name === "string" && run.name.trim().length > 0
      ? run.name.trim()
      : typeof run.display_title === "string" &&
          run.display_title.trim().length > 0
        ? run.display_title.trim()
        : "Workflow run";

  if (
    typeof run.head_branch === "string" &&
    run.head_branch.trim().length > 0
  ) {
    return `${label} (${run.head_branch.trim()})`;
  }

  return label;
}

async function fetchWorkflowRuns(
  fullName: string,
  token?: string,
): Promise<RepoMeta["workflowRuns"]> {
  const headers: Record<string, string> = {
    "User-Agent": "willville-edge",
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${fullName}/actions/runs?per_page=3`,
      { headers },
    );
    if (!response.ok) return undefined;

    const payload = (await response.json()) as {
      workflow_runs?: GitHubWorkflowRunEntry[];
    };
    if (!Array.isArray(payload.workflow_runs)) return [];

    return payload.workflow_runs.flatMap((run) => {
      if (typeof run.html_url !== "string" || run.html_url.length === 0) {
        return [];
      }

      return [
        {
          name: workflowRunName(run),
          status: workflowRunStatus(run),
          url: run.html_url,
        },
      ];
    });
  } catch {
    return undefined;
  }
}

type RepoSignals = {
  openPrCount?: number;
  branchCount?: number;
  lastMergeAt?: string;
  latestRelease?: RepoMeta["latestRelease"];
};

const REPO_SIGNALS_QUERY = `
query ($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    refs(refPrefix: "refs/heads/", first: 1) {
      totalCount
    }
    pullRequests(states: OPEN, first: 1) {
      totalCount
    }
    mergedPulls: pullRequests(
      states: MERGED
      first: 1
      orderBy: { field: UPDATED_AT, direction: DESC }
    ) {
      nodes {
        mergedAt
      }
    }
    latestRelease {
      name
      tagName
      publishedAt
    }
  }
}`;

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
): Promise<
  | {
      d3: number;
      d7: number;
      d21: number;
      latestCommitAt?: string;
      recentCommits?: RepoMeta["recentCommits"];
    }
  | undefined
> {
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
    type CommitEntry = {
      html_url?: string | null;
      commit?: {
        message?: string | null;
        author?: { date?: string | null } | null;
        committer?: { date?: string | null } | null;
      } | null;
    };
    const commits = (await r.json()) as CommitEntry[];
    if (!Array.isArray(commits)) return undefined;

    const now = Date.now();
    let d3 = 0,
      d7 = 0,
      d21 = 0;
    let latestCommitAt: string | undefined;
    let latestCommitTime = 0;
    const recentCommits = commits
      .flatMap((commit) => {
        const message = commit.commit?.message?.split("\n")[0]?.trim();
        const committedAt =
          commit.commit?.author?.date ?? commit.commit?.committer?.date;
        if (
          typeof commit.html_url !== "string" ||
          commit.html_url.length === 0 ||
          !message ||
          !committedAt
        ) {
          return [];
        }
        return [
          {
            message,
            url: commit.html_url,
            committedAt,
          },
        ];
      })
      .slice(0, 3);
    for (const c of commits) {
      const rawDate = c.commit?.author?.date ?? c.commit?.committer?.date ?? "";
      const t = Date.parse(rawDate);
      if (Number.isNaN(t)) continue;
      if (t > latestCommitTime) {
        latestCommitTime = t;
        latestCommitAt = rawDate;
      }
      const daysAgo = (now - t) / 86_400_000;
      if (daysAgo <= 3) d3++;
      if (daysAgo <= 7) d7++;
      d21++; // all commits from the `since` window count
    }
    return { d3, d7, d21, latestCommitAt, recentCommits };
  } catch {
    return undefined;
  }
}

async function fetchRepoSignals(
  owner: string,
  name: string,
  token?: string,
): Promise<RepoSignals | undefined> {
  if (!token) return undefined;

  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "willville-edge",
      },
      body: JSON.stringify({
        query: REPO_SIGNALS_QUERY,
        variables: { owner, name },
      }),
    });
    if (!response.ok) return undefined;

    const payload = (await response.json()) as {
      data?: {
        repository?: {
          refs?: { totalCount?: number | null } | null;
          pullRequests?: { totalCount?: number | null } | null;
          mergedPulls?: {
            nodes?: Array<{ mergedAt?: string | null } | null> | null;
          } | null;
          latestRelease?: {
            name?: string | null;
            tagName?: string | null;
            publishedAt?: string | null;
          } | null;
        } | null;
      };
    };

    const repository = payload.data?.repository;
    if (!repository) return undefined;

    const latestRelease = repository.latestRelease
      ? {
          name:
            repository.latestRelease.name ??
            repository.latestRelease.tagName ??
            "release",
          tagName: repository.latestRelease.tagName ?? undefined,
          publishedAt: repository.latestRelease.publishedAt ?? undefined,
        }
      : undefined;

    return {
      openPrCount: repository.pullRequests?.totalCount ?? undefined,
      branchCount: repository.refs?.totalCount ?? undefined,
      lastMergeAt: repository.mergedPulls?.nodes?.[0]?.mergedAt ?? undefined,
      latestRelease,
    };
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
      payload: { ref?: string; head?: string };
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
      commitHash: latestPush.payload.head,
      compareUrl: compareUrl(fullName, defaultBranch, branchName),
      isDefault: branchName === defaultBranch,
    };
  } catch {
    return fallback;
  }
}

export const onRequestGet: PagesFunction<Env> = async ({
  request: _request,
  env,
}) => {
  // Always use PAT when available to avoid unauthenticated rate limits (60/hr).
  const token = env.GITHUB_PAT;
  const manifestClient = new WillvilleManifestClient(token);
  const repos = await listOwnerRepos(token);
  const cutoff = Date.now() - TWO_YEARS_MS;
  const candidates = repos.filter((r) => {
    if (r.fork || r.archived) return false;
    return Date.parse(r.pushed_at) >= cutoff;
  });

  const repoMetas: RepoMeta[] = await mapLimit(candidates, 8, async (r) => {
    const [milestones, commitCounts, activeBranch, repoSignals, workflowRuns] =
      await Promise.all([
        fetchMilestones(OWNER, r.name, token),
        fetchCommitCounts(r.full_name, token),
        fetchActiveBranch(r.full_name, r.default_branch, token),
        fetchRepoSignals(OWNER, r.name, token),
        fetchWorkflowRuns(r.full_name, token),
      ]);
    const { willvilleManifest, willvillePacket } =
      await manifestClient.fetchRepoPackets(
        r.full_name,
        r.default_branch,
        activeBranch,
      );
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
      openIssuesCount: Math.max(
        0,
        r.open_issues_count - (repoSignals?.openPrCount ?? 0),
      ),
      stars: r.stargazers_count,
      language: r.language ?? undefined,
      openPrCount: repoSignals?.openPrCount,
      branchCount: repoSignals?.branchCount,
      commits3d: commitCounts?.d3,
      commits7d: commitCounts?.d7,
      commits21d: commitCounts?.d21,
      lastCommitAt: commitCounts?.latestCommitAt,
      lastMergeAt: repoSignals?.lastMergeAt,
      latestRelease: repoSignals?.latestRelease,
      activeBranch,
      recentCommits: commitCounts?.recentCommits,
      workflowRuns,
    };
  });

  const stops = buildTown(repoMetas);

  const cacheControl = "public, s-maxage=45, stale-while-revalidate=180";

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

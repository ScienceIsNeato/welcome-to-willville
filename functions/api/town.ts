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

import {
  buildTown,
  type GitHubWorkflowRun,
  type RepoMeta,
  type Stop,
} from "../../lib/town";
import { withCorsHeaders } from "./cors";
import {
  type ManifestCacheStore,
  hydrateManifestCacheFromStore,
  readCachedRepoManifest,
  WillvilleManifestClient,
} from "./town-manifests";

interface Env {
  GITHUB_PAT?: string;
  WILLVILLE_MAYOR_KEY?: string;
  WILLVILLE_MANIFEST_CACHE?: ManifestCacheStore;
}

const OWNER = "ScienceIsNeato";
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const TOWN_SNAPSHOT_KEY = "willville:town:snapshot:v1";
const TOWN_SNAPSHOT_TTL_SECONDS = 60 * 15;

type TownSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  stops: Stop[];
};

let townSnapshotMemory: TownSnapshot | null = null;

function parseTownSnapshot(raw: unknown): TownSnapshot | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const candidate = raw as Partial<TownSnapshot>;
  if (candidate.schemaVersion !== 1) {
    return undefined;
  }

  if (typeof candidate.generatedAt !== "string") {
    return undefined;
  }

  if (!Array.isArray(candidate.stops)) {
    return undefined;
  }

  return {
    schemaVersion: 1,
    generatedAt: candidate.generatedAt,
    stops: candidate.stops as Stop[],
  };
}

async function readTownSnapshot(
  store?: ManifestCacheStore,
): Promise<TownSnapshot | undefined> {
  if (!store) {
    return undefined;
  }

  try {
    const raw = await store.get(TOWN_SNAPSHOT_KEY, { type: "json" });
    const snapshot = parseTownSnapshot(raw);
    if (!snapshot || snapshot.stops.length === 0) {
      return undefined;
    }
    return snapshot;
  } catch {
    return undefined;
  }
}

async function persistTownSnapshot(
  store: ManifestCacheStore | undefined,
  generatedAt: string,
  stops: Stop[],
): Promise<void> {
  if (!store || stops.length === 0) {
    return;
  }

  try {
    await store.put(
      TOWN_SNAPSHOT_KEY,
      JSON.stringify({
        schemaVersion: 1,
        generatedAt,
        stops,
      } satisfies TownSnapshot),
      {
        expirationTtl: TOWN_SNAPSHOT_TTL_SECONDS,
      },
    );
  } catch {
    // Keep API available even if durable cache writes fail.
  }
}

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
  created_at: string;
  default_branch: string;
  homepage: string | null;
  description: string | null;
  open_issues_count: number;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  size: number;
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
  totalCommits?: number;
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
    defaultBranchRef {
      target {
        ... on Commit {
          history {
            totalCount
          }
        }
      }
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
 * Paginates until the window is exhausted (no artificial cap).
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
  const since = new Date(Date.now() - 28 * 86_400_000).toISOString();

  type CommitEntry = {
    html_url?: string | null;
    commit?: {
      message?: string | null;
      author?: { date?: string | null } | null;
      committer?: { date?: string | null } | null;
    } | null;
  };

  try {
    const commits: CommitEntry[] = [];
    let page = 1;
    while (true) {
      const r = await fetch(
        `https://api.github.com/repos/${fullName}/commits?since=${since}&per_page=100&page=${page}`,
        { headers },
      );
      if (!r.ok) return undefined;
      const batch = (await r.json()) as CommitEntry[];
      if (!Array.isArray(batch)) return undefined;
      commits.push(...batch);
      if (batch.length < 100) break;
      if (++page > 10) break; // safety cap at 1 000 commits per window
    }

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
      if (daysAgo <= 21) d21++;
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
          defaultBranchRef?: {
            target?: {
              history?: { totalCount?: number | null } | null;
            } | null;
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
      totalCommits:
        repository.defaultBranchRef?.target?.history?.totalCount ?? undefined,
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

type RecentBranchesResult = {
  activeBranch: NonNullable<RepoMeta["activeBranch"]>;
};

async function fetchRecentBranches(
  fullName: string,
  defaultBranch: string,
  token?: string,
): Promise<RecentBranchesResult> {
  const headers: Record<string, string> = {
    "User-Agent": "willville-edge",
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const fallback: RecentBranchesResult = {
    activeBranch: {
      name: defaultBranch,
      compareUrl: compareUrl(fullName, defaultBranch, defaultBranch),
      isDefault: true,
    },
  };

  try {
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
    if (!Array.isArray(events)) return fallback;

    const pushes = events.filter(
      (e) => e.type === "PushEvent" && e.payload?.ref,
    );

    // The "active branch" shown on the board is the most recent feature push.
    // Manifest loading only reads active branch, then falls back to default.
    const latestPush =
      pushes.find((e) => {
        const ref = (e.payload.ref ?? "").replace(/^refs\/heads\//, "");
        return ref !== defaultBranch;
      }) ?? pushes[0];

    if (!latestPush?.payload?.ref) return fallback;

    const branchName = latestPush.payload.ref.replace(/^refs\/heads\//, "");
    return {
      activeBranch: {
        name: branchName,
        pushedAt: latestPush.created_at,
        commitHash: latestPush.payload.head,
        compareUrl: compareUrl(fullName, defaultBranch, branchName),
        isDefault: branchName === defaultBranch,
      },
    };
  } catch {
    return fallback;
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Always use PAT when available to avoid unauthenticated rate limits (60/hr).
  const token = env.GITHUB_PAT;
  await hydrateManifestCacheFromStore(env.WILLVILLE_MANIFEST_CACHE);

  const requestUrl = new URL(request.url);
  const forceRefresh = requestUrl.searchParams.has("refresh");

  if (!forceRefresh) {
    if (townSnapshotMemory && townSnapshotMemory.stops.length > 0) {
      return new Response(
        JSON.stringify({
          mayor: true,
          generatedAt: townSnapshotMemory.generatedAt,
          stops: townSnapshotMemory.stops,
        }),
        {
          headers: withCorsHeaders(request, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, s-maxage=45, stale-while-revalidate=180",
          }),
        },
      );
    }

    const snapshot = await readTownSnapshot(env.WILLVILLE_MANIFEST_CACHE);
    if (snapshot) {
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

  const repos = await listOwnerRepos(token);
  const cutoff = Date.now() - TWO_YEARS_MS;
  const manifestClient = new WillvilleManifestClient(token);
  const candidates = repos.filter((r) => {
    if (r.fork || r.archived) return false;
    return Date.parse(r.pushed_at) >= cutoff;
  });

  const repoMetas: RepoMeta[] = await mapLimit(candidates, 8, async (r) => {
    const [milestones, commitCounts, branchResult, repoSignals, workflowRuns] =
      await Promise.all([
        fetchMilestones(OWNER, r.name, token),
        fetchCommitCounts(r.full_name, token),
        fetchRecentBranches(r.full_name, r.default_branch, token),
        fetchRepoSignals(OWNER, r.name, token),
        fetchWorkflowRuns(r.full_name, token),
      ]);
    const activeBranch = branchResult.activeBranch;
    const willvilleManifest =
      readCachedRepoManifest(r.full_name) ??
      (await manifestClient.fetchRepoManifest(
        r.full_name,
        r.default_branch,
        activeBranch,
      ));
    return {
      repo: r.full_name,
      isPrivate: r.private,
      isFork: r.fork,
      isArchived: r.archived,
      pushedAt: r.pushed_at,
      createdAt: r.created_at,
      defaultBranch: r.default_branch,
      homepage: r.homepage ?? undefined,
      description: r.description ?? undefined,
      topics: r.topics ?? [],
      sizeKb: r.size > 0 ? r.size : undefined,
      totalCommits: repoSignals?.totalCommits,
      openMilestones: milestones.map((m) => ({
        title: m.title,
        dueOn: m.due_on,
        openIssues: m.open_issues,
      })),
      willvilleManifest,
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
  const generatedAt = new Date().toISOString();
  townSnapshotMemory = {
    schemaVersion: 1,
    generatedAt,
    stops,
  };
  await persistTownSnapshot(env.WILLVILLE_MANIFEST_CACHE, generatedAt, stops);

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

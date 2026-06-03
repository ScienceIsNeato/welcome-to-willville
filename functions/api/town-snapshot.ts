/**
 * Shared town-snapshot builder + durable persistence.
 *
 * The bell (POST /api/manifests) is the sole writer of the town snapshot. It
 * runs the "huge query" against GitHub (repos, milestones, commit counts,
 * branches, PR/release signals, workflow runs), folds the result into the flat
 * Stop[] the SVG layer renders, and persists it here. The read path
 * (GET /api/town) only ever reads this snapshot — it never rebuilds-on-read or
 * writes to the DB.
 *
 * The snapshot is stored without a TTL, so it survives until the next bell ring
 * overwrites it: ringing the bell from any client refreshes the durable data
 * for every future session.
 */

import {
  allyContributorLogin,
  allyEntries,
  buildAllyStops,
  buildTown,
  type AllyInput,
  type Contribution,
  type GitHubWorkflowRun,
  type RepoMeta,
  type Stop,
} from "../../lib/town";
import {
  type ManifestCacheStore,
  readCachedRepoManifest,
  WillvilleManifestClient,
} from "./town-manifests";

const OWNER = "ScienceIsNeato";
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export const TOWN_SNAPSHOT_KEY = "willville:town:snapshot:v1";

export type TownSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  manifestCachedAt?: string;
  stops: Stop[];
};

export function parseTownSnapshot(raw: unknown): TownSnapshot | undefined {
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

  const manifestCachedAt =
    typeof candidate.manifestCachedAt === "string"
      ? candidate.manifestCachedAt
      : undefined;

  return {
    schemaVersion: 1,
    generatedAt: candidate.generatedAt,
    manifestCachedAt,
    stops: candidate.stops as Stop[],
  };
}

export async function readTownSnapshot(
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

export async function persistTownSnapshot(
  store: ManifestCacheStore | undefined,
  generatedAt: string,
  manifestCachedAt: string,
  stops: Stop[],
): Promise<void> {
  if (!store || stops.length === 0) {
    return;
  }

  try {
    // No TTL: the snapshot is owned by the bell and persists until the next
    // ring overwrites it, so a quiet town never expires back to a blank DB.
    await store.put(
      TOWN_SNAPSHOT_KEY,
      JSON.stringify({
        schemaVersion: 1,
        generatedAt,
        manifestCachedAt,
        stops,
      } satisfies TownSnapshot),
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

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "willville-edge",
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Fetch a single repo's metadata by full name (for ally repos we don't own). */
async function fetchSingleRepo(
  fullName: string,
  token?: string,
): Promise<GitHubRepo | undefined> {
  try {
    const r = await fetch(`https://api.github.com/repos/${fullName}`, {
      headers: githubHeaders(token),
    });
    if (!r.ok) return undefined;
    return (await r.json()) as GitHubRepo;
  } catch {
    return undefined;
  }
}

/**
 * My contribution footprint in an ally repo: commits I authored (capped at one
 * page) and PRs I opened (open + merged, via the Search API).
 */
async function fetchContribution(
  fullName: string,
  login: string,
  token?: string,
): Promise<Contribution> {
  const headers = githubHeaders(token);
  const result: Contribution = { login };

  try {
    const r = await fetch(
      `https://api.github.com/repos/${fullName}/commits?author=${encodeURIComponent(login)}&per_page=100`,
      { headers },
    );
    if (r.ok) {
      const batch = (await r.json()) as Array<{
        commit?: {
          author?: { date?: string | null } | null;
          committer?: { date?: string | null } | null;
        } | null;
      }>;
      if (Array.isArray(batch)) {
        result.commits = batch.length;
        const latest =
          batch[0]?.commit?.author?.date ?? batch[0]?.commit?.committer?.date;
        if (latest) result.lastCommitAt = latest;
      }
    }
  } catch {
    // leave commits undefined
  }

  const prCount = async (qualifier: string): Promise<number | undefined> => {
    try {
      const q = `repo:${fullName} type:pr author:${login} ${qualifier}`;
      const r = await fetch(
        `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=1`,
        { headers },
      );
      if (!r.ok) return undefined;
      const data = (await r.json()) as { total_count?: number };
      return typeof data.total_count === "number"
        ? data.total_count
        : undefined;
    } catch {
      return undefined;
    }
  };

  result.openPrs = await prCount("state:open");
  result.mergedPrs = await prCount("is:merged");
  return result;
}

/**
 * Fetch the curated ally repos (Ally Alley) — same repo-health signals as owned
 * repos, plus my contribution footprint. Keyed by config index so each isle's
 * position stays stable even if a fetch fails.
 */
async function buildAllyInputs(token?: string): Promise<AllyInput[]> {
  const entries = allyEntries();
  if (entries.length === 0) return [];
  const login = allyContributorLogin();

  const inputs = await mapLimit(
    entries,
    4,
    async (entry): Promise<AllyInput | null> => {
      const index = entries.indexOf(entry);
      const fullName = entry.repo;
      const repo = await fetchSingleRepo(fullName, token);
      if (!repo) return null;
      const [owner, name] = fullName.split("/") as [string, string];

      const [
        milestones,
        commitCounts,
        branchResult,
        repoSignals,
        workflowRuns,
        contribution,
      ] = await Promise.all([
        fetchMilestones(owner, name, token),
        fetchCommitCounts(repo.full_name, token),
        fetchRecentBranches(repo.full_name, repo.default_branch, token),
        fetchRepoSignals(owner, name, token),
        fetchWorkflowRuns(repo.full_name, token),
        fetchContribution(repo.full_name, login, token),
      ]);

      const meta: RepoMeta = {
        repo: repo.full_name,
        source: "ally",
        isPrivate: repo.private,
        isFork: repo.fork,
        isArchived: repo.archived,
        pushedAt: repo.pushed_at,
        createdAt: repo.created_at,
        defaultBranch: repo.default_branch,
        homepage: repo.homepage ?? undefined,
        description: repo.description ?? undefined,
        topics: repo.topics ?? [],
        sizeKb: repo.size > 0 ? repo.size : undefined,
        totalCommits: repoSignals?.totalCommits,
        openMilestones: milestones.map((m) => ({
          title: m.title,
          dueOn: m.due_on,
          openIssues: m.open_issues,
        })),
        openIssuesCount: Math.max(
          0,
          repo.open_issues_count - (repoSignals?.openPrCount ?? 0),
        ),
        stars: repo.stargazers_count,
        language: repo.language ?? undefined,
        openPrCount: repoSignals?.openPrCount,
        branchCount: repoSignals?.branchCount,
        commits3d: commitCounts?.d3,
        commits7d: commitCounts?.d7,
        commits21d: commitCounts?.d21,
        lastCommitAt: commitCounts?.latestCommitAt,
        lastMergeAt: repoSignals?.lastMergeAt,
        latestRelease: repoSignals?.latestRelease,
        activeBranch: branchResult.activeBranch,
        recentCommits: commitCounts?.recentCommits,
        workflowRuns,
        contribution,
      };

      return {
        meta,
        index,
        displayName: entry.displayName,
        blurb: entry.blurb,
        position: entry.position,
      } satisfies AllyInput;
    },
  );

  return inputs.filter((input): input is AllyInput => input !== null);
}

/**
 * Runs the full "huge query" and folds repo metadata into Stop[].
 *
 * Reads `.willville.json` packets from the in-memory manifest cache first
 * (hydrated by the bell), falling back to a live fetch per repo. Callers should
 * ensure the manifest cache is hydrated before invoking.
 */
export async function buildTownStops(token?: string): Promise<Stop[]> {
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

  const ownerStops = buildTown(repoMetas);
  const allyStops = buildAllyStops(await buildAllyInputs(token));
  return [...ownerStops, ...allyStops];
}

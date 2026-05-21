/**
 * POST /api/manifests
 *
 * Tolling the town bell:
 *   1. Query GitHub for the active ScienceIsNeato repo list
 *   2. Register every discovered repo as a Willville site
 *   3. Populate a `<!-- willville ... -->` packet for each registered site
 *   4. PUT the updated STATUS.md file back via the GitHub Contents API
 *
 * Returns discovered, registered, newlyRegistered, updated, skipped, errors.
 *
 * Requires GITHUB_PAT in env (write scope). Returns 403 without it.
 */

import type { PagesFunction } from "../types";
import { heuristicForRepo } from "../../lib/willville.heuristics";

interface Env {
  GITHUB_PAT?: string;
}

const OWNER = "ScienceIsNeato";
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

// Matches the existing willville packet block (greedy-safe with [\s\S]*?)
const PACKET_RE = /<!--\s*willville\b[\s\S]*?-->/;

type GitHubRepo = {
  full_name: string;
  name: string;
  fork: boolean;
  archived: boolean;
  pushed_at: string;
  default_branch: string;
  description: string | null;
  private: boolean;
};

type GitHubMilestone = {
  title: string;
  due_on: string | null;
  state: "open" | "closed";
};

type RepoMeta = {
  fullName: string;
  defaultBranch: string;
  description: string | null;
  pushedAt: string;
  openMilestones: { title: string; dueOn: string | null }[];
};

type RegisteredRepo = {
  fullName: string;
  source: "registry" | "auto";
  stopId: string;
};

// ---------------------------------------------------------------------------
// GitHub helpers
// ---------------------------------------------------------------------------

function ghHeaders(token: string): Record<string, string> {
  return {
    "User-Agent": "willville-manifests",
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
  };
}

async function listRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  while (true) {
    const url = `https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner&sort=pushed&direction=desc`;
    const r = await fetch(url, { headers: ghHeaders(token) });
    if (!r.ok) break;
    const batch = (await r.json()) as GitHubRepo[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const repo of batch) {
      if (repo.full_name.startsWith(`${OWNER}/`)) repos.push(repo);
    }
    if (batch.length < 100) break;
    if (++page > 5) break;
  }
  return repos;
}

async function fetchMilestones(
  fullName: string,
  token: string,
): Promise<{ title: string; dueOn: string | null }[]> {
  const url = `https://api.github.com/repos/${fullName}/milestones?state=open&sort=due_on&direction=asc&per_page=5`;
  try {
    const r = await fetch(url, { headers: ghHeaders(token) });
    if (!r.ok) return [];
    const data = (await r.json()) as GitHubMilestone[];
    return Array.isArray(data)
      ? data.map((m) => ({ title: m.title, dueOn: m.due_on }))
      : [];
  } catch {
    return [];
  }
}

type ContentsResponse = { content: string; sha: string; encoding: string };

async function getStatusMd(
  fullName: string,
  branch: string,
  token: string,
): Promise<{ body: string; sha: string } | null> {
  const url = `https://api.github.com/repos/${fullName}/contents/STATUS.md?ref=${branch}`;
  try {
    const r = await fetch(url, { headers: ghHeaders(token) });
    if (r.status === 404) return null;
    if (!r.ok) return null;
    const data = (await r.json()) as ContentsResponse;
    if (data.encoding !== "base64") return null;
    const body = atob(data.content.replace(/\s/g, ""));
    return { body, sha: data.sha };
  } catch {
    return null;
  }
}

async function putStatusMd(
  fullName: string,
  branch: string,
  token: string,
  content: string,
  sha: string | undefined,
  message: string,
): Promise<boolean> {
  const url = `https://api.github.com/repos/${fullName}/contents/STATUS.md`;
  const body: Record<string, string> = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch,
  };
  if (sha) body.sha = sha;
  try {
    const r = await fetch(url, {
      method: "PUT",
      headers: { ...ghHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.ok || r.status === 201;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Packet generation
// ---------------------------------------------------------------------------

function deriveState(pushedAt: string, hasOpenMilestone: boolean): string {
  if (hasOpenMilestone) return "wip";
  const days = (Date.now() - Date.parse(pushedAt)) / 86_400_000;
  if (days <= 14) return "shipping";
  if (days <= 90) return "maintenance";
  return "dormant";
}

function buildPacket(meta: RepoMeta): string {
  const state = deriveState(meta.pushedAt, meta.openMilestones.length > 0);
  const lines = ["<!-- willville", `status: ${state}`];
  if (meta.description) lines.push(`summary: ${meta.description}`);
  if (meta.openMilestones[0]) {
    const m = meta.openMilestones[0];
    lines.push(`milestone: ${m.title}`);
    if (m.dueOn) lines.push(`eta_date: ${m.dueOn.slice(0, 10)}`);
  }
  lines.push("-->");
  return lines.join("\n");
}

function applyPacket(existing: string | null, packet: string): string {
  if (existing === null) return packet + "\n";
  if (PACKET_RE.test(existing)) return existing.replace(PACKET_RE, packet);
  return packet + "\n\n" + existing;
}

function repoStopId(fullName: string): string {
  return fullName
    .split("/")
    .at(-1)!
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function registerRepo(repo: GitHubRepo): RegisteredRepo {
  const heuristic = heuristicForRepo(repo.full_name);
  if (heuristic) {
    return {
      fullName: repo.full_name,
      source: "registry",
      stopId: heuristic.stopId,
    };
  }
  return {
    fullName: repo.full_name,
    source: "auto",
    stopId: repoStopId(repo.full_name),
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  const token = env.GITHUB_PAT;
  if (!token) {
    return new Response(JSON.stringify({ error: "No GITHUB_PAT configured" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const repos = await listRepos(token);
  const cutoff = Date.now() - TWO_YEARS_MS;
  const candidates = repos.filter(
    (r) => !r.fork && !r.archived && Date.parse(r.pushed_at) >= cutoff,
  );
  const registered = candidates.map(registerRepo);
  const newlyRegistered = registered
    .filter((r) => r.source === "auto")
    .map((r) => r.fullName);

  const updated: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  await Promise.allSettled(
    candidates.map(async (r) => {
      try {
        const milestones = await fetchMilestones(r.full_name, token);
        const meta: RepoMeta = {
          fullName: r.full_name,
          defaultBranch: r.default_branch,
          description: r.description,
          pushedAt: r.pushed_at,
          openMilestones: milestones,
        };
        const packet = buildPacket(meta);
        const existing = await getStatusMd(
          r.full_name,
          r.default_branch,
          token,
        );
        const newBody = applyPacket(existing?.body ?? null, packet);

        // Skip if content is identical
        if (existing && existing.body.trim() === newBody.trim()) {
          skipped.push(r.full_name);
          return;
        }

        const ok = await putStatusMd(
          r.full_name,
          r.default_branch,
          token,
          newBody,
          existing?.sha,
          "chore: update willville status packet",
        );

        if (ok) updated.push(r.full_name);
        else errors.push(r.full_name);
      } catch {
        errors.push(r.full_name);
      }
    }),
  );

  return new Response(
    JSON.stringify({
      updated,
      skipped,
      errors,
      discovered: candidates.map((r) => r.full_name),
      registered,
      newlyRegistered,
      total: candidates.length,
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
};

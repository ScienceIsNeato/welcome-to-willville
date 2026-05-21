#!/usr/bin/env node
/**
 * scripts/populate-manifests.mjs
 *
 * Writes <!-- willville ... --> STATUS.md packets to all active repos.
 * Auth priority:
 *   1. gh CLI (if installed + authenticated)
 *   2. GITHUB_PAT env var
 *
 * Usage: node scripts/populate-manifests.mjs
 */

import { spawnSync } from "child_process";

const OWNER = "ScienceIsNeato";
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const PACKET_RE = /<!--\s*willville\b[\s\S]*?-->/;

// ─── Auth strategy detection ───────────────────────────────────────────────

function detectStrategy() {
  // Try gh CLI: `gh auth status` exits 0 when authenticated
  try {
    const probe = spawnSync("gh", ["auth", "status"], { encoding: "utf8" });
    if (probe.status === 0) {
      console.log("✓ gh CLI found and authenticated");
      return { kind: "gh" };
    }
    // gh exists but not authed
    if (probe.stderr?.includes("not logged")) {
      console.log(
        "  gh CLI found but not logged in — run `gh auth login` or set GITHUB_PAT",
      );
    }
  } catch {
    // gh not on PATH
  }

  const pat = process.env.GITHUB_PAT;
  if (pat) {
    console.log("✓ Using GITHUB_PAT env var");
    return { kind: "pat", token: pat };
  }

  console.error(
    "✗ No auth method available. Install gh CLI or set GITHUB_PAT.",
  );
  process.exit(1);
}

// ─── gh CLI wrapper ────────────────────────────────────────────────────────

function ghApi(path, opts = {}) {
  const args = ["api", path];
  if (opts.paginate) args.push("--paginate");
  if (opts.method) args.push("-X", opts.method);

  const spawnOpts = { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 };
  if (opts.stdin) spawnOpts.input = opts.stdin;

  const result = spawnSync("gh", args, spawnOpts);

  // gh api exits non-zero on HTTP errors (4xx/5xx)
  if (result.status !== 0) {
    if (opts.allow404) return null;
    throw new Error(
      result.stderr?.trim() || `gh api ${path} failed (exit ${result.status})`,
    );
  }

  const out = result.stdout?.trim();
  if (!out) return null;

  try {
    return JSON.parse(out);
  } catch {
    // --paginate occasionally returns concatenated JSON arrays; merge them
    const chunks = out.split(/(?<=\])\s*(?=\[)/);
    return chunks.flatMap((c) => JSON.parse(c));
  }
}

// ─── PAT helpers ───────────────────────────────────────────────────────────

function patHeaders(token) {
  return {
    "User-Agent": "willville-manifests",
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
  };
}

// ─── Unified data access ───────────────────────────────────────────────────

async function listRepos(strategy) {
  if (strategy.kind === "gh") {
    const data = ghApi(
      "/user/repos?per_page=100&affiliation=owner&sort=pushed&direction=desc",
      {
        paginate: true,
      },
    );
    const repos = Array.isArray(data) ? data : [];
    return repos.filter((r) => r.full_name?.startsWith(`${OWNER}/`));
  }

  const repos = [];
  let page = 1;
  while (page <= 5) {
    const url = `https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner&sort=pushed&direction=desc`;
    const r = await fetch(url, { headers: patHeaders(strategy.token) });
    if (!r.ok) break;
    const batch = await r.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const repo of batch) {
      if (repo.full_name?.startsWith(`${OWNER}/`)) repos.push(repo);
    }
    if (batch.length < 100) break;
    page++;
  }
  return repos;
}

async function fetchMilestones(fullName, strategy) {
  try {
    if (strategy.kind === "gh") {
      const data = ghApi(
        `/repos/${fullName}/milestones?state=open&sort=due_on&direction=asc&per_page=5`,
        { allow404: true },
      );
      if (!Array.isArray(data)) return [];
      return data.map((m) => ({ title: m.title, dueOn: m.due_on }));
    }

    const url = `https://api.github.com/repos/${fullName}/milestones?state=open&sort=due_on&direction=asc&per_page=5`;
    const r = await fetch(url, { headers: patHeaders(strategy.token) });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data)
      ? data.map((m) => ({ title: m.title, dueOn: m.due_on }))
      : [];
  } catch {
    return [];
  }
}

async function getStatusMd(fullName, branch, strategy) {
  try {
    let data;
    if (strategy.kind === "gh") {
      data = ghApi(`/repos/${fullName}/contents/STATUS.md?ref=${branch}`, {
        allow404: true,
      });
    } else {
      const url = `https://api.github.com/repos/${fullName}/contents/STATUS.md?ref=${branch}`;
      const r = await fetch(url, { headers: patHeaders(strategy.token) });
      if (r.status === 404) return null;
      if (!r.ok) return null;
      data = await r.json();
    }

    if (!data || !data.content) return null;
    const body = Buffer.from(
      data.content.replace(/\s/g, ""),
      "base64",
    ).toString("utf8");
    return { body, sha: data.sha };
  } catch {
    return null;
  }
}

// Returns: "ok" | "protected" | "failed"
async function putStatusMd(fullName, branch, strategy, content, sha, message) {
  const b64 = Buffer.from(content, "utf8").toString("base64");

  if (strategy.kind === "gh") {
    const payload = JSON.stringify({
      message,
      content: b64,
      branch,
      ...(sha && { sha }),
    });
    const result = spawnSync(
      "gh",
      [
        "api",
        `/repos/${fullName}/contents/STATUS.md`,
        "-X",
        "PUT",
        "--input",
        "-",
      ],
      { encoding: "utf8", input: payload, maxBuffer: 2 * 1024 * 1024 },
    );
    if (result.status === 0) return "ok";
    // 409 = branch protection requires PR
    if (result.stderr?.includes("409") || result.stdout?.includes("409"))
      return "protected";
    return "failed";
  }

  const url = `https://api.github.com/repos/${fullName}/contents/STATUS.md`;
  const body = { message, content: b64, branch, ...(sha && { sha }) };
  const r = await fetch(url, {
    method: "PUT",
    headers: {
      ...patHeaders(strategy.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (r.ok || r.status === 201) return "ok";
  if (r.status === 409) return "protected";
  return "failed";
}

// ─── Packet logic ──────────────────────────────────────────────────────────

function deriveState(pushedAt, hasOpenMilestone) {
  if (hasOpenMilestone) return "wip";
  const days = (Date.now() - Date.parse(pushedAt)) / 86_400_000;
  if (days <= 14) return "shipping";
  if (days <= 90) return "maintenance";
  return "dormant";
}

function buildPacket(meta) {
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

function applyPacket(existing, packet) {
  if (existing === null) return packet + "\n";
  if (PACKET_RE.test(existing)) return existing.replace(PACKET_RE, packet);
  return packet + "\n\n" + existing;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const strategy = detectStrategy();

  console.log("\nListing repos…");
  const allRepos = await listRepos(strategy);
  const cutoff = Date.now() - TWO_YEARS_MS;
  const candidates = allRepos.filter(
    (r) => !r.fork && !r.archived && Date.parse(r.pushed_at) >= cutoff,
  );

  console.log(`${candidates.length} active repos (${allRepos.length} total)\n`);

  const updated = [];
  const skipped = [];
  const protected_ = [];
  const errors = [];

  for (const r of candidates) {
    process.stdout.write(`  ${r.full_name} … `);
    try {
      const milestones = await fetchMilestones(r.full_name, strategy);
      const meta = {
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
        strategy,
      );
      const newBody = applyPacket(existing?.body ?? null, packet);

      if (existing && existing.body.trim() === newBody.trim()) {
        console.log("skip (unchanged)");
        skipped.push(r.full_name);
        continue;
      }

      const result = await putStatusMd(
        r.full_name,
        r.default_branch,
        strategy,
        newBody,
        existing?.sha,
        "chore: update willville status packet",
      );

      if (result === "ok") {
        console.log("✓");
        updated.push(r.full_name);
      } else if (result === "protected") {
        console.log("⚠ branch protected (needs PR)");
        protected_.push(r.full_name);
      } else {
        console.log("✗ write failed");
        errors.push(r.full_name);
      }
    } catch (e) {
      console.log(`✗ ${e.message}`);
      errors.push(r.full_name);
    }
  }

  console.log(
    `\nDone: ${updated.length} updated, ${skipped.length} unchanged, ${protected_.length} branch-protected, ${errors.length} errors`,
  );
  if (protected_.length > 0)
    console.log("Branch-protected (need PR):", protected_);
  if (errors.length > 0) {
    console.log("Errors:", errors);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

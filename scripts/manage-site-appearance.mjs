#!/usr/bin/env node
// Durable, audited management for the town site-appearance manifest.
//
// The runtime reposition endpoint can only hold an in-memory queue (the site
// is a static export, so there is no durable server). This CLI is the durable
// half of the pipeline: it snapshots the manifest before every change, writes
// an append-only audit log, supports reverting to any prior snapshot, and can
// process a queued repaint payload (optionally regenerating the underlay art
// via the existing Ganglia Studio script).
//
// Usage:
//   node scripts/manage-site-appearance.mjs <command> [flags]
//
// Commands:
//   show [--id=<stopId>]
//       Print the effective appearance for one site or the whole manifest.
//
//   set --id=<stopId> [--foreground-mode=sprite|background-only]
//       [--underlay=on|off] [--underlay-src=<path>] [--cache-key=<key>]
//       [--bump-cache-key] [--reason="..."] [--dry-run]
//       Update a site's appearance. Snapshots first, then audits.
//
//   remove-glyph --id=<stopId> [--reason="..."] [--dry-run]
//       Shortcut for set --foreground-mode=background-only (pillar 4).
//
//   revert [--to=<backup-file-name>] [--reason="..."] [--dry-run]
//       Restore the manifest from a backup (latest by default), then audit it.
//
//   list-backups
//       List available manifest snapshots, newest first.
//
//   list-audit [--limit=<n>] [--id=<stopId>]
//       Print the durable audit log, newest first.
//
//   process-queue --queue-file=<path> [--regen-art] [--bump-cache-key]
//       [--reason="..."] [--dry-run]
//       Consume a queued repaint payload (matching the /api/reposition shape),
//       snapshot, optionally regenerate underlay art per change, and update
//       the manifest cache keys so the new art busts the CDN cache.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const root = resolve(new URL("..", import.meta.url).pathname);
const MANIFEST_PATH = resolve(root, "data/town-site-appearance.v1.json");
const BACKUP_DIR = resolve(root, "data/backups/town-site-appearance");
const AUDIT_PATH = resolve(root, "data/town-site-appearance-audit.v1.json");
const AUDIT_VERSION = "town-site-appearance-audit-v1";

const VALID_FOREGROUND_MODES = new Set(["sprite", "background-only"]);

function parseArgs(argv) {
  const positionals = [];
  const flags = new Map();
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const [key, ...value] = arg.slice(2).split("=");
      flags.set(key, value.length > 0 ? value.join("=") : "true");
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

function nowIso() {
  return new Date().toISOString();
}

function backupStamp() {
  // 2026-05-28T21-15-03-123Z -> filesystem-safe, lexically sortable.
  return nowIso().replace(/[:.]/g, "-");
}

async function readManifest() {
  const raw = await readFile(MANIFEST_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeManifest(manifest) {
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function readAudit() {
  if (!existsSync(AUDIT_PATH)) {
    return { version: AUDIT_VERSION, events: [] };
  }
  const raw = await readFile(AUDIT_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.events)) {
    parsed.events = [];
  }
  return parsed;
}

async function appendAuditEvents(events) {
  const audit = await readAudit();
  audit.version = AUDIT_VERSION;
  audit.events.push(...events);
  await writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
}

async function snapshotManifest(label) {
  await mkdir(BACKUP_DIR, { recursive: true });
  const stamp = backupStamp();
  const safeLabel = label ? `.${label.replace(/[^a-z0-9_-]+/gi, "-")}` : "";
  const fileName = `town-site-appearance.${stamp}${safeLabel}.json`;
  const backupPath = resolve(BACKUP_DIR, fileName);
  const current = await readFile(MANIFEST_PATH, "utf8");
  await writeFile(backupPath, current);
  return { fileName, backupPath };
}

async function listBackupFiles() {
  if (!existsSync(BACKUP_DIR)) {
    return [];
  }
  const entries = await readdir(BACKUP_DIR);
  return entries
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse();
}

function effectiveAppearanceForSite(manifest, stopId) {
  const override = manifest.sites.find((entry) => entry.stopId === stopId);
  return {
    stopId,
    foregroundMode:
      override?.foregroundMode ?? manifest.defaults.foregroundMode,
    underlay: {
      ...manifest.defaults.underlay,
      ...(override?.underlay ?? {}),
    },
    hasOverride: Boolean(override),
  };
}

function upsertSite(manifest, stopId) {
  let site = manifest.sites.find((entry) => entry.stopId === stopId);
  if (!site) {
    site = { stopId };
    manifest.sites.push(site);
  }
  return site;
}

function bumpCacheKey(key) {
  if (!key) {
    return `auto-v1-${Date.now()}`;
  }
  const match = key.match(/^(.*?)(\d+)$/);
  if (!match) {
    return `${key}-v2`;
  }
  const next = String(Number.parseInt(match[2], 10) + 1);
  return `${match[1]}${next}`;
}

function requireFlag(flags, name) {
  const value = flags.get(name);
  if (!value || value === "true") {
    throw new Error(`Missing required flag --${name}`);
  }
  return value;
}

function logChange(label, before, after) {
  console.log(`  ${label}:`);
  console.log(`    before: ${JSON.stringify(before)}`);
  console.log(`    after:  ${JSON.stringify(after)}`);
}

async function cmdShow(flags) {
  const manifest = await readManifest();
  const id = flags.get("id");
  if (id && id !== "true") {
    console.log(
      JSON.stringify(effectiveAppearanceForSite(manifest, id), null, 2),
    );
    return;
  }
  console.log(JSON.stringify(manifest, null, 2));
}

async function cmdSet(flags, { reasonOverride } = {}) {
  const stopId = requireFlag(flags, "id");
  const dryRun = flags.get("dry-run") === "true";
  const reason =
    reasonOverride ??
    (flags.get("reason") && flags.get("reason") !== "true"
      ? flags.get("reason")
      : "Manual appearance update");

  const manifest = await readManifest();
  const before = effectiveAppearanceForSite(manifest, stopId);

  const foregroundMode = flags.get("foreground-mode");
  if (foregroundMode && foregroundMode !== "true") {
    if (!VALID_FOREGROUND_MODES.has(foregroundMode)) {
      throw new Error(
        `Invalid --foreground-mode "${foregroundMode}". Expected sprite|background-only.`,
      );
    }
  }

  const site = upsertSite(manifest, stopId);

  if (foregroundMode && foregroundMode !== "true") {
    site.foregroundMode = foregroundMode;
  }

  const underlayFlag = flags.get("underlay");
  const underlaySrc = flags.get("underlay-src");
  const cacheKey = flags.get("cache-key");
  const wantsBump = flags.get("bump-cache-key") === "true";

  const touchesUnderlay =
    (underlayFlag && underlayFlag !== "true") ||
    (underlaySrc && underlaySrc !== "true") ||
    (cacheKey && cacheKey !== "true") ||
    wantsBump;

  if (touchesUnderlay) {
    site.underlay = { ...(site.underlay ?? {}) };
    if (underlayFlag === "on") {
      site.underlay.enabled = true;
    } else if (underlayFlag === "off") {
      site.underlay.enabled = false;
    }
    if (underlaySrc && underlaySrc !== "true") {
      site.underlay.src = underlaySrc;
    }
    if (cacheKey && cacheKey !== "true") {
      site.underlay.cacheKey = cacheKey;
    } else if (wantsBump) {
      site.underlay.cacheKey = bumpCacheKey(site.underlay.cacheKey);
    }
  }

  const after = effectiveAppearanceForSite(manifest, stopId);

  console.log(`set ${stopId} (${dryRun ? "dry-run" : "writing"})`);
  logChange(stopId, before, after);

  if (dryRun) {
    return;
  }

  const snapshot = await snapshotManifest(`set-${stopId}`);
  await writeManifest(manifest);
  await appendAuditEvents([
    {
      id: crypto.randomUUID(),
      createdAt: nowIso(),
      action: "update_appearance",
      source: "manage-cli",
      reason,
      stopId,
      backup: snapshot.fileName,
      before,
      after,
    },
  ]);
  console.log(`  snapshot: ${snapshot.fileName}`);
}

async function cmdRemoveGlyph(flags) {
  flags.set("foreground-mode", "background-only");
  await cmdSet(flags, {
    reasonOverride:
      flags.get("reason") && flags.get("reason") !== "true"
        ? flags.get("reason")
        : "Remove glyph (background-only)",
  });
}

async function cmdRevert(flags) {
  const dryRun = flags.get("dry-run") === "true";
  const backups = await listBackupFiles();
  if (backups.length === 0) {
    throw new Error("No backups available to revert to.");
  }

  const requested = flags.get("to");
  const target =
    requested && requested !== "true"
      ? backups.find((name) => name === requested)
      : backups[0];

  if (!target) {
    throw new Error(
      `Backup "${requested}" not found. Run list-backups to see options.`,
    );
  }

  const reason =
    flags.get("reason") && flags.get("reason") !== "true"
      ? flags.get("reason")
      : `Revert to ${target}`;

  const targetPath = resolve(BACKUP_DIR, target);
  const restored = await readFile(targetPath, "utf8");
  const beforeManifest = await readManifest();

  console.log(`revert -> ${target} (${dryRun ? "dry-run" : "writing"})`);

  if (dryRun) {
    return;
  }

  // Snapshot the current state too, so revert is itself reversible.
  const snapshot = await snapshotManifest("pre-revert");
  await writeFile(MANIFEST_PATH, restored);
  await appendAuditEvents([
    {
      id: crypto.randomUUID(),
      createdAt: nowIso(),
      action: "revert_appearance",
      source: "manage-cli",
      reason,
      restoredFrom: target,
      backup: snapshot.fileName,
      before: { manifestVersion: beforeManifest.version },
      after: { restoredFrom: target },
    },
  ]);
  console.log(`  pre-revert snapshot: ${snapshot.fileName}`);
}

async function cmdListBackups() {
  const backups = await listBackupFiles();
  if (backups.length === 0) {
    console.log("No backups yet.");
    return;
  }
  for (const name of backups) {
    console.log(name);
  }
}

async function cmdListAudit(flags) {
  const audit = await readAudit();
  const id = flags.get("id");
  const limitRaw = Number.parseInt(flags.get("limit") ?? "50", 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(1000, limitRaw))
    : 50;

  let events = [...audit.events].reverse();
  if (id && id !== "true") {
    events = events.filter((event) => event.stopId === id);
  }
  events = events.slice(0, limit);

  if (events.length === 0) {
    console.log("No audit events.");
    return;
  }
  console.log(JSON.stringify(events, null, 2));
}

async function regenerateUnderlayArt(stopId) {
  const scriptPath = resolve(root, "scripts/apply-town-glyph-halo.mjs");
  console.log(
    `  regen art: node scripts/apply-town-glyph-halo.mjs --id=${stopId}`,
  );
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [scriptPath, `--id=${stopId}`],
    { cwd: root },
  );
  if (stdout.trim()) {
    console.log(stdout.trim());
  }
  if (stderr.trim()) {
    console.error(stderr.trim());
  }
}

async function cmdProcessQueue(flags) {
  const queueFile = requireFlag(flags, "queue-file");
  const dryRun = flags.get("dry-run") === "true";
  const regenArt = flags.get("regen-art") === "true";
  const wantsBump = flags.get("bump-cache-key") === "true" || regenArt;
  const reason =
    flags.get("reason") && flags.get("reason") !== "true"
      ? flags.get("reason")
      : "Process reposition repaint queue";

  const queuePath = resolve(root, queueFile);
  const raw = await readFile(queuePath, "utf8");
  const parsed = JSON.parse(raw);

  // Accept either the endpoint response shape ({ jobs: [...] }) or a bare
  // array of jobs, or a { queue: [...] } GET response.
  const jobs = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.jobs)
      ? parsed.jobs
      : Array.isArray(parsed.queue)
        ? parsed.queue
        : [];

  if (jobs.length === 0) {
    console.log("No jobs found in queue file.");
    return;
  }

  const manifest = await readManifest();
  const auditEvents = [];
  const processedStops = new Set();

  for (const job of jobs) {
    const change = job.payload ?? job;
    const stopId = change.stopId;
    if (!stopId || processedStops.has(stopId)) {
      continue;
    }
    processedStops.add(stopId);

    const before = effectiveAppearanceForSite(manifest, stopId);
    const site = upsertSite(manifest, stopId);
    site.underlay = { enabled: true, ...(site.underlay ?? {}) };
    if (!site.underlay.src) {
      site.underlay.src = `/art/town/glyph-halos/${stopId}.png`;
    }
    if (wantsBump) {
      site.underlay.cacheKey = bumpCacheKey(site.underlay.cacheKey);
    }
    const after = effectiveAppearanceForSite(manifest, stopId);

    console.log(
      `process ${stopId} [${job.action ?? "update_appearance"}] (${dryRun ? "dry-run" : "writing"})`,
    );
    logChange(stopId, before, after);

    auditEvents.push({
      id: crypto.randomUUID(),
      createdAt: nowIso(),
      action: job.action ?? "update_appearance",
      source: "manage-cli:process-queue",
      reason,
      stopId,
      jobId: job.id ?? null,
      before,
      after,
    });
  }

  if (dryRun) {
    console.log("dry-run: no files written, no art regenerated.");
    return;
  }

  const snapshot = await snapshotManifest("process-queue");
  await writeManifest(manifest);
  await appendAuditEvents(
    auditEvents.map((event) => ({ ...event, backup: snapshot.fileName })),
  );
  console.log(`  snapshot: ${snapshot.fileName}`);

  if (regenArt) {
    for (const stopId of processedStops) {
      try {
        await regenerateUnderlayArt(stopId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown art regen error";
        console.error(`  art regen failed for ${stopId}: ${message}`);
        throw new Error(`Art regeneration failed for ${stopId}: ${message}`);
      }
    }
  }
}

function printUsage() {
  console.log(
    [
      "Usage: node scripts/manage-site-appearance.mjs <command> [flags]",
      "",
      "Commands:",
      "  show [--id=<stopId>]",
      "  set --id=<stopId> [--foreground-mode=sprite|background-only]",
      "      [--underlay=on|off] [--underlay-src=<path>] [--cache-key=<key>]",
      "      [--bump-cache-key] [--reason=...] [--dry-run]",
      "  remove-glyph --id=<stopId> [--reason=...] [--dry-run]",
      "  revert [--to=<backup-file>] [--reason=...] [--dry-run]",
      "  list-backups",
      "  list-audit [--limit=<n>] [--id=<stopId>]",
      "  process-queue --queue-file=<path> [--regen-art] [--bump-cache-key]",
      "      [--reason=...] [--dry-run]",
    ].join("\n"),
  );
}

async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const command = positionals[0];

  switch (command) {
    case "show":
      await cmdShow(flags);
      break;
    case "set":
      await cmdSet(flags);
      break;
    case "remove-glyph":
      await cmdRemoveGlyph(flags);
      break;
    case "revert":
      await cmdRevert(flags);
      break;
    case "list-backups":
      await cmdListBackups();
      break;
    case "list-audit":
      await cmdListAudit(flags);
      break;
    case "process-queue":
      await cmdProcessQueue(flags);
      break;
    case undefined:
    case "help":
    case "--help":
      printUsage();
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      printUsage();
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

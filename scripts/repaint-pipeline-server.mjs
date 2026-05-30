#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { glyphHaloConfigForSprite } from "../lib/glyphHalo.ts";

const root = resolve(new URL("..", import.meta.url).pathname);
const stateDir = resolve(root, ".tmp/repaint-pipeline");
const stateFile = resolve(stateDir, "state.json");
const manageSiteAppearanceScript = resolve(
  root,
  "scripts/manage-site-appearance.mjs",
);
const applyTownGlyphHaloScript = resolve(
  root,
  "scripts/apply-town-glyph-halo.mjs",
);
const siteSpriteManifest = JSON.parse(
  await readFile(resolve(root, "data/town-site-sprites.v1.json"), "utf8"),
);
const siteSpriteByStop = new Map(
  siteSpriteManifest.sprites.map((sprite) => [sprite.stopId, sprite]),
);

function parseArgs(argv) {
  const flags = new Map();
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const [key, ...value] = arg.slice(2).split("=");
    flags.set(key, value.length > 0 ? value.join("=") : "true");
  }
  return flags;
}

const args = parseArgs(process.argv.slice(2));
const port = Number.parseInt(args.get("port") ?? "3741", 10);
const allowedOrigin = (args.get("origin") ?? "http://127.0.0.1:3740").replace(
  /\/$/,
  "",
);

if (!Number.isFinite(port) || port <= 0) {
  throw new Error("Invalid --port for repaint pipeline server.");
}

const defaultState = {
  version: 1,
  activeJob: null,
  acceptedPreviews: [],
};

let activeProcess = null;
let stateWriteChain = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

function corsHeaders(origin) {
  const responseOrigin = origin === allowedOrigin ? origin : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": responseOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

async function ensureStateDir() {
  await mkdir(stateDir, { recursive: true });
}

async function readState() {
  await ensureStateDir();
  if (!existsSync(stateFile)) {
    return structuredClone(defaultState);
  }

  const raw = await readFile(stateFile, "utf8");
  const parsed = JSON.parse(raw);
  return {
    ...structuredClone(defaultState),
    ...parsed,
    activeJob: parsed.activeJob ?? null,
    acceptedPreviews: Array.isArray(parsed.acceptedPreviews)
      ? parsed.acceptedPreviews
      : [],
  };
}

async function writeState(state) {
  await ensureStateDir();
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

async function withState(mutator) {
  const operation = stateWriteChain
    .catch(() => undefined)
    .then(async () => {
      const current = await readState();
      const draft = structuredClone(current);
      const next = (await mutator(draft)) ?? draft;
      await writeState(next);
      return next;
    });

  stateWriteChain = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
}

async function appendJobLog(jobId, stream, text) {
  if (!text.trim()) {
    return;
  }

  await withState((state) => {
    if (!state.activeJob || state.activeJob.id !== jobId) {
      return state;
    }

    const logs = Array.isArray(state.activeJob.logs)
      ? state.activeJob.logs
      : [];
    logs.push({
      at: nowIso(),
      stream,
      text,
    });
    state.activeJob.logs = logs.slice(-400);
    return state;
  });
}

function assetPathForStop(stopId) {
  return resolve(root, "public/art/town/glyph-halos", `${stopId}.png`);
}

function queueFilePathForJob(jobId) {
  return resolve(stateDir, `queue-${jobId}.json`);
}

function backupFilePathForJob(jobId, stopId) {
  return resolve(stateDir, `backup-${jobId}-${stopId}.png`);
}

function buildPreview(stopId, cacheBust = String(Date.now())) {
  return {
    stopId,
    path: `/preview/glyph-halos/${encodeURIComponent(stopId)}.png`,
    cacheBust,
    updatedAt: nowIso(),
  };
}

function liveRepaintSupportReason(stopId) {
  const sprite = siteSpriteByStop.get(stopId);
  if (!sprite) {
    return "This site does not have a sprite config for the repaint pipeline yet.";
  }

  if (!glyphHaloConfigForSprite(sprite)) {
    return "Live repaint is explicitly disabled for this site in sprite config.";
  }

  return "";
}

async function backupCurrentAsset(jobId, stopId) {
  const sourcePath = assetPathForStop(stopId);
  const backupPath = backupFilePathForJob(jobId, stopId);

  if (existsSync(sourcePath)) {
    await copyFile(sourcePath, backupPath);
    return {
      existed: true,
      path: backupPath,
    };
  }

  return {
    existed: false,
    path: backupPath,
  };
}

async function restoreAssetBackup(assetBackup, stopId) {
  const targetPath = assetPathForStop(stopId);

  if (
    assetBackup?.existed &&
    assetBackup.path &&
    existsSync(assetBackup.path)
  ) {
    await copyFile(assetBackup.path, targetPath);
    return;
  }

  await rm(targetPath, { force: true });
}

async function parseJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(req, res, statusCode, payload) {
  res.writeHead(statusCode, {
    ...corsHeaders(req.headers.origin),
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(payload));
}

function sendText(req, res, statusCode, text) {
  res.writeHead(statusCode, {
    ...corsHeaders(req.headers.origin),
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end(text);
}

function presentState(state) {
  return {
    available: state.activeJob === null,
    activeJob: state.activeJob,
    acceptedPreviews: state.acceptedPreviews,
  };
}

function validateChange(change) {
  if (typeof change !== "object" || change === null) {
    return false;
  }

  const value = change;
  if (typeof value.stopId !== "string" || value.stopId.trim().length === 0) {
    return false;
  }

  const pointIsValid = (point) => {
    return (
      typeof point === "object" &&
      point !== null &&
      typeof point.x === "number" &&
      Number.isFinite(point.x) &&
      typeof point.y === "number" &&
      Number.isFinite(point.y) &&
      typeof point.district === "string" &&
      point.district.length > 0
    );
  };

  return pointIsValid(value.from) && pointIsValid(value.to);
}

async function runLoggedNodeProcess(jobId, args) {
  await appendJobLog(jobId, "system", `$ node ${args.map(String).join(" ")}`);

  return new Promise((resolve) => {
    let snapshotBackup = null;
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: process.env,
    });
    activeProcess = child;

    const attachStream = (stream, source) => {
      stream.setEncoding("utf8");
      let buffer = "";
      stream.on("data", (chunk) => {
        buffer += chunk;
        const parts = buffer.split(/\r?\n/);
        buffer = parts.pop() ?? "";
        for (const line of parts) {
          if (!line.trim()) {
            continue;
          }
          const snapshotMatch = line.match(/snapshot:\s+([^\s]+)/);
          if (snapshotMatch) {
            snapshotBackup = snapshotMatch[1];
          }
          void appendJobLog(jobId, source, line);
        }
      });
      stream.on("end", () => {
        if (!buffer.trim()) {
          return;
        }
        const snapshotMatch = buffer.match(/snapshot:\s+([^\s]+)/);
        if (snapshotMatch) {
          snapshotBackup = snapshotMatch[1];
        }
        void appendJobLog(jobId, source, buffer);
      });
    };

    attachStream(child.stdout, "stdout");
    attachStream(child.stderr, "stderr");

    child.on("error", (error) => {
      void appendJobLog(jobId, "stderr", error.message);
    });

    child.on("close", (code, signal) => {
      activeProcess = null;
      resolve({
        code: typeof code === "number" ? code : 1,
        signal,
        snapshotBackup,
      });
    });
  });
}

async function startPipeline(change, displayName) {
  const currentState = await readState();
  if (currentState.activeJob) {
    throw new Error(
      `A repaint pipeline is already active for ${currentState.activeJob.stopId}.`,
    );
  }

  const jobId = crypto.randomUUID();
  const stopId = change.stopId;
  const assetBackup = await backupCurrentAsset(jobId, stopId);
  const label = displayName?.trim() || stopId;
  const queueFilePath = queueFilePathForJob(jobId);

  const nextState = await withState((state) => {
    state.activeJob = {
      id: jobId,
      stopId,
      displayName: label,
      status: "queued",
      createdAt: nowIso(),
      change,
      queueFilePath,
      manifestBackup: null,
      preview: null,
      assetBackup,
      logs: [
        {
          at: nowIso(),
          stream: "system",
          text: `Queued live repaint pipeline for ${label}.`,
        },
      ],
      error: null,
    };
    return state;
  });

  void runPipeline(jobId);
  return presentState(nextState);
}

async function runPipeline(jobId) {
  try {
    const state = await readState();
    const job = state.activeJob;
    if (!job || job.id !== jobId) {
      return;
    }

    await withState((draft) => {
      if (!draft.activeJob || draft.activeJob.id !== jobId) {
        return draft;
      }
      draft.activeJob.status = "running";
      draft.activeJob.startedAt = nowIso();
      draft.activeJob.error = null;
      return draft;
    });

    const result = await runLoggedNodeProcess(jobId, [
      applyTownGlyphHaloScript,
      `--id=${job.stopId}`,
    ]);

    if (result.code === 0) {
      await withState((draft) => {
        if (!draft.activeJob || draft.activeJob.id !== jobId) {
          return draft;
        }
        draft.activeJob.status = "awaiting_review";
        draft.activeJob.finishedAt = nowIso();
        draft.activeJob.manifestBackup =
          result.snapshotBackup ?? draft.activeJob.manifestBackup;
        draft.activeJob.preview = buildPreview(job.stopId);
        draft.activeJob.error = null;
        draft.activeJob.logs = [
          ...(draft.activeJob.logs ?? []),
          {
            at: nowIso(),
            stream: "system",
            text: `Candidate ready for ${job.displayName}. Accept locks the manifest change in. Reject restores the previous art backup.`,
          },
        ].slice(-400);
        return draft;
      });
      return;
    }

    await withState((draft) => {
      if (!draft.activeJob || draft.activeJob.id !== jobId) {
        return draft;
      }
      draft.activeJob.status = "failed";
      draft.activeJob.finishedAt = nowIso();
      draft.activeJob.manifestBackup =
        result.snapshotBackup ?? draft.activeJob.manifestBackup;
      draft.activeJob.preview = existsSync(assetPathForStop(job.stopId))
        ? buildPreview(job.stopId)
        : draft.activeJob.preview;
      draft.activeJob.error = `Pipeline exited with code ${result.code}.`;
      draft.activeJob.logs = [
        ...(draft.activeJob.logs ?? []),
        {
          at: nowIso(),
          stream: "system",
          text: `Pipeline failed for ${job.displayName}. Reject restores the previous files.`,
        },
      ].slice(-400);
      return draft;
    });
  } catch (error) {
    await withState((draft) => {
      if (!draft.activeJob || draft.activeJob.id !== jobId) {
        return draft;
      }
      draft.activeJob.status = "failed";
      draft.activeJob.finishedAt = nowIso();
      draft.activeJob.error =
        error instanceof Error ? error.message : "Unknown pipeline error";
      draft.activeJob.logs = [
        ...(draft.activeJob.logs ?? []),
        {
          at: nowIso(),
          stream: "stderr",
          text:
            error instanceof Error ? error.message : "Unknown pipeline error",
        },
      ].slice(-400);
      return draft;
    });
  }
}

async function acceptActiveJob() {
  const state = await readState();
  const job = state.activeJob;
  if (!job || job.status !== "awaiting_review") {
    throw new Error("No repaint candidate is waiting for review.");
  }

  await withState((draft) => {
    if (!draft.activeJob || draft.activeJob.id !== job.id) {
      return draft;
    }

    draft.activeJob.status = "running";
    draft.activeJob.logs = [
      ...(draft.activeJob.logs ?? []),
      {
        at: nowIso(),
        stream: "system",
        text: `Accept requested for ${job.displayName}. Locking the manifest change in...`,
      },
    ].slice(-400);
    return draft;
  });

  const result = await runLoggedNodeProcess(job.id, [
    manageSiteAppearanceScript,
    "set",
    `--id=${job.stopId}`,
    "--foreground-mode=background-only",
    "--underlay=on",
    `--underlay-src=/art/town/glyph-halos/${job.stopId}.png`,
    "--bump-cache-key",
    `--reason=Accept repaint preview for ${job.displayName}`,
  ]);

  if (result.code !== 0) {
    await withState((draft) => {
      if (!draft.activeJob || draft.activeJob.id !== job.id) {
        return draft;
      }
      draft.activeJob.status = "failed";
      draft.activeJob.manifestBackup =
        result.snapshotBackup ?? draft.activeJob.manifestBackup;
      draft.activeJob.error = `Accept exited with code ${result.code}.`;
      return draft;
    });
    throw new Error(`Accept exited with code ${result.code}.`);
  }

  const nextState = await withState((draft) => {
    const currentJob = draft.activeJob;
    if (!currentJob) {
      throw new Error("No repaint candidate is waiting for review.");
    }

    currentJob.manifestBackup =
      result.snapshotBackup ?? currentJob.manifestBackup;
    const preview = currentJob.preview ?? buildPreview(currentJob.stopId);
    draft.acceptedPreviews = [
      ...draft.acceptedPreviews.filter(
        (item) => item.stopId !== preview.stopId,
      ),
      preview,
    ];
    draft.activeJob = null;
    return draft;
  });

  return {
    ...presentState(nextState),
    acceptedJob: {
      id: job.id,
      stopId: job.stopId,
      displayName: job.displayName,
    },
  };
}

async function rejectActiveJob() {
  const state = await readState();
  const job = state.activeJob;
  if (!job || !["awaiting_review", "failed"].includes(job.status)) {
    throw new Error("No repaint candidate is available to reject.");
  }

  await withState((draft) => {
    if (!draft.activeJob || draft.activeJob.id !== job.id) {
      return draft;
    }
    draft.activeJob.status = "reverting";
    draft.activeJob.error = null;
    draft.activeJob.logs = [
      ...(draft.activeJob.logs ?? []),
      {
        at: nowIso(),
        stream: "system",
        text: `Reject requested for ${job.displayName}. Restoring backups...`,
      },
    ].slice(-400);
    return draft;
  });

  let revertError = null;
  if (job.manifestBackup) {
    const result = await runLoggedNodeProcess(job.id, [
      manageSiteAppearanceScript,
      "revert",
      `--to=${job.manifestBackup}`,
      `--reason=Reject repaint preview for ${job.displayName}`,
    ]);
    if (result.code !== 0) {
      revertError = `Manifest revert exited with code ${result.code}.`;
    }
  } else {
    await appendJobLog(
      job.id,
      "system",
      "No manifest backup recorded for this job; preview generation had not changed the manifest, so only the art backup needs restoring.",
    );
  }

  try {
    await restoreAssetBackup(job.assetBackup, job.stopId);
    await appendJobLog(
      job.id,
      "system",
      "Restored the backed-up underlay asset.",
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown asset restore error";
    revertError = revertError ? `${revertError} ${message}` : message;
  }

  if (revertError) {
    await withState((draft) => {
      if (!draft.activeJob || draft.activeJob.id !== job.id) {
        return draft;
      }
      draft.activeJob.status = "failed";
      draft.activeJob.error = revertError;
      draft.activeJob.logs = [
        ...(draft.activeJob.logs ?? []),
        {
          at: nowIso(),
          stream: "stderr",
          text: revertError,
        },
      ].slice(-400);
      return draft;
    });
    throw new Error(revertError);
  }

  const nextState = await withState((draft) => {
    draft.acceptedPreviews = draft.acceptedPreviews.filter(
      (item) => item.stopId !== job.stopId,
    );
    draft.activeJob = null;
    return draft;
  });

  return {
    ...presentState(nextState),
    rejectedJob: {
      id: job.id,
      stopId: job.stopId,
      displayName: job.displayName,
    },
  };
}

async function cancelActiveJob() {
  const state = await readState();
  const job = state.activeJob;
  if (!job || !["queued", "running"].includes(job.status)) {
    throw new Error("No running repaint preview is available to cancel.");
  }

  await appendJobLog(
    job.id,
    "system",
    `Cancel requested for ${job.displayName}. Stopping the live repaint preview...`,
  );

  if (activeProcess) {
    const child = activeProcess;
    await new Promise((resolve) => {
      child.once("close", resolve);
      child.kill("SIGTERM");
    });
    activeProcess = null;
  }

  let cancelError = null;
  if (job.manifestBackup) {
    const result = await runLoggedNodeProcess(job.id, [
      manageSiteAppearanceScript,
      "revert",
      `--to=${job.manifestBackup}`,
      `--reason=Cancel repaint preview for ${job.displayName}`,
    ]);
    if (result.code !== 0) {
      cancelError = `Manifest revert exited with code ${result.code}.`;
    }
  }

  try {
    await restoreAssetBackup(job.assetBackup, job.stopId);
    await appendJobLog(
      job.id,
      "system",
      "Restored the backed-up underlay asset.",
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown asset restore error";
    cancelError = cancelError ? `${cancelError} ${message}` : message;
  }

  if (cancelError) {
    await withState((draft) => {
      if (!draft.activeJob || draft.activeJob.id !== job.id) {
        return draft;
      }
      draft.activeJob.status = "failed";
      draft.activeJob.error = cancelError;
      return draft;
    });
    throw new Error(cancelError);
  }

  const nextState = await withState((draft) => {
    draft.acceptedPreviews = draft.acceptedPreviews.filter(
      (item) => item.stopId !== job.stopId,
    );
    draft.activeJob = null;
    return draft;
  });

  return {
    ...presentState(nextState),
    canceledJob: {
      id: job.id,
      stopId: job.stopId,
      displayName: job.displayName,
    },
  };
}

async function recoverInterruptedState() {
  const state = await readState();
  if (
    state.activeJob &&
    ["running", "reverting", "queued"].includes(state.activeJob.status)
  ) {
    await withState((draft) => {
      if (!draft.activeJob) {
        return draft;
      }
      draft.activeJob.status = "failed";
      draft.activeJob.finishedAt = nowIso();
      draft.activeJob.error =
        "The repaint runner restarted mid-job. Reject this candidate to restore backups.";
      draft.activeJob.logs = [
        ...(draft.activeJob.logs ?? []),
        {
          at: nowIso(),
          stream: "stderr",
          text: "Runner restarted before the prior job finished. Reject this candidate to restore backups.",
        },
      ].slice(-400);
      return draft;
    });
  }
}

function contentTypeForPath(path) {
  switch (extname(path).toLowerCase()) {
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req.headers.origin));
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(req, res, 200, { ok: true, port });
    return;
  }

  if (req.method === "GET" && url.pathname === "/status") {
    sendJson(req, res, 200, presentState(await readState()));
    return;
  }

  if (req.method === "POST" && url.pathname === "/queue") {
    try {
      const body = await parseJsonBody(req);
      const change = body.change;
      if (!validateChange(change)) {
        sendJson(req, res, 400, { error: "Invalid repaint change payload." });
        return;
      }

      const supportReason = liveRepaintSupportReason(change.stopId);
      if (supportReason) {
        sendJson(req, res, 400, { error: supportReason });
        return;
      }

      const nextState = await startPipeline(change, body.displayName);
      sendJson(req, res, 202, nextState);
      return;
    } catch (error) {
      sendJson(req, res, 409, {
        error:
          error instanceof Error
            ? error.message
            : "Unable to queue repaint pipeline.",
      });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/accept") {
    try {
      sendJson(req, res, 200, await acceptActiveJob());
      return;
    } catch (error) {
      sendJson(req, res, 409, {
        error:
          error instanceof Error
            ? error.message
            : "Unable to accept repaint candidate.",
      });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/reject") {
    try {
      sendJson(req, res, 200, await rejectActiveJob());
      return;
    } catch (error) {
      sendJson(req, res, 409, {
        error:
          error instanceof Error
            ? error.message
            : "Unable to reject repaint candidate.",
      });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/cancel") {
    try {
      sendJson(req, res, 200, await cancelActiveJob());
      return;
    } catch (error) {
      sendJson(req, res, 409, {
        error:
          error instanceof Error
            ? error.message
            : "Unable to cancel repaint preview.",
      });
      return;
    }
  }

  if (
    req.method === "GET" &&
    url.pathname.startsWith("/preview/glyph-halos/")
  ) {
    const stopId = decodeURIComponent(
      url.pathname.replace("/preview/glyph-halos/", "").replace(/\.png$/, ""),
    );
    const filePath = assetPathForStop(stopId);
    if (!existsSync(filePath)) {
      sendText(req, res, 404, "Preview not found.");
      return;
    }

    const buffer = await readFile(filePath);
    res.writeHead(200, {
      ...corsHeaders(req.headers.origin),
      "Content-Type": contentTypeForPath(filePath),
      "Cache-Control": "no-store",
    });
    res.end(buffer);
    return;
  }

  sendJson(req, res, 404, { error: "Not found" });
}

await recoverInterruptedState();

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    sendJson(req, res, 500, {
      error:
        error instanceof Error
          ? error.message
          : "Unexpected repaint server error.",
    });
  });
});

const shutdown = () => {
  if (activeProcess) {
    activeProcess.kill("SIGTERM");
  }
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(port, "127.0.0.1", () => {
  console.log(`Repaint pipeline server listening on http://127.0.0.1:${port}`);
});

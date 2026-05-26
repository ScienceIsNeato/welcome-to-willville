#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# perf_test.sh — Automated performance regression test for Willville
#
# Starts a local server, runs the official perf journey via Playwright,
# extracts the report, and fails if critical values regress beyond thresholds.
#
# Usage:
#   scripts/perf_test.sh                    # run against a fresh local build
#   scripts/perf_test.sh --url <url>        # run against an existing server
#   scripts/perf_test.sh --save-baseline    # save result as the new baseline
#   scripts/perf_test.sh --show             # print report without pass/fail
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BASELINE_FILE="$ROOT/.perf-baseline.json"
REPORT_FILE="/tmp/willville-perf-report.json"
MANAGED_SERVER=false
SAVE_BASELINE=false
SHOW_ONLY=false
SERVER_URL=""

# ── parse args ───────────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      SERVER_URL="$2"
      shift 2
      ;;
    --save-baseline)
      SAVE_BASELINE=true
      shift
      ;;
    --show)
      SHOW_ONLY=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# ── start server if needed ───────────────────────────────────────────────────

cleanup() {
  if $MANAGED_SERVER; then
    echo ""
    echo "Stopping test server..."
    "$SCRIPT_DIR/deploy_app.sh" --stop 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [[ -z "$SERVER_URL" ]]; then
  echo "=== Starting local server ==="
  DEPLOY_OUTPUT=$("$SCRIPT_DIR/deploy_app.sh" 2>&1)
  echo "$DEPLOY_OUTPUT" | tail -8
  SERVER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'http://127\.0\.0\.1:[0-9]+' | head -1)
  if [[ -z "$SERVER_URL" ]]; then
    echo "ERROR: Could not determine server URL from deploy output" >&2
    exit 1
  fi
  MANAGED_SERVER=true
fi

echo ""
echo "=== Running perf test against $SERVER_URL ==="
echo ""

# ── ensure Playwright is available ────────────────────────────────────────────

PERF_TOOLDIR="$ROOT/.perf-tools"
if [[ ! -d "$PERF_TOOLDIR/node_modules/playwright" ]]; then
  echo "Installing Playwright (one-time setup)..."
  mkdir -p "$PERF_TOOLDIR"
  echo '{"name":"perf-tools","private":true}' > "$PERF_TOOLDIR/package.json"
  (cd "$PERF_TOOLDIR" && npm install --silent playwright 2>&1 | tail -2)
  echo "Installing Chromium..."
  npx playwright install chromium 2>&1 | tail -1
  echo "Done."
  echo ""
fi

export NODE_PATH="$PERF_TOOLDIR/node_modules"

# ── run Playwright test ──────────────────────────────────────────────────────

rm -f "$REPORT_FILE"

SERVER_URL="$SERVER_URL" REPORT_FILE="$REPORT_FILE" node --input-type=module <<'PLAYWRIGHT_SCRIPT'
import { chromium } from "playwright";

const serverUrl = process.env.SERVER_URL;
const reportFile = process.env.REPORT_FILE;
const fs = await import("node:fs");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();

console.log("Navigating to", `${serverUrl}/?perf=1&autorun=1`);
await page.goto(`${serverUrl}/?perf=1&autorun=1`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
// Give React time to hydrate and the town to render
await page.waitForTimeout(3000);

// Wait for the autorun journey to start (the profiler sets running=true)
console.log("Waiting for perf journey to start...");
await page.waitForFunction(
  () => {
    const perf = /** @type {any} */ (window).__willvillePerf;
    return perf !== undefined;
  },
  undefined,
  { timeout: 30000 },
);

// Poll for the report to be ready (journey finishes and report is set)
console.log("Waiting for perf journey to complete...");
const report = await page.waitForFunction(
  () => {
    const perf = /** @type {any} */ (window).__willvillePerf;
    return perf?.getLastReport?.() ?? null;
  },
  undefined,
  { timeout: 180000, polling: 1000 },
);

const reportData = await report.jsonValue();
if (!reportData || !reportData.totalMs) {
  console.error("ERROR: Got empty or invalid report");
  await browser.close();
  process.exit(1);
}

console.log(`Journey completed in ${reportData.totalMs.toFixed(0)}ms`);
fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
console.log(`Report saved to ${reportFile}`);

await browser.close();
PLAYWRIGHT_SCRIPT

if [[ ! -f "$REPORT_FILE" ]]; then
  echo "ERROR: Playwright did not produce a report file" >&2
  exit 1
fi

# ── display report summary ───────────────────────────────────────────────────

echo ""
echo "=== Performance Report ==="

node --input-type=module <<SUMMARY_SCRIPT
import { readFileSync } from "node:fs";

const report = JSON.parse(readFileSync("$REPORT_FILE", "utf8"));
const fps = report.fps || {};
const mem = report.memory || {};

console.log("");
console.log("  Total time:      " + report.totalMs.toFixed(0) + "ms");
console.log("  Avg FPS:         " + (fps.avgFps || "n/a"));
console.log("  Min FPS:         " + (fps.minFps || "n/a"));
console.log("  Dropped frames:  " + (fps.droppedFrames ?? "n/a"));
console.log("  Long frames:     " + (fps.longFrames ?? "n/a"));
console.log("  Long tasks:      " + (report.longTasks?.length ?? 0));
if (mem.endHeap) {
  const mb = (n) => (n / 1024 / 1024).toFixed(1) + "MB";
  console.log("  Heap start:      " + mb(mem.startHeap));
  console.log("  Heap end:        " + mb(mem.endHeap));
  console.log("  Heap growth:     " + mb(mem.growthBytes) + " (" + mem.growthPct.toFixed(1) + "%)");
}
console.log("");
console.log("  Steps:");
for (const step of report.steps) {
  const fpsTag = step.fps ? " [" + step.fps.avgFps + "fps]" : "";
  console.log("    " + step.label.padEnd(30) + step.ms.toFixed(0).padStart(7) + "ms" + fpsTag);
}
console.log("");
SUMMARY_SCRIPT

# ── save baseline if requested ───────────────────────────────────────────────

if $SAVE_BASELINE; then
  cp "$REPORT_FILE" "$BASELINE_FILE"
  echo "Baseline saved to $BASELINE_FILE"
  echo ""
  exit 0
fi

if $SHOW_ONLY; then
  exit 0
fi

# ── compare against baseline ─────────────────────────────────────────────────

if [[ ! -f "$BASELINE_FILE" ]]; then
  echo "No baseline file found at $BASELINE_FILE"
  echo "Run with --save-baseline to create one."
  echo ""
  exit 0
fi

echo "=== Comparing against baseline ==="
echo ""

RESULT=$(REPORT_FILE="$REPORT_FILE" BASELINE_FILE="$BASELINE_FILE" node --input-type=module <<'COMPARE_SCRIPT'
import { readFileSync } from "node:fs";

const report = JSON.parse(readFileSync(process.env.REPORT_FILE, "utf8"));
const baseline = JSON.parse(readFileSync(process.env.BASELINE_FILE, "utf8"));

const failures = [];
const warnings = [];

function check(label, current, base, threshold, unit = "ms", lowerIsBetter = true) {
  if (base === undefined || base === null || base === 0) return;
  const delta = current - base;
  const pct = ((delta / base) * 100).toFixed(1);
  const sign = delta > 0 ? "+" : "";
  const tag = sign + delta.toFixed(1) + unit + " (" + sign + pct + "%)";

  const regressed = lowerIsBetter ? delta > threshold : delta < -threshold;
  const symbol = regressed ? "FAIL" : "ok";

  console.log("  " + symbol.padEnd(6) + label.padEnd(24) + tag);

  if (regressed) {
    failures.push(label + ": " + tag + " (threshold: " + threshold + unit + ")");
  }
}

function checkCount(label, current, base, maxIncrease) {
  if (base === undefined || base === null) return;
  const delta = current - base;
  const sign = delta > 0 ? "+" : "";
  const tag = sign + delta;

  const regressed = delta > maxIncrease;
  const symbol = regressed ? "FAIL" : "ok";

  console.log("  " + symbol.padEnd(6) + label.padEnd(24) + tag);

  if (regressed) {
    failures.push(label + ": " + tag + " (max increase: " + maxIncrease + ")");
  }
}

// Overall metrics — allow 25% regression on total time
const totalThreshold = Math.max(baseline.totalMs * 0.25, 500);
check("Total time", report.totalMs, baseline.totalMs, totalThreshold);

// FPS — higher is better
const baseFps = baseline.fps?.avgFps ?? 0;
const reportFps = report.fps?.avgFps ?? 0;
if (baseFps > 0) {
  const fpsDrop = baseFps - reportFps;
  const fpsPct = ((fpsDrop / baseFps) * 100).toFixed(1);
  const sign = fpsDrop > 0 ? "-" : "+";
  const tag = sign + Math.abs(fpsDrop).toFixed(0) + "fps (" + sign + Math.abs(fpsPct) + "%)";
  const regressed = fpsDrop > Math.max(baseFps * 0.2, 5);
  console.log("  " + (regressed ? "FAIL" : "ok").padEnd(6) + "Avg FPS".padEnd(24) + tag);
  if (regressed) {
    failures.push("Avg FPS: " + tag);
  }
}

// Counts
checkCount("Dropped frames", report.fps?.droppedFrames ?? 0, baseline.fps?.droppedFrames ?? 0, 5);
checkCount("Long frames", report.fps?.longFrames ?? 0, baseline.fps?.longFrames ?? 0, 10);
checkCount("Long tasks", report.longTasks?.length ?? 0, baseline.longTasks?.length ?? 0, 3);

// Memory — allow 20% heap growth over baseline
const baseHeap = baseline.memory?.endHeap ?? 0;
const reportHeap = report.memory?.endHeap ?? 0;
if (baseHeap > 0 && reportHeap > 0) {
  const heapThreshold = Math.max(baseHeap * 0.20, 5 * 1024 * 1024);
  check("Heap end", reportHeap, baseHeap, heapThreshold, "B");
}

// Per-step timing — allow 50% regression per step, min 200ms
const baseStepMap = new Map((baseline.steps || []).map(s => [s.id, s]));
console.log("");
console.log("  Per-step timing:");
for (const step of report.steps || []) {
  const base = baseStepMap.get(step.id);
  if (!base) continue;
  const stepThreshold = Math.max(base.ms * 0.50, 200);
  check("  " + step.label, step.ms, base.ms, stepThreshold);
}

console.log("");

if (failures.length > 0) {
  console.log("FAILED — " + failures.length + " regression(s) detected:");
  for (const f of failures) {
    console.log("  - " + f);
  }
  console.log("");
  process.stdout.write("__EXIT_1__");
} else {
  console.log("PASSED — no regressions detected");
  console.log("");
  process.stdout.write("__EXIT_0__");
}
COMPARE_SCRIPT
)

echo "$RESULT" | grep -v '__EXIT_'

if echo "$RESULT" | grep -q '__EXIT_1__'; then
  exit 1
fi

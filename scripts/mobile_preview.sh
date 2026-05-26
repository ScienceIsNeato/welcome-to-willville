#!/usr/bin/env bash
set -euo pipefail

# mobile_preview.sh — render Willville in phone-sized browser contexts
#
# Usage:
#   scripts/mobile_preview.sh
#   scripts/mobile_preview.sh --path /gates-of-hell/the-watchful-pumpkin/?perf=1
#   scripts/mobile_preview.sh --url http://127.0.0.1:3750 --path /town-square/willville-town-hall/
#   scripts/mobile_preview.sh --headed --device iphone-14 --path /?perf=1

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_URL=""
PATHNAME="/?perf=1"
OUTPUT_DIR="/tmp/willville-mobile-preview"
DEVICE="all"
HEADED=false
MANAGED_SERVER=false

usage() {
  sed -n '3,13p' "$0"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      SERVER_URL="$2"
      shift 2
      ;;
    --path)
      PATHNAME="$2"
      shift 2
      ;;
    --output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --device)
      DEVICE="$2"
      shift 2
      ;;
    --headed)
      HEADED=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cleanup() {
  if $MANAGED_SERVER; then
    echo ""
    echo "Stopping mobile preview server..."
    "$SCRIPT_DIR/deploy_app.sh" --stop 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [[ -z "$SERVER_URL" ]]; then
  echo "=== Starting local server ==="
  DEPLOY_LOG=$(mktemp /tmp/willville-mobile-deploy.XXXXXX.log)
  if ! "$SCRIPT_DIR/deploy_app.sh" 2>&1 | tee "$DEPLOY_LOG"; then
    echo "ERROR: deploy_app.sh failed. Full log: $DEPLOY_LOG" >&2
    exit 1
  fi
  SERVER_URL=$(grep -oE 'http://127\.0\.0\.1:[0-9]+' "$DEPLOY_LOG" | head -1)
  if [[ -z "$SERVER_URL" ]]; then
    echo "ERROR: Could not determine server URL from deploy output" >&2
    echo "Full log: $DEPLOY_LOG" >&2
    exit 1
  fi
  MANAGED_SERVER=true
fi

if [[ "$PATHNAME" != /* ]]; then
  PATHNAME="/$PATHNAME"
fi

TOOLDIR="$ROOT/.perf-tools"
if [[ ! -d "$TOOLDIR/node_modules/playwright" ]]; then
  echo "Installing Playwright (one-time setup)..."
  mkdir -p "$TOOLDIR"
  printf '{"name":"willville-preview-tools","private":true}\n' > "$TOOLDIR/package.json"
  (cd "$TOOLDIR" && npm install --silent playwright 2>&1 | tail -2)
  echo "Installing Chromium..."
  (cd "$TOOLDIR" && npx playwright install chromium 2>&1 | tail -1)
  echo "Done."
fi

mkdir -p "$OUTPUT_DIR"
export NODE_PATH="$TOOLDIR/node_modules"
export SERVER_URL PATHNAME OUTPUT_DIR DEVICE HEADED TOOLDIR

echo ""
echo "=== Rendering mobile previews ==="
echo "URL: $SERVER_URL$PATHNAME"
echo "Output: $OUTPUT_DIR"

node --input-type=module <<'PLAYWRIGHT_SCRIPT'
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";

const require = createRequire(`${process.env.TOOLDIR}/package.json`);
const { chromium } = require("playwright");
const serverUrl = process.env.SERVER_URL;
const pathname = process.env.PATHNAME;
const outputDir = process.env.OUTPUT_DIR;
const requestedDevice = process.env.DEVICE;
const headed = process.env.HEADED === "true";

const devices = [
  {
    id: "iphone-se",
    label: "iPhone SE",
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
  },
  {
    id: "iphone-14",
    label: "iPhone 14",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  },
  {
    id: "pixel-7",
    label: "Pixel 7",
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
  },
];

const selected =
  requestedDevice === "all"
    ? devices
    : devices.filter((device) => device.id === requestedDevice);

if (selected.length === 0) {
  console.error(
    `Unknown device "${requestedDevice}". Use one of: all, ${devices
      .map((device) => device.id)
      .join(", ")}`,
  );
  process.exit(1);
}

const browser = await chromium.launch({ headless: !headed });
const url = new URL(pathname, serverUrl).toString();
const indexRows = [];

for (const device of selected) {
  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);

  const fileName = `${device.id}.png`;
  const filePath = path.join(outputDir, fileName);
  await page.screenshot({ path: filePath, fullPage: false });

  const metrics = await page.evaluate(() => ({
    url: location.href,
    viewport: { width: innerWidth, height: innerHeight },
    body: {
      width: document.body.scrollWidth,
      height: document.body.scrollHeight,
    },
  }));
  indexRows.push({ ...device, fileName, metrics });

  if (headed) {
    console.log(`Opened ${device.label}: ${metrics.url}`);
    console.log("Close the browser window when you are done.");
    await page.waitForEvent("close", { timeout: 0 }).catch(() => {});
    await context.close().catch(() => {});
    break;
  }

  await context.close();
}

if (!headed) {
  await browser.close();
}

const html = `<!doctype html>
<meta charset="utf-8">
<title>Willville Mobile Preview</title>
<style>
  body { margin: 24px; font: 14px system-ui, sans-serif; background: #101820; color: #f3efe4; }
  main { display: grid; gap: 24px; }
  section { display: grid; gap: 8px; }
  img { width: min(100%, 430px); border: 1px solid #405064; background: #000; }
  code { color: #9fe0b4; }
</style>
<main>
  <h1>Willville Mobile Preview</h1>
  <p><code>${url}</code></p>
  ${indexRows
    .map(
      (row) => `<section>
        <h2>${row.label} (${row.viewport.width}x${row.viewport.height})</h2>
        <p>Viewport: <code>${row.metrics.viewport.width}x${row.metrics.viewport.height}</code>; body: <code>${row.metrics.body.width}x${row.metrics.body.height}</code></p>
        <img src="./${row.fileName}" alt="${row.label} mobile screenshot">
      </section>`,
    )
    .join("\n")}
</main>
`;
await fs.writeFile(path.join(outputDir, "index.html"), html);

console.log("");
console.log(`Mobile preview URL: ${url}`);
console.log(`Screenshots: ${outputDir}`);
console.log(`Open report: ${path.join(outputDir, "index.html")}`);
PLAYWRIGHT_SCRIPT

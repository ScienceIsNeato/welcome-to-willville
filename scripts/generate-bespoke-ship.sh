#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# generate-bespoke-ship.sh — Generate a custom canal ship via ganglia-studio
#
# Usage:
#   scripts/generate-bespoke-ship.sh <stop-id> "<description>"
#   scripts/generate-bespoke-ship.sh <stop-id> "<description>" --force
#   scripts/generate-bespoke-ship.sh --list
#
# The description should capture the visual identity of the repo/stop.
# The script wraps it in the Willville ship art style automatically.
#
# Set GANGLIA_STUDIO_DIR to the ganglia-studio checkout if it is not in a
# nearby sibling directory.
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$ROOT/output/bespoke-ships"
SHIP_DIR="$ROOT/public/art/stops"
MANIFEST="$ROOT/data/canal-ship-sprites.v1.json"
GANGLIA_STUDIO="${GANGLIA_STUDIO_DIR:-}"

FORCE=""

# ── parse args ───────────────────────────────────────────────────────────────

if [[ "${1:-}" == "--list" ]]; then
  echo "Bespoke ships in manifest:"
  node -e "
    const m = require('$MANIFEST');
    if (m.ships.length === 0) { console.log('  (none yet — all using default galleon)'); process.exit(0); }
    m.ships.forEach(s => console.log('  ' + s.stopId + ' -> ' + s.src));
  "
  exit 0
fi

if [[ -z "${1:-}" || -z "${2:-}" ]]; then
  echo "Usage: scripts/generate-bespoke-ship.sh <stop-id> \"<description>\" [--force]"
  echo "       scripts/generate-bespoke-ship.sh --list"
  echo ""
  echo "Example:"
  echo "  scripts/generate-bespoke-ship.sh the-reactor \"coffin-shaped black pirate ship with glowing purple claw marks and a skull figurehead\""
  exit 1
fi

STOP_ID="$1"
DESCRIPTION="$2"
shift 2
[[ "${1:-}" == "--force" ]] && FORCE="--force"

# ── find ganglia-studio ──────────────────────────────────────────────────────

if [[ -z "$GANGLIA_STUDIO" ]]; then
  for candidate in \
    "$ROOT/../ganglia-studio" \
    "$ROOT/../ganglia-core/ganglia-studio" \
    "$ROOT/../../ganglia-core/ganglia-studio"; do
    if [[ -d "$candidate/.git" ]] || [[ -d "$candidate/src" ]]; then
      GANGLIA_STUDIO="$candidate"
      break
    fi
  done
fi

if [[ -z "$GANGLIA_STUDIO" || ! -d "$GANGLIA_STUDIO" ]]; then
  echo "ERROR: ganglia-studio checkout not found." >&2
  echo "Set GANGLIA_STUDIO_DIR=/path/to/ganglia-studio and retry." >&2
  exit 1
fi

# ── generate TTI config ──────────────────────────────────────────────────────

mkdir -p "$OUTPUT_DIR"

STYLE="A single tall sailing ship seen from the SIDE (profile view, broadside), facing RIGHT. Board-game miniature piece style. Dense hand-painted diorama style, warm saturated colors, crisp tiny details, wobbly hand-inked outlines, painted wood texture. Transparent background (PNG alpha). No water, no waves, no background — just the ship on nothing. IMPORTANT: side-on profile view, not top-down."

CONFIG="$OUTPUT_DIR/$STOP_ID-ship.tti.json"
env \
  BESPOKE_OUTPUT_DIR="$OUTPUT_DIR" \
  BESPOKE_STOP_ID="$STOP_ID" \
  BESPOKE_STYLE="$STYLE" \
  BESPOKE_DESCRIPTION="$DESCRIPTION" \
  BESPOKE_CONFIG="$CONFIG" \
  node -e '
    const fs = require("fs");
    const {
      BESPOKE_OUTPUT_DIR,
      BESPOKE_STOP_ID,
      BESPOKE_STYLE,
      BESPOKE_DESCRIPTION,
      BESPOKE_CONFIG,
    } = process.env;
    const config = {
      style: "",
      backend: "dalle",
      model: "gpt-image-1",
      size: "1024x1024",
      quality: "high",
      output_dir: BESPOKE_OUTPUT_DIR,
      images: [{
        id: `${BESPOKE_STOP_ID}-ship`,
        prompt: `${BESPOKE_STYLE} ${BESPOKE_DESCRIPTION}`,
        raw_prompt: true,
      }],
    };
    fs.writeFileSync(BESPOKE_CONFIG, JSON.stringify(config, null, 2) + "\n");
    console.log(`Config written: ${BESPOKE_CONFIG}`);
  '

# ── generate image ───────────────────────────────────────────────────────────

echo "=== Generating bespoke ship: $STOP_ID ==="
echo ""

(
  cd "$GANGLIA_STUDIO"
  eval "$(direnv export bash 2>/dev/null)" || true
  source .venv/bin/activate 2>/dev/null || true
  python -m ganglia_studio.cli tti \
    --config "$CONFIG" \
    --output "$OUTPUT_DIR" \
    --id "$STOP_ID-ship" \
    $FORCE
)

RAW_IMAGE="$OUTPUT_DIR/$STOP_ID-ship.png"
if [[ ! -f "$RAW_IMAGE" ]]; then
  echo "ERROR: ganglia-studio did not produce $RAW_IMAGE" >&2
  exit 1
fi

echo ""
echo "Raw image: $RAW_IMAGE"

# ── process into ship sprite ─────────────────────────────────────────────────

FINAL_PNG="$SHIP_DIR/$STOP_ID-ship.png"

env RAW_IMAGE="$RAW_IMAGE" FINAL_PNG="$FINAL_PNG" node -e '
const sharp = require("sharp");

(async () => {
  const { RAW_IMAGE, FINAL_PNG } = process.env;
  const trimmed = await sharp(RAW_IMAGE)
    .trim()
    .toBuffer({ resolveWithObject: true });

  const longest = Math.max(trimmed.info.width, trimmed.info.height);
  const scale = 76 / longest;
  const w = Math.round(trimmed.info.width * scale);
  const h = Math.round(trimmed.info.height * scale);

  const resized = await sharp(trimmed.data)
    .resize(w, h, { fit: "inside" })
    .toBuffer();

  const left = Math.round((88 - w) / 2);
  const top = Math.round((100 - h) / 2);

  await sharp({
    create: {
      width: 88,
      height: 100,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(FINAL_PNG);

  console.log(`Ship sprite saved: ${FINAL_PNG} (${w}x${h} in 88x100)`);
})();
'

# ── update manifest ──────────────────────────────────────────────────────────

env MANIFEST="$MANIFEST" BESPOKE_STOP_ID="$STOP_ID" node -e '
const fs = require("fs");
const { MANIFEST, BESPOKE_STOP_ID } = process.env;
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const idx = manifest.ships.findIndex((ship) => ship.stopId === BESPOKE_STOP_ID);
const entry = {
  stopId: BESPOKE_STOP_ID,
  src: `/art/stops/${BESPOKE_STOP_ID}-ship.png`,
};

if (idx >= 0) {
  manifest.ships[idx] = entry;
  console.log(`Updated existing ship entry for ${BESPOKE_STOP_ID}`);
} else {
  manifest.ships.push(entry);
  console.log(`Added new ship entry for ${BESPOKE_STOP_ID}`);
}

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
'

echo ""
echo "=== Done ==="
echo "  Ship: $FINAL_PNG"
echo "  Manifest: $MANIFEST"
echo "  Rebuild to see it: scripts/deploy_app.sh"

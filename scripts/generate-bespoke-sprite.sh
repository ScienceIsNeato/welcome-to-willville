#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# generate-bespoke-sprite.sh — Generate a custom site sprite via ganglia-studio
#
# Usage:
#   scripts/generate-bespoke-sprite.sh <stop-id>
#   scripts/generate-bespoke-sprite.sh the-reactor
#   scripts/generate-bespoke-sprite.sh the-reactor --force
#   scripts/generate-bespoke-sprite.sh --list
#
# Set GANGLIA_STUDIO_DIR to the ganglia-studio checkout if it is not in a
# nearby sibling directory.
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BESPOKE_DIR="$ROOT/data/bespoke-sprites"
OUTPUT_DIR="$ROOT/output/bespoke-sprites"
SPRITE_DIR="$ROOT/public/art/stops"
GANGLIA_STUDIO="${GANGLIA_STUDIO_DIR:-}"

FORCE=""

# ── parse args ───────────────────────────────────────────────────────────────

if [[ "${1:-}" == "--list" ]]; then
  echo "Available bespoke sprite configs:"
  for f in "$BESPOKE_DIR"/*.tti.json; do
    [[ -f "$f" ]] || continue
    id=$(basename "$f" .tti.json)
    existing=""
    [[ -f "$SPRITE_DIR/$id.png" ]] && existing=" (exists)"
    echo "  $id$existing"
  done
  exit 0
fi

if [[ -z "${1:-}" ]]; then
  echo "Usage: scripts/generate-bespoke-sprite.sh <stop-id> [--force]"
  echo "       scripts/generate-bespoke-sprite.sh --list"
  exit 1
fi

STOP_ID="$1"
shift
[[ "${1:-}" == "--force" ]] && FORCE="--force"

CONFIG="$BESPOKE_DIR/$STOP_ID.tti.json"
if [[ ! -f "$CONFIG" ]]; then
  echo "ERROR: No config found at $CONFIG" >&2
  echo "Create one first, or run --list to see available configs." >&2
  exit 1
fi

if [[ -z "$GANGLIA_STUDIO" ]]; then
  for candidate in \
    "$ROOT/../ganglia-studio" \
    "$ROOT/../ganglia-core/ganglia-studio" \
    "$ROOT/../../ganglia-core/ganglia-studio"; do
    if [[ -d "$candidate/.git" ]]; then
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

# ── generate image via ganglia-studio ────────────────────────────────────────

echo "=== Generating bespoke sprite: $STOP_ID ==="
echo ""

mkdir -p "$OUTPUT_DIR"

(
  cd "$GANGLIA_STUDIO"
  eval "$(direnv export bash 2>/dev/null)" || true
  source .venv/bin/activate 2>/dev/null || true
  python -m ganglia_studio.cli tti \
    --config "$CONFIG" \
    --output "$OUTPUT_DIR" \
    --id "$STOP_ID" \
    $FORCE
)

RAW_IMAGE="$OUTPUT_DIR/$STOP_ID.png"
if [[ ! -f "$RAW_IMAGE" ]]; then
  echo "ERROR: ganglia-studio did not produce $RAW_IMAGE" >&2
  exit 1
fi

echo ""
echo "Raw image: $RAW_IMAGE ($(du -h "$RAW_IMAGE" | cut -f1))"

# ── process into sprite format ───────────────────────────────────────────────

echo "Processing into 100x100 sprite..."

FINAL_PNG="$SPRITE_DIR/$STOP_ID.png"

# Resize to 100x100, trim transparent edges, re-center, and ensure alpha
# Use sharp via node since it's already a project dep
node -e "
const sharp = require('sharp');
(async () => {
  // Load and trim to content bounds
  const trimmed = await sharp('$RAW_IMAGE')
    .trim()
    .toBuffer({ resolveWithObject: true });

  // Resize longest edge to 90px (leave 5px padding each side)
  const longest = Math.max(trimmed.info.width, trimmed.info.height);
  const scale = 90 / longest;
  const w = Math.round(trimmed.info.width * scale);
  const h = Math.round(trimmed.info.height * scale);

  const resized = await sharp(trimmed.data)
    .resize(w, h, { fit: 'inside' })
    .toBuffer();

  // Composite onto 100x100 transparent canvas, centered
  const left = Math.round((100 - w) / 2);
  const top = Math.round((100 - h) / 2);

  await sharp({
    create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile('$FINAL_PNG');

  console.log('Sprite saved: $FINAL_PNG (' + w + 'x' + h + ' content, 100x100 canvas)');
})();
"

# ── update manifest ──────────────────────────────────────────────────────────

MANIFEST="$ROOT/data/town-site-sprites.v1.json"
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('$MANIFEST', 'utf8'));
const idx = manifest.sprites.findIndex(s => s.stopId === '$STOP_ID');
const entry = {
  stopId: '$STOP_ID',
  district: 'gates-of-hell',
  kind: 'bespoke',
  src: '/art/stops/$STOP_ID.png',
  width: 100,
  height: 100,
  anchorX: 50,
  anchorY: 78,
};
if (idx >= 0) {
  manifest.sprites[idx] = entry;
  console.log('Updated existing manifest entry for $STOP_ID');
} else {
  manifest.sprites.push(entry);
  console.log('Added new manifest entry for $STOP_ID');
}
fs.writeFileSync('$MANIFEST', JSON.stringify(manifest, null, 2) + '\\n');
"

echo ""
echo "=== Done ==="
echo "  Sprite: $FINAL_PNG"
echo "  Manifest updated: $MANIFEST"
echo ""
echo "  Rebuild to see it: scripts/deploy_app.sh"

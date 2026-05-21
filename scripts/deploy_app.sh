#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# deploy_app.sh — Unified deploy for Willville
#
# Any agent, any worktree. Handles port allocation, stale cleanup, build, and
# wrangler startup automatically. Run from the repo root (or any worktree).
#
# Usage:
#   scripts/deploy_app.sh          # build + start wrangler
#   scripts/deploy_app.sh --stop   # tear down this worktree's deployment
#   scripts/deploy_app.sh --status # show all running deployments
# ─────────────────────────────────────────────────────────────────────────────

DEPLOY_DIR="/tmp/willville-deploys"
MAX_AGE_SECONDS=3600  # kill deployments older than 1 hour
PORT_RANGE_START=3740
PORT_RANGE_END=3800
MAIN_REPO_ROOT="/Users/pacey/Documents/SourceCode/welcome-to-willville"

mkdir -p "$DEPLOY_DIR"

# ── helpers ──────────────────────────────────────────────────────────────────

repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || pwd
}

# Stable short hash of the working directory (for lockfile naming)
dir_hash() {
  echo -n "$1" | shasum -a 256 | cut -c1-12
}

lockfile_for() {
  echo "$DEPLOY_DIR/$(dir_hash "$1").json"
}

is_pid_alive() {
  kill -0 "$1" 2>/dev/null
}

read_lockfile() {
  local f="$1"
  if [[ -f "$f" ]]; then
    cat "$f"
  else
    echo "{}"
  fi
}

jq_field() {
  # Lightweight JSON field extraction without requiring jq
  local json="$1" field="$2"
  echo "$json" | grep -o "\"$field\":[^,}]*" | head -1 | sed "s/\"$field\"://;s/\"//g;s/ //g"
}

# ── stale cleanup ────────────────────────────────────────────────────────────

cleanup_stale() {
  local now
  now=$(date +%s)
  for lockfile in "$DEPLOY_DIR"/*.json; do
    [[ -f "$lockfile" ]] || continue
    local data
    data=$(cat "$lockfile")
    local pid started_at
    pid=$(jq_field "$data" "pid")
    started_at=$(jq_field "$data" "startedAt")
    local dir
    dir=$(jq_field "$data" "dir")

    # Remove if PID is dead
    if [[ -n "$pid" ]] && ! is_pid_alive "$pid"; then
      echo "  Removing dead deployment: $dir (pid $pid)"
      rm -f "$lockfile"
      continue
    fi

    # Kill if older than MAX_AGE_SECONDS
    if [[ -n "$started_at" ]]; then
      local age=$(( now - started_at ))
      if (( age > MAX_AGE_SECONDS )); then
        echo "  Killing stale deployment: $dir (${age}s old, pid $pid)"
        kill "$pid" 2>/dev/null || true
        # Also kill any child wrangler/workerd/esbuild processes
        pkill -P "$pid" 2>/dev/null || true
        rm -f "$lockfile"
      fi
    fi
  done
}

# ── kill this worktree's deployment ──────────────────────────────────────────

stop_deployment() {
  local root="$1"
  local lockfile
  lockfile=$(lockfile_for "$root")
  if [[ ! -f "$lockfile" ]]; then
    echo "No active deployment for $root"
    return 0
  fi
  local data
  data=$(cat "$lockfile")
  local pid
  pid=$(jq_field "$data" "pid")
  local port
  port=$(jq_field "$data" "wranglerPort")
  if [[ -n "$pid" ]] && is_pid_alive "$pid"; then
    echo "Stopping deployment on :$port (pid $pid)"
    kill "$pid" 2>/dev/null || true
    pkill -P "$pid" 2>/dev/null || true
    # Belt and suspenders: kill anything on the port
    lsof -ti :"$port" 2>/dev/null | xargs kill 2>/dev/null || true
  fi
  rm -f "$lockfile"
  echo "Stopped."
}

# ── find free port pair ──────────────────────────────────────────────────────

find_free_port() {
  local port="$PORT_RANGE_START"
  # Collect all ports claimed by existing lockfiles
  local used_ports=""
  for lockfile in "$DEPLOY_DIR"/*.json; do
    [[ -f "$lockfile" ]] || continue
    local data
    data=$(cat "$lockfile")
    used_ports="$used_ports $(jq_field "$data" "wranglerPort")"
  done

  while (( port < PORT_RANGE_END )); do
    # Skip if claimed by a lockfile
    if echo "$used_ports" | grep -qw "$port"; then
      port=$(( port + 2 ))
      continue
    fi
    # Skip if something is listening
    if lsof -i :"$port" >/dev/null 2>&1; then
      port=$(( port + 2 ))
      continue
    fi
    echo "$port"
    return 0
  done
  echo "ERROR: No free ports in range $PORT_RANGE_START-$PORT_RANGE_END" >&2
  exit 1
}

# ── show status ──────────────────────────────────────────────────────────────

show_status() {
  local now
  now=$(date +%s)
  local found=0
  for lockfile in "$DEPLOY_DIR"/*.json; do
    [[ -f "$lockfile" ]] || continue
    local data
    data=$(cat "$lockfile")
    local pid dir port started_at branch
    pid=$(jq_field "$data" "pid")
    dir=$(jq_field "$data" "dir")
    port=$(jq_field "$data" "wranglerPort")
    started_at=$(jq_field "$data" "startedAt")
    branch=$(jq_field "$data" "branch")
    local alive="dead"
    is_pid_alive "$pid" && alive="running"
    local age="?"
    [[ -n "$started_at" ]] && age="$(( (now - started_at) / 60 ))m"
    echo "  :$port  $alive  ${age}  $branch  $dir"
    found=1
  done
  if (( found == 0 )); then
    echo "  No active deployments."
  fi
}

# ── main ─────────────────────────────────────────────────────────────────────

ROOT=$(repo_root)
BRANCH=$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

case "${1:-}" in
  --stop)
    stop_deployment "$ROOT"
    exit 0
    ;;
  --status)
    echo "Willville deployments:"
    cleanup_stale
    show_status
    exit 0
    ;;
esac

echo "=== Willville Deploy ==="
echo "Dir:    $ROOT"
echo "Branch: $BRANCH"
echo ""

# 1. Clean up stale deployments everywhere
echo "Cleaning stale deployments..."
cleanup_stale

# 2. Stop any existing deployment from THIS worktree
stop_deployment "$ROOT"

# 3. Copy .dev.vars if missing
if [[ ! -f "$ROOT/.dev.vars" ]] && [[ -f "$MAIN_REPO_ROOT/.dev.vars" ]]; then
  echo "Copying .dev.vars from main repo..."
  cp "$MAIN_REPO_ROOT/.dev.vars" "$ROOT/.dev.vars"
fi

# 4. Build static export
echo "Building..."
cd "$ROOT"
NODE_ENV=production node_modules/.bin/next build

# 5. Allocate port
WRANGLER_PORT=$(find_free_port)
echo ""
echo "Allocated port: $WRANGLER_PORT"

# 6. Start wrangler (serves static build + API functions, no next dev needed)
wrangler pages dev --port "$WRANGLER_PORT" --compatibility-date 2024-09-23 &
WRANGLER_PID=$!

# Wait for wrangler to be ready
echo "Starting wrangler (pid $WRANGLER_PID)..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w '' "http://127.0.0.1:$WRANGLER_PORT/" 2>/dev/null; then
    break
  fi
  sleep 1
done

# 7. Write lockfile
NOW=$(date +%s)
cat > "$(lockfile_for "$ROOT")" <<EOF
{"dir":"$ROOT","branch":"$BRANCH","wranglerPort":$WRANGLER_PORT,"pid":$WRANGLER_PID,"startedAt":$NOW}
EOF

echo ""
echo "════════════════════════════════════════"
echo "  Willville is live on:"
echo "  http://127.0.0.1:$WRANGLER_PORT/"
echo ""
echo "  Branch: $BRANCH"
echo "  PID:    $WRANGLER_PID"
echo "  Stop:   scripts/deploy_app.sh --stop"
echo "  Status: scripts/deploy_app.sh --status"
echo "════════════════════════════════════════"

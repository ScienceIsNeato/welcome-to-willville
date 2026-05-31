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
#   scripts/deploy_app.sh --lan    # build + start, accessible on local network
#   scripts/deploy_app.sh --mobile # build + start + open headed mobile preview
#   scripts/deploy_app.sh --stop   # tear down this worktree's deployment
#   scripts/deploy_app.sh --status # show all running deployments
# ─────────────────────────────────────────────────────────────────────────────

DEPLOY_DIR="/tmp/willville-deploys"
MAX_AGE_SECONDS=3600  # kill deployments older than 1 hour
PORT_RANGE_START=3740
PORT_RANGE_END=3800

mkdir -p "$DEPLOY_DIR"

usage() {
  cat <<'EOF'
Usage:
  scripts/deploy_app.sh
  scripts/deploy_app.sh --lan
  scripts/deploy_app.sh --mobile [mobile preview args]
  scripts/deploy_app.sh --stop
  scripts/deploy_app.sh --status

Examples:
  scripts/deploy_app.sh --lan
  scripts/deploy_app.sh --mobile
  scripts/deploy_app.sh --mobile --device iphone-14 --path /town-square/willville-town-hall/
EOF
}

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

logfile_for() {
  echo "$DEPLOY_DIR/$(dir_hash "$1").log"
}

repaint_logfile_for() {
  echo "$DEPLOY_DIR/$(dir_hash "$1").repaint.log"
}

screen_session_for() {
  echo "willville-$(dir_hash "$1")"
}

repaint_screen_session_for() {
  echo "willville-rp-$(dir_hash "$1")"
}

is_pid_alive() {
  [[ "$1" =~ ^[1-9][0-9]*$ ]] && kill -0 "$1" 2>/dev/null
}

is_screen_alive() {
  local session="$1"
  [[ -n "$session" ]] && screen -ls 2>/dev/null | grep -q "[.]$session[[:space:]]"
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
  # Only strips leading/trailing whitespace, not spaces inside values
  local json="$1" field="$2"
  echo "$json" | grep -o "\"$field\":[^,}]*" | head -1 | sed "s/\"$field\"://;s/^[[:space:]]*\"//;s/\"[[:space:]]*$//" || true
}

has_arg() {
  local needle="$1"
  local arg
  for arg in "${@:2}"; do
    if [[ "$arg" == "$needle" ]]; then
      return 0
    fi
  done
  return 1
}

find_lan_ip() {
  local ip

  for iface in en0 en1; do
    ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
    if [[ -n "$ip" ]]; then
      echo "$ip"
      return 0
    fi
  done

  ip=$(ifconfig 2>/dev/null | awk '/inet / { print $2 }' | grep -E '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)' | head -1 || true)
  if [[ -n "$ip" ]]; then
    echo "$ip"
    return 0
  fi

  return 1
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
    local session
    session=$(jq_field "$data" "screenSession")
    local repaint_pid
    repaint_pid=$(jq_field "$data" "repaintPid")
    local repaint_session
    repaint_session=$(jq_field "$data" "repaintScreenSession")

    # Remove if PID is dead and no live screen session owns the deployment.
    local wrangler_alive=false
    local repaint_alive=false
    if [[ -n "$session" ]] && is_screen_alive "$session"; then
      wrangler_alive=true
    elif [[ -n "$pid" ]] && is_pid_alive "$pid"; then
      wrangler_alive=true
    fi
    if [[ -n "$repaint_session" ]] && is_screen_alive "$repaint_session"; then
      repaint_alive=true
    elif [[ -n "$repaint_pid" ]] && is_pid_alive "$repaint_pid"; then
      repaint_alive=true
    fi

    if $wrangler_alive || $repaint_alive; then
      :
    else
      echo "  Removing dead deployment: $dir (pid ${pid:-none})"
      rm -f "$lockfile"
      continue
    fi

    # Kill if older than MAX_AGE_SECONDS
    if [[ -n "$started_at" ]]; then
      local age=$(( now - started_at ))
      if (( age > MAX_AGE_SECONDS )); then
        echo "  Killing stale deployment: $dir (${age}s old, pid $pid)"
        if [[ -n "$session" ]] && is_screen_alive "$session"; then
          screen -S "$session" -X quit 2>/dev/null || true
        elif is_pid_alive "$pid"; then
          kill "$pid" 2>/dev/null || true
          pkill -P "$pid" 2>/dev/null || true
        fi
        if [[ -n "$repaint_session" ]] && is_screen_alive "$repaint_session"; then
          screen -S "$repaint_session" -X quit 2>/dev/null || true
        elif [[ -n "$repaint_pid" ]] && is_pid_alive "$repaint_pid"; then
          kill "$repaint_pid" 2>/dev/null || true
          pkill -P "$repaint_pid" 2>/dev/null || true
        fi
        rm -f "$lockfile"
      fi
    fi
  done
}

# ── kill orphan node/workerd processes ────────────────────────────────────────

process_signature_for_pid() {
  local pid="$1"
  ps -p "$pid" -o comm= -o args= 2>/dev/null | sed 's/^[[:space:]]*//'
}

is_willville_deploy_pid() {
  local current="$1"
  local depth=0

  while [[ -n "$current" && "$current" != "0" && $depth -lt 8 ]]; do
    local signature
    signature=$(process_signature_for_pid "$current")
    if [[ -z "$signature" ]]; then
      return 1
    fi

    if [[ "$signature" == *"wrangler pages dev ./out"* ]]; then
      return 0
    fi

    if [[ "$signature" == *"scripts/repaint-pipeline-server.mjs"* ]]; then
      return 0
    fi

    if [[ "$signature" == *"SCREEN"* && "$signature" == *"willville-"* ]]; then
      return 0
    fi

    current=$(ps -p "$current" -o ppid= 2>/dev/null | tr -d ' ')
    depth=$(( depth + 1 ))
  done

  return 1
}

cleanup_orphans() {
  # Collect ports claimed by live lockfiles
  local claimed_ports=""
  for lockfile in "$DEPLOY_DIR"/*.json; do
    [[ -f "$lockfile" ]] || continue
    local data
    data=$(cat "$lockfile")
    claimed_ports="$claimed_ports $(jq_field "$data" "wranglerPort") $(jq_field "$data" "repaintPort")"
  done

  # Find node/workerd listeners in our port range that aren't claimed
  local orphan_pids=""
  for port in $(seq "$PORT_RANGE_START" "$PORT_RANGE_END"); do
    if echo "$claimed_ports" | grep -qw "$port"; then
      continue
    fi
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    for pid in $pids; do
      if is_willville_deploy_pid "$pid"; then
        orphan_pids="$orphan_pids $pid"
      fi
    done
  done

  if [[ -n "${orphan_pids// /}" ]]; then
    echo "  Killing orphan Willville deploy processes on unclaimed ports..."
    for pid in $(echo "$orphan_pids" | tr ' ' '\n' | sort -u); do
      [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
    done
    sleep 1
    for pid in $(echo "$orphan_pids" | tr ' ' '\n' | sort -u); do
      [[ -n "$pid" ]] && kill -9 "$pid" 2>/dev/null || true
    done
  fi

  # Also clean up any dead willville screen sessions
  local stale_screens
  stale_screens=$(screen -ls 2>/dev/null | grep -o '[0-9]*\.willville-\(rp-\)\?[a-f0-9]*' || true)
  for sess in $stale_screens; do
    local sess_name="${sess#*.}"
    local found=false
    for lockfile in "$DEPLOY_DIR"/*.json; do
      [[ -f "$lockfile" ]] || continue
      local data
      data=$(cat "$lockfile")
      if [[ "$(jq_field "$data" "screenSession")" == "$sess_name" || "$(jq_field "$data" "repaintScreenSession")" == "$sess_name" ]]; then
        found=true
        break
      fi
    done
    if ! $found; then
      echo "  Killing orphan screen: $sess_name"
      screen -S "$sess_name" -X quit 2>/dev/null || true
    fi
  done
}

# ── kill this worktree's deployment ──────────────────────────────────────────

stop_deployment() {
  local root="$1"
  local lockfile
  lockfile=$(lockfile_for "$root")
  local fallback_session
  fallback_session=$(screen_session_for "$root")
  local fallback_repaint_session
  fallback_repaint_session=$(repaint_screen_session_for "$root")
  if [[ ! -f "$lockfile" ]]; then
    if is_screen_alive "$fallback_session"; then
      echo "Stopping deployment screen $fallback_session"
      screen -S "$fallback_session" -X quit 2>/dev/null || true
      sleep 1
    fi
    if is_screen_alive "$fallback_repaint_session"; then
      echo "Stopping repaint sidecar screen $fallback_repaint_session"
      screen -S "$fallback_repaint_session" -X quit 2>/dev/null || true
      sleep 1
    fi
    echo "No active deployment for $root"
    return 0
  fi
  local data
  data=$(cat "$lockfile")
  local pid
  pid=$(jq_field "$data" "pid")
  local session
  session=$(jq_field "$data" "screenSession")
  local port
  port=$(jq_field "$data" "wranglerPort")
  local repaint_pid
  repaint_pid=$(jq_field "$data" "repaintPid")
  local repaint_session
  repaint_session=$(jq_field "$data" "repaintScreenSession")
  local repaint_port
  repaint_port=$(jq_field "$data" "repaintPort")
  if [[ -n "$session" ]] && is_screen_alive "$session"; then
    echo "Stopping deployment on :$port (screen $session)"
    screen -S "$session" -X quit 2>/dev/null || true
  fi
  if [[ -n "$pid" ]] && is_pid_alive "$pid"; then
    echo "Stopping deployment on :$port (pid $pid)"
    kill "$pid" 2>/dev/null || true
    pkill -P "$pid" 2>/dev/null || true
    # Belt and suspenders: kill anything on the port
    lsof -ti :"$port" 2>/dev/null | xargs kill 2>/dev/null || true
  fi
  if [[ -n "$repaint_session" ]] && is_screen_alive "$repaint_session"; then
    echo "Stopping repaint sidecar on :$repaint_port (screen $repaint_session)"
    screen -S "$repaint_session" -X quit 2>/dev/null || true
  fi
  if [[ -n "$repaint_pid" ]] && is_pid_alive "$repaint_pid"; then
    echo "Stopping repaint sidecar on :$repaint_port (pid $repaint_pid)"
    kill "$repaint_pid" 2>/dev/null || true
    pkill -P "$repaint_pid" 2>/dev/null || true
    lsof -ti :"$repaint_port" 2>/dev/null | xargs kill 2>/dev/null || true
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
    used_ports="$used_ports $(jq_field "$data" "wranglerPort") $(jq_field "$data" "repaintPort")"
  done

  while (( port < PORT_RANGE_END )); do
    local companion_port=$(( port + 1 ))
    # Skip if claimed by a lockfile
    if echo "$used_ports" | grep -qw "$port" || echo "$used_ports" | grep -qw "$companion_port"; then
      port=$(( port + 2 ))
      continue
    fi
    # Skip if something is listening
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      port=$(( port + 2 ))
      continue
    fi
    if lsof -nP -iTCP:"$companion_port" -sTCP:LISTEN >/dev/null 2>&1; then
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
    local session
    session=$(jq_field "$data" "screenSession")
    local alive="dead"
    if is_pid_alive "$pid" || is_screen_alive "$session"; then
      alive="running"
    fi
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

ACTION="deploy"
MOBILE_MODE=false
LAN_MODE=false
MOBILE_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stop)
      ACTION="stop"
      shift
      ;;
    --status)
      ACTION="status"
      shift
      ;;
    --mobile)
      MOBILE_MODE=true
      shift
      MOBILE_ARGS=("$@")
      break
      ;;
    --lan)
      LAN_MODE=true
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

if $MOBILE_MODE && [[ "$ACTION" != "deploy" ]]; then
  echo "ERROR: --mobile cannot be combined with --$ACTION" >&2
  usage >&2
  exit 1
fi

if $LAN_MODE && [[ "$ACTION" != "deploy" ]]; then
  echo "ERROR: --lan cannot be combined with --$ACTION" >&2
  usage >&2
  exit 1
fi

ROOT=$(repo_root)
BRANCH=$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

case "$ACTION" in
  stop)
    stop_deployment "$ROOT"
    cleanup_orphans
    exit 0
    ;;
  status)
    echo "Willville deployments:"
    cleanup_stale
    cleanup_orphans
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
cleanup_orphans

# 2. Stop any existing deployment from THIS worktree
stop_deployment "$ROOT"

# 3. Copy .dev.vars if missing
if [[ ! -f "$ROOT/.dev.vars" ]]; then
  # Look for .dev.vars in the git repo root of the main worktree
  MAIN_ROOT=$(git worktree list --porcelain | grep -m1 'worktree' | awk '{print $2}')
  if [[ -n "$MAIN_ROOT" ]] && [[ -f "$MAIN_ROOT/.dev.vars" ]]; then
    echo "Copying .dev.vars from main worktree..."
    cp "$MAIN_ROOT/.dev.vars" "$ROOT/.dev.vars"
  fi
fi

# 4. Build static export
echo "Building..."
cd "$ROOT"
NODE_ENV=production node_modules/.bin/next build

# 5. Allocate port
WRANGLER_PORT=$(find_free_port)
REPAINT_PORT=$(( WRANGLER_PORT + 1 ))

WRANGLER_BIND_IP="127.0.0.1"
REPAINT_BIND_IP="127.0.0.1"
PUBLIC_IP="127.0.0.1"
if $LAN_MODE; then
  WRANGLER_BIND_IP="0.0.0.0"
  REPAINT_BIND_IP="0.0.0.0"
  PUBLIC_IP=$(find_lan_ip || true)
  if [[ -z "$PUBLIC_IP" ]]; then
    echo "ERROR: Could not determine a LAN IP. Connect to Wi-Fi/Ethernet and retry." >&2
    exit 1
  fi
fi

LOCAL_ORIGIN="http://127.0.0.1:$WRANGLER_PORT"
PUBLIC_ORIGIN="http://$PUBLIC_IP:$WRANGLER_PORT"

echo ""
echo "Allocated port: $WRANGLER_PORT"
if $LAN_MODE; then
  echo "LAN IP: $PUBLIC_IP"
fi

# 6. Start wrangler (serves static build + API functions, no next dev needed)
WRANGLER_LOG=$(logfile_for "$ROOT")
SCREEN_SESSION=$(screen_session_for "$ROOT")
REPAINT_LOG=$(repaint_logfile_for "$ROOT")
REPAINT_SCREEN_SESSION=$(repaint_screen_session_for "$ROOT")
rm -f "$WRANGLER_LOG"
rm -f "$REPAINT_LOG"
screen -S "$SCREEN_SESSION" -X quit 2>/dev/null || true
screen -S "$REPAINT_SCREEN_SESSION" -X quit 2>/dev/null || true
screen -dmS "$SCREEN_SESSION" bash -lc '
  exec > "$2" 2>&1
  cd "$1"
  exec wrangler pages dev ./out \
    --ip "$4" \
    --port "$3" \
    --compatibility-date 2026-05-01 \
    --show-interactive-dev-session=false
' _ "$ROOT" "$WRANGLER_LOG" "$WRANGLER_PORT" "$WRANGLER_BIND_IP"
WRANGLER_PID=$(pgrep -f "SCREEN.*${SCREEN_SESSION}" | head -1 || true)
if [[ -z "$WRANGLER_PID" ]]; then
  WRANGLER_PID=0
fi

screen -dmS "$REPAINT_SCREEN_SESSION" bash -lc '
  exec > "$2" 2>&1
  cd "$1"
  exec node scripts/repaint-pipeline-server.mjs \
    --port="$3" \
    --host="$4" \
    --origin="$5"
' _ "$ROOT" "$REPAINT_LOG" "$REPAINT_PORT" "$REPAINT_BIND_IP" "$LOCAL_ORIGIN,$PUBLIC_ORIGIN"
REPAINT_PID=$(pgrep -f "SCREEN.*${REPAINT_SCREEN_SESSION}" | head -1 || true)
if [[ -z "$REPAINT_PID" ]]; then
  REPAINT_PID=0
fi

# Wait for wrangler to be ready
echo "Starting wrangler (screen $SCREEN_SESSION, pid $WRANGLER_PID)..."
READY=0
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w '' "http://127.0.0.1:$WRANGLER_PORT/" 2>/dev/null; then
    READY=1
    break
  fi
  sleep 1
done
if [[ "$READY" != "1" ]]; then
  echo "ERROR: wrangler did not become ready. Log:"
  sed -n '1,160p' "$WRANGLER_LOG" 2>/dev/null || true
  exit 1
fi

echo "Starting repaint sidecar (screen $REPAINT_SCREEN_SESSION, pid $REPAINT_PID)..."
REPAINT_READY=0
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w '' "http://127.0.0.1:$REPAINT_PORT/health" 2>/dev/null; then
    REPAINT_READY=1
    break
  fi
  sleep 1
done
if [[ "$REPAINT_READY" != "1" ]]; then
  echo "ERROR: repaint sidecar did not become ready. Log:"
  sed -n '1,160p' "$REPAINT_LOG" 2>/dev/null || true
  exit 1
fi

# 7. Write lockfile
NOW=$(date +%s)
ROOT="$ROOT" BRANCH="$BRANCH" PORT="$WRANGLER_PORT" PID="$WRANGLER_PID" NOW="$NOW" LOG="$WRANGLER_LOG" SCREEN_SESSION="$SCREEN_SESSION" REPAINT_PORT="$REPAINT_PORT" REPAINT_PID="$REPAINT_PID" REPAINT_LOG="$REPAINT_LOG" REPAINT_SCREEN_SESSION="$REPAINT_SCREEN_SESSION" \
  node -e "
    const o = {
      dir: process.env.ROOT,
      branch: process.env.BRANCH,
      wranglerPort: Number(process.env.PORT),
      pid: Number(process.env.PID),
      repaintPort: Number(process.env.REPAINT_PORT),
      repaintPid: Number(process.env.REPAINT_PID),
      startedAt: Number(process.env.NOW),
      log: process.env.LOG,
      screenSession: process.env.SCREEN_SESSION,
      repaintLog: process.env.REPAINT_LOG,
      repaintScreenSession: process.env.REPAINT_SCREEN_SESSION,
    };
    process.stdout.write(JSON.stringify(o) + '\\n');
  " > "$(lockfile_for "$ROOT")"

echo ""
echo "════════════════════════════════════════"
echo "  Willville is live on:"
echo "  http://127.0.0.1:$WRANGLER_PORT/"
if $LAN_MODE; then
  echo "  http://$PUBLIC_IP:$WRANGLER_PORT/"
fi
echo ""
echo "  Branch: $BRANCH"
echo "  PID:    $WRANGLER_PID"
echo "  Log:    $WRANGLER_LOG"
echo "  Repaint Runner: http://127.0.0.1:$REPAINT_PORT"
echo "  Repaint Log:    $REPAINT_LOG"
echo "  Stop:   scripts/deploy_app.sh --stop"
echo "  Status: scripts/deploy_app.sh --status"
echo "════════════════════════════════════════"

if $MOBILE_MODE; then
  MOBILE_DEFAULT_ARGS=()
  if ! has_arg "--path" ${MOBILE_ARGS[@]+"${MOBILE_ARGS[@]}"}; then
    MOBILE_DEFAULT_ARGS+=(--path /)
  fi
  if ! has_arg "--device" ${MOBILE_ARGS[@]+"${MOBILE_ARGS[@]}"}; then
    MOBILE_DEFAULT_ARGS+=(--device iphone-14)
  fi

  echo ""
  echo "Launching interactive mobile preview..."
  "$ROOT/scripts/mobile_preview.sh" \
    --url "http://127.0.0.1:$WRANGLER_PORT" \
    --headed \
    ${MOBILE_DEFAULT_ARGS[@]+"${MOBILE_DEFAULT_ARGS[@]}"} \
    ${MOBILE_ARGS[@]+"${MOBILE_ARGS[@]}"}
fi

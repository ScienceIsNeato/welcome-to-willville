#!/usr/bin/env bash

# Block commits when STATUS.md is materially newer than .willville.json.
# Rule: if .willville.json is older than STATUS.md by more than 1 hour,
# fail and tell the agent to update via the willville skill.

set -euo pipefail

STATUS_FILE="STATUS.md"
WILLVILLE_FILE=".willville.json"
MAX_AGE_SECONDS=3600

file_mtime() {
  local file_path="$1"

  # macOS / BSD stat
  if stat -f %m "$file_path" >/dev/null 2>&1; then
    stat -f %m "$file_path"
    return
  fi

  # GNU stat
  stat -c %Y "$file_path"
}

if [[ ! -f "$STATUS_FILE" || ! -f "$WILLVILLE_FILE" ]]; then
  exit 0
fi

status_mtime=$(file_mtime "$STATUS_FILE")
willville_mtime=$(file_mtime "$WILLVILLE_FILE")

if (( willville_mtime < status_mtime )); then
  delta_seconds=$((status_mtime - willville_mtime))
  if (( delta_seconds > MAX_AGE_SECONDS )); then
    delta_minutes=$(((delta_seconds + 59) / 60))
    echo ""
    echo "  Commit blocked: .willville.json is stale."
    echo ""
    echo "  STATUS.md is newer by about ${delta_minutes} minute(s),"
    echo "  which is more than the 60-minute freshness window."
    echo ""
    echo "  Use the willville skill before committing so .willville.json"
    echo "  reflects current status and direction."
    echo ""
    echo "  Then stage .willville.json and commit again."
    echo ""
    exit 1
  fi
fi

exit 0
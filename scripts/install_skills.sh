#!/usr/bin/env bash
set -euo pipefail

REPO_SKILLS_DIR="$(cd "$(dirname "$0")/../.github/skills" && pwd)"
TARGET_DIR="$HOME/.claude/skills"

usage() {
  echo "Usage: $(basename "$0") <skill1,skill2,...|ALL>"
  echo ""
  echo "Install Claude Code skills from .github/skills/ into ~/.claude/skills/"
  echo ""
  echo "Available skills:"
  for d in "$REPO_SKILLS_DIR"/*/; do
    [ -d "$d" ] && echo "  $(basename "$d")"
  done
  echo ""
  echo "Examples:"
  echo "  $(basename "$0") willville"
  echo "  $(basename "$0") willville,other-skill"
  echo "  $(basename "$0") ALL"
  exit 1
}

[ $# -eq 0 ] && usage

if [ "$1" = "ALL" ]; then
  skills=()
  for d in "$REPO_SKILLS_DIR"/*/; do
    [ -d "$d" ] && skills+=("$(basename "$d")")
  done
else
  IFS=',' read -ra skills <<< "$1"
fi

if [ ${#skills[@]} -eq 0 ]; then
  echo "No skills found to install."
  exit 1
fi

for skill in "${skills[@]}"; do
  src="$REPO_SKILLS_DIR/$skill"
  dest="$TARGET_DIR/$skill"

  if [ ! -d "$src" ]; then
    echo "SKIP: $skill — not found in .github/skills/"
    continue
  fi

  mkdir -p "$dest"

  # Copy all files from the skill directory
  cp -R "$src"/* "$dest"/
  echo "OK:   $skill — installed to $dest"
done

#!/usr/bin/env bash
set -euo pipefail

REPO_SKILLS_DIR="$(cd "$(dirname "$0")/../.github/skills" && pwd)"

usage() {
  echo "Usage: $(basename "$0") [claude|codex|ALL] <skill1,skill2,...|ALL>"
  echo ""
  echo "Install skills from .github/skills/ into Claude and/or Codex."
  echo ""
  echo "Targets:"
  echo "  claude  -> ~/.claude/skills"
  echo "  codex   -> ~/.codex/skills"
  echo "  ALL     -> both Claude and Codex"
  echo ""
  echo "Available skills:"
  for d in "$REPO_SKILLS_DIR"/*/; do
    [ -d "$d" ] && echo "  $(basename "$d")"
  done
  echo ""
  echo "Examples:"
  echo "  $(basename "$0") codex willville"
  echo "  $(basename "$0") claude willville,other-skill"
  echo "  $(basename "$0") ALL ALL"
  echo "  $(basename "$0") willville        # legacy: installs to Claude"
  exit 1
}

[ $# -eq 0 ] && usage

target="claude"
skill_arg="$1"

case "$1" in
  claude|codex|ALL)
    [ $# -eq 2 ] || usage
    target="$1"
    skill_arg="$2"
    ;;
  *)
    [ $# -eq 1 ] || usage
    ;;
esac

if [ "$target" = "ALL" ]; then
  targets=("claude" "codex")
else
  targets=("$target")
fi

if [ "$skill_arg" = "ALL" ]; then
  skills=()
  for d in "$REPO_SKILLS_DIR"/*/; do
    [ -d "$d" ] && skills+=("$(basename "$d")")
  done
else
  IFS=',' read -ra skills <<< "$skill_arg"
fi

if [ ${#skills[@]} -eq 0 ]; then
  echo "No skills found to install."
  exit 1
fi

for skill in "${skills[@]}"; do
  src="$REPO_SKILLS_DIR/$skill"

  if [ ! -d "$src" ]; then
    echo "SKIP: $skill — not found in .github/skills/"
    continue
  fi

  for target in "${targets[@]}"; do
    case "$target" in
      claude)
        target_dir="$HOME/.claude/skills"
        ;;
      codex)
        target_dir="$HOME/.codex/skills"
        ;;
      *)
        echo "ERROR: unsupported target: $target" >&2
        exit 1
        ;;
    esac

    dest="$target_dir/$skill"
    mkdir -p "$dest"

    # Copy all files from the skill directory.
    cp -R "$src"/* "$dest"/
    echo "OK:   $skill — installed to $dest"
  done
done

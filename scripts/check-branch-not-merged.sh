#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Guard: refuse to commit on a branch whose remote head has been merged/deleted.
#
# Once a PR merges, GitHub usually deletes the branch. Continuing to commit on
# that dead local branch is wasted work — the commits live on a ref nobody will
# look at, and they have to be re-done on a fresh branch. This catches it at
# commit time and tells you to branch off the default branch instead.
#
# Best-effort + fail-open: network checks that can't reach the remote are
# skipped, so offline commits are never blocked. Override one commit with
# `git commit --no-verify`.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail
export GIT_TERMINAL_PROMPT=0  # never hang on an auth prompt inside a hook

# Skip mid-rebase / merge / cherry-pick (HEAD is intentionally unusual there).
git_dir="$(git rev-parse --git-dir 2>/dev/null || echo .git)"
[[ -d "$git_dir/rebase-merge" || -d "$git_dir/rebase-apply" \
   || -f "$git_dir/MERGE_HEAD" || -f "$git_dir/CHERRY_PICK_HEAD" ]] && exit 0

branch="$(git symbolic-ref --short -q HEAD || true)"
[[ -z "$branch" ]] && exit 0  # detached HEAD — nothing to guard

# Integration branches are fine to commit on directly.
case "$branch" in
  main | master | develop) exit 0 ;;
esac

# A brand-new local branch that was never pushed has no upstream — allow it.
upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
[[ -z "$upstream" ]] && exit 0

remote="${upstream%%/*}"        # e.g. origin
remote_branch="${upstream#*/}" # e.g. feat/foo

block() {
  echo "" >&2
  echo "  ⛔ Branch '$branch' $1." >&2
  echo "     You're committing onto a branch that's already closed out. Start fresh:" >&2
  echo "" >&2
  echo "         git fetch $remote --prune" >&2
  echo "         git checkout -b <new-branch> $remote/main" >&2
  echo "" >&2
  echo "     (Intentional? Override this one commit with: git commit --no-verify)" >&2
  echo "" >&2
  exit 1
}

# 1) Remote head deleted? (the usual post-merge state). Only meaningful when the
#    branch tracks its OWN remote branch — a branch created with
#    `checkout -b X origin/main` tracks origin/main, and a never-pushed branch
#    has no remote head, so checking those would false-positive. Single
#    lightweight ref query; if the remote is unreachable, ls-remote fails and we
#    fall through (fail-open).
if [[ "$remote_branch" == "$branch" ]]; then
  if remote_heads="$(git ls-remote --heads "$remote" "$remote_branch" 2>/dev/null)"; then
    if [[ -z "$remote_heads" ]]; then
      block "no longer exists on '$remote' (deleted — typically after a merge)"
    fi
  fi
fi

# 2) Already merged into the default branch? Refresh the default ref best-effort
#    (fail-open) so a merge done on GitHub since the last fetch is still caught.
#    Require the default branch to be strictly AHEAD of HEAD so a fresh branch
#    sitting exactly at the default tip (no commits yet) isn't flagged — only a
#    branch whose work is already absorbed into a moved-on default trips this.
git fetch --quiet "$remote" main 2>/dev/null || true
default_ref="$remote/main"
if git rev-parse --verify --quiet "$default_ref" >/dev/null; then
  ahead="$(git rev-list --count "HEAD..$default_ref" 2>/dev/null || echo 0)"
  if [[ "$ahead" -gt 0 ]] && git merge-base --is-ancestor HEAD "$default_ref" 2>/dev/null; then
    block "is already fully merged into $default_ref"
  fi
fi

exit 0

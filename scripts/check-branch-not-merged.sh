#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Guard: refuse to commit on a branch that's already been merged or deleted.
#
# Once a PR merges, continuing to commit on that dead local branch is wasted
# work — the commits live on a ref nobody will look at and have to be re-done on
# a fresh branch. This catches it at commit time and points you at the default
# branch instead.
#
# Detection, strongest first:
#   1. A MERGED PR for this branch (via `gh`) — catches squash/rebase/merge
#      regardless of whether the remote branch was deleted. Authoritative.
#   2. Remote head deleted (ref query) — the usual post-merge state.
#   3. Work already fully contained in a moved-on default branch (ref math).
#
# Best-effort + fail-open: any check that can't reach the network is skipped, so
# offline commits are never blocked. Override one commit with
# `git commit --no-verify`.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail
export GIT_TERMINAL_PROMPT=0 # never hang on an auth prompt inside a hook

# Skip mid-rebase / merge / cherry-pick (HEAD is intentionally unusual there).
git_dir="$(git rev-parse --git-dir 2>/dev/null || echo .git)"
[[ -d "$git_dir/rebase-merge" || -d "$git_dir/rebase-apply" \
  || -f "$git_dir/MERGE_HEAD" || -f "$git_dir/CHERRY_PICK_HEAD" ]] && exit 0

branch="$(git symbolic-ref --short -q HEAD || true)"
[[ -z "$branch" ]] && exit 0 # detached HEAD — nothing to guard

# Integration branches are fine to commit on directly.
case "$branch" in
  main | master | develop) exit 0 ;;
esac

# A brand-new local branch that was never pushed has no upstream — allow it.
upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
[[ -z "$upstream" ]] && exit 0

remote="${upstream%%/*}"       # e.g. origin
remote_branch="${upstream#*/}" # e.g. feat/foo (or the default branch, if base-tracking)

# Resolve the remote's default branch instead of assuming "main".
default_branch="$(git symbolic-ref --quiet --short "refs/remotes/$remote/HEAD" 2>/dev/null | sed "s#^$remote/##")"
[[ -z "$default_branch" ]] && default_branch=main
default_ref="$remote/$default_branch"

block() {
  echo "" >&2
  echo "  ⛔ Branch '$branch' $1." >&2
  echo "     You're committing onto a branch that's already closed out. Start fresh:" >&2
  echo "" >&2
  echo "         git fetch $remote --prune" >&2
  echo "         git checkout -b <new-branch> $default_ref" >&2
  echo "" >&2
  echo "     (Intentional? Override this one commit with: git commit --no-verify)" >&2
  echo "" >&2
  exit 1
}

# Only guard branches that track their OWN remote branch. A base-tracking branch
# (`checkout -b X $default_ref`) tracks the default branch and is just fresh work
# about to start. Exit here BEFORE any merge lookup so that, e.g., an old merged
# PR that happened to reuse this branch name can't block a fresh base-tracking
# branch, and so the default moving ahead never false-positives.
[[ "$remote_branch" != "$branch" ]] && exit 0

# 1) Authoritative: does this branch have a MERGED PR? Catches squash/rebase
#    merges that leave no ancestor relationship. Fail-open if gh is
#    missing/unauthed/offline.
if command -v gh >/dev/null 2>&1; then
  merged_pr="$(gh pr list --head "$branch" --state merged --json number \
    --jq '.[0].number' 2>/dev/null || true)"
  [[ -n "$merged_pr" ]] && block "was merged via PR #$merged_pr"
fi

# 2) Remote head deleted? (the usual post-merge state). Single lightweight ref
#    query; if the remote is unreachable, ls-remote fails and we fall through.
if remote_heads="$(git ls-remote --heads "$remote" "$branch" 2>/dev/null)"; then
  if [[ -z "$remote_heads" ]]; then
    block "no longer exists on '$remote' (deleted — typically after a merge)"
  fi
fi

# 3) Already fully merged into the default branch (non-squash)? Refresh the
#    default ref best-effort (fail-open). Require the default to be strictly
#    AHEAD of HEAD so a fresh branch sitting at the default tip isn't flagged.
git fetch --quiet "$remote" "$default_branch" 2>/dev/null || true
if git rev-parse --verify --quiet "$default_ref" >/dev/null; then
  ahead="$(git rev-list --count "HEAD..$default_ref" 2>/dev/null || echo 0)"
  if [[ "$ahead" -gt 0 ]] && git merge-base --is-ancestor HEAD "$default_ref" 2>/dev/null; then
    block "is already fully merged into $default_ref"
  fi
fi

exit 0

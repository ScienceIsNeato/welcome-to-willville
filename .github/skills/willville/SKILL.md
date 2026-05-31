---
name: willville
description: >-
  Update .willville.json in any ScienceIsNeato repo. Write plain standup-style
  updates — what you're working on and where it's headed. No jargon, no file
  paths, no technical changelogs.
---

# Willville committed packet

Keep `.willville.json` in the repo root current so the town map shows what you're actually working on.

## Writing style

Write like a coworker giving a standup update over coffee — plain, casual, no jargon.

- **Talk like a human.** "Working on perf testing and art regen" not "Implementing automated Playwright-based regression infrastructure with FPS/baseline/waterfall tracking."
- **Say what you're doing, not how the code works.** The reader already knows the repo. They want to know what's in flight and where it's headed.
- **Use a wide lens.** Summarize the active problem area and intended outcome, not tiny implementation chores.
- **Status** = what outcome you are actively driving right now, in one sentence. If there are multiple workstreams, group them by theme.
- **Direction** = the next concrete repo-specific outcome, not a process step.
- **Be repo-aware.** Use the domain language of the current repo (town map, rails, rendering, data freshness, etc.) so the update reads grounded.
- Do not enumerate file paths, function names, flag names, or technical implementation details.
- Do not restate the repo purpose, architecture, or README material.
- Do not use process-only filler like "trying to close PR", "working through comments", "fixing CI", or "doing cleanup" without naming the real repo outcome.
- Omit empty fields instead of filling them with `"None"`.

### Good examples

```json
"status": "Perf testing, isthmus masks, region art regen — PR #11 up"
"direction": "Ship perf test harness so future optimization has a real baseline"
```

```json
"status": "Stabilizing town data freshness so board status survives runtime resets"
"direction": "Have bell updates persist across cold starts so the map stays accurate between sessions"
```

```json
"status": "Tuning district border motion and open-sea spacing so map readability improves on mobile"
"direction": "Ship a cleaner coastline view where boats and labels stop overlapping land art"
```

### Bad examples (do not write like this)

```json
"status": "Trying to close PR"
"direction": "Address comments and get CI green"
```

```json
"status": "Refactoring parser helper and wiring cache interface for store writes"
"direction": "Continue implementation and then run tests"
```

Too process-focused or too implementation-level. Reads like workflow notes, not an outcome update.

## Shape

```json
{
  "agent": {
    "status": "What you're doing, plain English",
    "direction": "Where it's headed next",
    "last_update": "2026-05-26T00:00:00Z"
  }
}
```

Do not add `actions`, `difficulties`, or `needs_human` — those are legacy.

## When to update

- When you start work
- When you finish something
- When direction changes
- **Whenever you update STATUS.md** — a pre-commit hook blocks commits that
  touch STATUS.md without also updating .willville.json

## After updating

```bash
git add .willville.json
git commit -m "chore: update willville agent packet"
git push
```

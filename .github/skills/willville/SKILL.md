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
- **Status** = what's on your plate right now, in one sentence. List the workstreams if there are a few. Mention the PR number if one is open.
- **Direction** = why this matters or where it's going next. One sentence, forward-looking.
- Do not enumerate file paths, function names, flag names, or technical implementation details.
- Do not restate the repo purpose, architecture, or README material.
- Omit empty fields instead of filling them with `"None"`.

### Good examples

```json
"status": "Perf testing, isthmus masks, region art regen — PR #11 up"
"direction": "Ship perf test harness so future optimization has a real baseline"
```

```json
"status": "Fixing deploy pipeline and canal data fallbacks"
"direction": "Get prod serving live data again after the API route 404s"
```

### Bad examples (do not write like this)

```json
"status": "PR #11 open: deep perf profiler with FPS/baseline/waterfall/DOM/memory tracking and automated Playwright regression gate"
"direction": "Land the perf drilldown tooling so every future change can be validated against a saved baseline via scripts/perf_test.sh"
```

Too long, too technical, reads like a changelog.

## Shape

```json
{
  "agent": {
    "status": "What you're doing, plain English",
    "direction": "Where it's headed next",
    "branch": "auto-filled by pre-commit hook",
    "last_update": "auto-filled by pre-commit hook"
  }
}
```

`branch` and `last_update` are maintained automatically by the pre-commit hook —
you never need to set them manually. Just write `status` and `direction`.

Do not add `actions`, `difficulties`, or `needs_human` — those are legacy.

## When to update

- When you start work
- When you finish something
- When direction changes
- When what you're working on changes

## How it stays fresh

A pre-commit hook (`.githooks/pre-commit`) auto-updates `branch` and
`last_update` on every commit and stages the file. You just need to
update `status` and `direction` when the work changes — the mechanical
fields take care of themselves.

If you update status/direction outside a commit, push it:

```bash
git add .willville.json
git commit -m "chore: update willville agent packet"
git push
```

---
name: willville
description: >-
  Update .willville.json in any ScienceIsNeato repo. Write plain standup-style
  updates — what you're working on and where it's headed. No jargon, no file
  paths, no technical changelogs.
---

# Willville committed packet

Willville reads each repo's committed .willville.json. Keep it current so the
town reflects the actual state of the work.

This packet is an owner-facing status delta, not onboarding copy.

## Writing style

Write like a coworker giving a standup update over coffee — plain, casual, no jargon.

- **Talk like a human.** "Working on perf testing and art regen" not "Implementing automated Playwright-based regression infrastructure with FPS/baseline/waterfall tracking."
- **Say what you're doing, not how the code works.** The reader already knows the repo. They want to know what's in flight and where it's headed.
- **Status** = what's on your plate right now, in one sentence. List the workstreams if there are a few. Mention the PR number if one is open.
- **Direction** = why this matters or where it's going next. One sentence, forward-looking.
- Do not enumerate file paths, function names, flag names, or technical implementation details.
- Do not restate the repo purpose, architecture, or README material.
- Do not author the GitHub Actions list; the town derives runs programmatically.
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

The bad version is too long, too technical, and reads like a changelog, not a status update.

## File location

.willville.json at repository root.

Do not git-ignore this file. It is intended to be committed.

## Agent packet shape

Add/update the agent block in .willville.json:

```json
{
  "agent": {
    "status": "Current slice of work in repo-owner shorthand",
    "direction": "Why this slice matters / where the branch is heading",
    "last_update": "2026-05-25T00:00:00Z"
  }
}
```

Legacy `difficulties` and `needs_human` keys are still parsed for backward
compatibility, but do not add them in new packets.

Do not add `actions` in new packets. The Digital Detail Board GitHub Actions
list is derived from the repo's recent workflow runs instead.

## Update cadence

Update this file regularly:

- when you start work
- when you finish a milestone
- when your direction changes
- when the current slice changes
- when the next important delta changes

## Required workflow

After updating .willville.json, commit and push it so both local and deployed Willville see the same data.

```bash
git add .willville.json
git commit -m "chore: update willville agent packet"
git push
```

## How it flows

Committed .willville.json -> /api/town reads manifest status/direction.
GitHub Actions runs are fetched separately from the repo on refresh.

The town bell is read-only refresh. It does not write status into other repos.

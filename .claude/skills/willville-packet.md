# Willville packet

Keep `.willville.json` in the repo root current so the Willville town map shows what you're actually working on.

## Voice

Write like a coworker giving a standup update — plain, casual, no jargon. The reader already knows the repo. They want to know what's in flight and where it's headed, not how the code works.

- **Status** = what's on your plate right now, one sentence. List the workstreams if there are a few. Mention the PR number if one is open.
- **Direction** = why this matters or where it's going next. One sentence, forward-looking.
- Do not enumerate file paths, function names, flag names, or technical implementation details.
- Do not restate the repo purpose or README material.

### Good

```json
"status": "Perf testing, isthmus masks, region art regen — PR #11 up"
"direction": "Ship perf test harness so future optimization has a real baseline"
```

```json
"status": "Fixing deploy pipeline and canal data fallbacks"
"direction": "Get prod serving live data again after the API route 404s"
```

### Bad (do not write like this)

```json
"status": "PR #11 open: deep perf profiler with FPS/baseline/waterfall/DOM/memory tracking and automated Playwright regression gate"
"direction": "Land the perf drilldown tooling so every future change can be validated against a saved baseline via scripts/perf_test.sh"
```

Too long, too technical, reads like a changelog.

## Shape

```json
{
  "schema_version": 1,
  "agent": {
    "status": "What you're doing right now, plain English",
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
- When the current slice changes

## After updating

```bash
git add .willville.json
git commit -m "chore: update willville agent packet"
git push
```

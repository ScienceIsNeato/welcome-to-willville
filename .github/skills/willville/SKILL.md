---
name: willville
description: >-
  Use when updating a committed .willville.json in a ScienceIsNeato repo.
  Write status, direction, and action text for the repo owner: assume working
  knowledge, capture deltas, and do not restate README context.
---

# Willville committed packet

Willville reads each repo's committed .willville.json. Keep it current so the
town reflects the actual state of the work.

This packet is an owner-facing status delta, not onboarding copy.

## Writing style

- Assume the reader already knows the repo.
- Record the delta: what changed, what is active now, what comes next.
- Do not restate the repo purpose, architecture, or README material unless that changed.
- Keep `status`, `direction`, and `actions[].name` concrete and current.
- Omit empty fields instead of filling them with `"None"`.

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
    "last_update": "2026-05-25T00:00:00Z",
    "actions": [
      { "name": "Recent completed change", "status": "done" },
      { "name": "Current step", "status": "in_progress" },
      { "name": "Next concrete step", "status": "planned" }
    ]
  }
}
```

Action status values: done, in_progress, planned, failed.

Legacy `difficulties` and `needs_human` keys are still parsed for backward
compatibility, but do not add them in new packets.

## Update cadence

Update this file regularly:

- when you start work
- when you finish a milestone
- when your direction changes
- when the active step changes
- when the next concrete step changes

## Required workflow

After updating .willville.json, commit and push it so both local and deployed Willville see the same data.

```bash
git add .willville.json
git commit -m "chore: update willville agent packet"
git push
```

## How it flows

Committed .willville.json -> /api/town reads manifest -> DigitalDetailBoard agent panel.

The town bell is read-only refresh. It does not write status into other repos.

---
name: willville
description: >-
  Keep your repo's committed .willville.json current with agent status updates.
  Use this whenever status, direction, blockers, or actions change in any
  ScienceIsNeato repo.
---

# Willville committed packet

Willville reads each repo's committed .willville.json. Keep it current so the town board reflects what you are doing.

## File location

.willville.json at repository root.

Do not git-ignore this file. It is intended to be committed.

## Agent packet shape

Add/update the agent block in .willville.json:

```json
{
  "agent": {
    "status": "What you are doing right now — be specific",
    "direction": "Strategic goal — where this work is heading",
    "difficulties": "Current pain points or blockers. 'None' if clear.",
    "needs_human": "What needs a human decision. 'None' if nothing.",
    "last_update": "2026-05-22T14:00:00Z",
    "actions": [
      { "name": "Description of a recent action", "status": "done" },
      { "name": "What you are doing now", "status": "in_progress" },
      { "name": "What comes next", "status": "planned" }
    ]
  }
}
```

Action status values: done, in_progress, planned, failed.

## Update cadence

Update this file regularly:

- when you start work
- when you finish a milestone
- when your direction changes
- when blockers appear or clear
- when needs_human changes

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

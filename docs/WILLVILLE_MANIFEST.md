# `.willville.json` — Project Manifest for Willville

Drop a `.willville.json` file at the root of any GitHub repo to claim a stop in
[Willville](https://willville.ai) and publish live status alongside it.

## Why

Willville is Will's portfolio town. The `/api/town` edge function lists every
repo under `ScienceIsNeato`, filters out forks/archives/stale, and reads each
repo's `.willville.json` to figure out where the building goes in town and what
the sign on the door says. Repos without a manifest still appear — they just
fall back to baked-in heuristics for placement and show "no manifest yet" in
their SPOG card.

`.willville.json` is the only live packet. Willville does not read STATUS.md
packets.

## Spec (v1)

All fields are optional. Anything you omit falls back to heuristics or to
GitHub repo metadata.

```json
{
  "schema_version": 1,
  "project": {
    "name": "ChronicChronicler",
    "display_name": "The Chronicler's Tower",
    "district": "the-zeitgeist",
    "stop": "chronicchronicler",
    "lines": ["web", "writing"],
    "visibility": "public",
    "homepage": "https://chronicchronicler.example.com"
  },
  "status": {
    "state": "shipping",
    "summary": "Beta launched, gathering early users",
    "blockers": ["OAuth on Safari intermittent"],
    "next": ["Onboarding email sequence", "Export to PDF"],
    "updated": "2026-05-19"
  },
  "queue": {
    "active": true,
    "milestone": "Closed beta invites",
    "eta_days": 14,
    "priority": 3
  },
  "agent": {
    "status": "Perf testing, art cleanup, and deploy fixes",
    "direction": "Get prod serving the same live story the local map already shows",
    "last_update": "2026-05-28T00:00:00Z"
  }
}
```

### `project` fields

| Field          | Type     | Notes                                                                      |
| -------------- | -------- | -------------------------------------------------------------------------- |
| `name`         | string   | Defaults to the repo name.                                                 |
| `display_name` | string   | What the building's sign says. Use Willville-flavor names ("The Atelier"). |
| `district`     | string   | One of the 8 district IDs (see below). Defaults to heuristic placement.    |
| `stop`         | string   | URL-safe stop ID. Defaults to a slug of `name`.                            |
| `lines`        | string[] | Which transit lines stop here. Order doesn't matter.                       |
| `visibility`   | string   | `public` (default) or `mayor`. Mayor-only stops never render for tourists. |
| `homepage`     | URL      | Where the SPOG "Visit" button points. Defaults to the GitHub repo URL.     |

### `status` fields

| Field      | Type     | Notes                                                                                    |
| ---------- | -------- | ---------------------------------------------------------------------------------------- |
| `state`    | string   | `idea` \| `wip` \| `shipping` \| `maintenance` \| `dormant`. Defaults to `unknown`.      |
| `summary`  | string   | One-line headline shown in the SPOG card.                                                |
| `blockers` | string[] | Up to 3 are rendered. Surface things that are currently in your way.                     |
| `next`     | string[] | Up to 3 are rendered. The most concrete next actions.                                    |
| `updated`  | ISO date | Used to drive the "whistle pulse" on the train when fresh (<24h). Defaults to last push. |

### `queue` fields — The Mayor's Express

`queue` controls whether your stop rides **The Mayor's Express**, the gilded
central train that visits only currently-active projects, ordered closest-to-
milestone first.

| Field         | Type     | Notes                                                                                      |
| ------------- | -------- | ------------------------------------------------------------------------------------------ |
| `active`      | boolean  | Set to `true` to ride the Express. `false` parks the stop.                                 |
| `milestone`   | string   | Short label for the milestone ("Beta launch", "v1.1 release", "Yard-ready for October").   |
| `eta_days`    | number   | Days until the milestone. **Primary ordering field — smaller is sooner.** Easy for agents. |
| `target_date` | ISO date | Alternative to `eta_days`. Auto-converted at request time. Use one or the other.           |
| `priority`    | number   | Tiebreaker when ETAs are equal. Smaller = higher priority. Optional.                       |

**Ordering rule:** Active stops are sorted ascending by `eta_days` (or derived
from `target_date`), then by `priority`, then alphabetically by `display_name`.
The top of the sorted list is the train's "Now arriving" target.

**Agent workflow** (this is the v1 of the planned Willville skill): each
session, update `queue.eta_days` as the milestone moves. When the project
ships, set `queue.active: false` to take it off the Express until the next
milestone.

### `agent` fields

The `agent` block is the plain-English committed standup packet used for the
detail boards when active work is happening.

| Field          | Type     | Notes                                           |
| -------------- | -------- | ----------------------------------------------- |
| `status`       | string   | What you're doing right now, in plain English.  |
| `direction`    | string   | Where the work is headed next.                  |
| `difficulties` | string   | Optional current blocker summary.               |
| `needs_human`  | string   | Optional human-input request.                   |
| `last_update`  | ISO date | Freshness stamp for the committed agent packet. |

## The Canal (PR live status)

Willville is a coastal town. A canal runs along the bottom of the map with six
lock chambers. Every open PR across your tracked repos shows up as a boat
sitting in the lock matching its current state:

| Lock            | When a PR sits here                         |
| --------------- | ------------------------------------------- |
| Open Dock       | Drafts and just-opened PRs without CI yet   |
| Inspection Lock | CI checks running                           |
| Review Lock     | CI green, awaiting human review             |
| Edits Lock      | CI failed, or reviewer requested changes    |
| Final Lock      | Approved, mergeable, ready to merge         |
| Open Sea        | Merged (or closed) within the last 24 hours |

The canal updates roughly every minute. Boat hulls are tinted by the source
repo's district color. Click a boat to open the PR on GitHub.

No manifest setup is required — the canal infers everything from GitHub.

## Districts (current)

| ID                    | Vibe                                                   |
| --------------------- | ------------------------------------------------------ |
| `mirrored-mile`       | Writing, novels, and reflective long-form work         |
| `slop-wharf`          | slop-mop family and dev quality scaffolding            |
| `halls-of-judgement`  | AI evaluations and training work                       |
| `the-zeitgeist`       | Customer-facing websites and apps                      |
| `gates-of-hell`       | Halloween and spooky storytelling                      |
| `dogwallow-ramble-ii` | Homesteading projects and household work               |
| `town-square`         | The civic hub and town-only landmarks                  |
| `the-graveyard`       | Inactive projects, old experiments, and reference work |

## Lines (current)

| ID          | Crosses                                                           |
| ----------- | ----------------------------------------------------------------- |
| `ai`        | The Foundry + Audit Yard (and anything else AI-tagged)            |
| `quality`   | Slop Wharf + Audit Yard's Audit House                             |
| `web`       | Web Row + Press Row's Newsstand                                   |
| `writing`   | Press Row + Hallow Hollow's Vampire's Crypt + Mystery Manor       |
| `workshop`  | Sawmill District + Hallow Hollow's Watchful Pumpkin               |
| `halloween` | Hallow Hollow + Foundry's Atelier (ganglia-studio rides this too) |

## Visibility

- `visibility: "public"` (default) — visible to everyone, including search.
- `visibility: "mayor"` — visible only to authenticated Mayors (Will). Use this
  for stops whose existence is itself sensitive.

Note: if the **repo** is private, the stop is automatically Mayor-only
regardless of the `visibility` field.

## Updating

Commit a new `.willville.json` in the repo you're working in, then ring the
bell in Willville to scrape fresh packets into runtime memory.

Ringing the bell does a read-only scrape of repo manifests into ephemeral
runtime memory. It does not write anything back to GitHub, and that runtime
cache disappears if the server process resets.

Willville never invents status or direction text. Those fields only come from
repo-authored `.willville.json` packets.

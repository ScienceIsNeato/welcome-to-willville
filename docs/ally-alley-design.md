# Ally Alley — design

A sister area off the south coast of Willville for repos **Will contributes to but does
not own** (first ally: Jason's `queueit`). Willville-proper visualizes repos that
_broadcast_ their own status via a committed `.willville.json`; we can't make other
people's repos broadcast, so Ally Alley is built on observed GitHub signal instead.

## As built (supersedes parts of the original session below)

The design session below proposed offshore guest-isles with a reusable sprite. In
implementation that was revised:

- **Geography:** Ally Alley shipped as a real **contiguous district** south of the
  Gates of Hell (added to `data/town-layout.v1.json`, sharing the gates' south coast),
  not separate isles. It has **bespoke gpt-image-1 alley art** (crisscrossing alleys
  among tall buildings), generated via `generate_image_with_dalle` in ganglia-studio.
- **Placement:** ally stops are placed in-polygon via `sitePositionForStop`; a stop's
  position can be overridden by a `position` field on its ally-config entry.
- **Repositioning:** the City Planner placement pipeline is ally-aware — moving an ally
  stop writes its `position` to `data/ally-alley.v1.json` (not `heuristics.ts`), so it
  no longer double-sources and duplicates the stop.
- **Per-site repaint:** the City Planner "Paint" path was rewired off ganglia-studio's
  removed `insert-glyph` command to a direct OpenAI `images.edit` call
  (`scripts/ganglia_inpaint.py`), clipped back to the editable mask region.
- **Contribution monitoring + curated config:** shipped as designed (below).

## Decisions (design session)

| Question                  | Decision                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Which repos appear        | **Curated allowlist** in a config file, seeded with `queueit`.                                                                                 |
| What an isle's glow means | **Repo health** — same visual language as the main town (project activity, not Will's activity).                                               |
| Map shape                 | **Offshore guest-isles** — one small island per ally, off the south coast.                                                                     |
| Access control            | **None.** Everything is public, private repos included — we only surface harmless metadata. No mayor/tourist gating.                           |
| Contributor identity      | Reuse the site owner login `ScienceIsNeato` (`OWNER`, `town-snapshot.ts:28`). Will uses the same login everywhere, so no separate `me` config. |

### How "monitor my contributions" is honored

The isle's **glow = the project's health** (Will chose the town's consistent visual
language). So Will's footprint shows up two other ways:

- **Selection** — an isle exists _because_ Will contributes there (that's what the
  curated list encodes).
- **Contribution badge** — in the isle's detail panel: e.g. "You: 12 commits · 2 open
  PRs · last touched 3d ago", from `author:ScienceIsNeato` queries.

(Open option: also _tint_ the isle by Will's recency — the "both, layered" variant.
Deferred unless we want it.)

## Architecture

### Config — `data/ally-alley.v1.json`

```json
{
  "allies": [
    { "repo": "<jason-handle>/queueit", "displayName": "QueueIt", "blurb": "…" }
  ]
}
```

No `visibility`, no `me` — both resolved away by the decisions above.

### Data model

- Add `Stop.source?: "owned" | "ally"` (default `"owned"`).
- Ally stops skip the `.willville.json` manifest and the district-polygon assumptions;
  they get **archipelago positions** instead of grid-in-polygon placement.

### Fetch pipeline (reuse the existing machinery)

- The current repo-signal fetchers (`fetchRepoSignals`, `fetchCommitCounts`,
  `fetchMilestones`, workflow runs, stars/releases) already take `(owner, name, token)`
  but the orchestration hardcodes `OWNER`. **Generalize the orchestration** to also run
  the ally list with arbitrary `owner/name` → gives repo-health glow.
- Add a light **contribution query** per ally: `author:ScienceIsNeato` commits + a PR
  search → the contribution badge.
- Cache in Cloudflare KV alongside the town snapshot (same pattern), so the Search
  API's 30/min limit is a non-issue for a small curated list.

### Geography & art — procedural, not bespoke

Offshore-isles + a growing ally list means Ally Alley must be **generative**, unlike the
9 hand-authored districts:

- Deterministically place each ally as a small island in a south-sea band (world coords
  south of the land mass), spaced to avoid overlap and the existing open-sea PR-boats in
  the SE.
- **Reusable island sprite** (tinted/varied per isle) instead of a bespoke multi-MB
  backdrop per ally — keeps art cost low.
- A dotted **ferry route** from the Gates-of-Hell bridge threading the isles, echoing the
  canal/transit motif. The winding sea-lane between isles is the literal "alley" — drop
  an **"Ally Alley"** label in that channel.
- Placement note: the south-of-Gates region Will outlined is green land; the isles seat
  in the water just off that coast. Nudge placement on-screen once rendered.

## Phasing

1. **Monitoring pipeline first** — config + generalized fetch + contribution badge,
   validated with plain markers. Prove we can light up `queueit`'s health and Will's
   contribution stats before investing in art.
2. **Archipelago geography + art** — procedural isle placement, island sprite, ferry
   route, sea label.

## Open items before Phase 1

- **Jason's exact repo path** (`owner/name`) for `queueit` — needed to fetch.
- Confirm the contribution badge is wanted (secondary detail, not the glow).

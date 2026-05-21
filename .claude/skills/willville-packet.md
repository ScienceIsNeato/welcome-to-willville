# Willville Packet — STATUS.md encoding

When working on any repo under `ScienceIsNeato/`, maintain a `<!-- willville ... -->` packet at the top of the repo's `STATUS.md`. This is your compressed standup — a manager should be able to read it in 10 seconds and know exactly what's happening.

## Format

```markdown
<!-- willville
doing: Implementing frame-by-frame video renderer for story pipeline
done: Audio sync engine, caption overlay, timeline scrubber
next: Subtitle track support, ship beta to 3 testers
blocked: FFmpeg wasm build segfaults on ARM — investigating upstream
risk: medium — wasm stability could slip eta by a week
milestone: Story-to-video v2
eta: 2026-06-01
-->
```

## Fields

| Field       | Purpose                                                    | Example                                                       |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| `doing`     | What you're actively working on right now. Be specific.    | `Rewriting the PR diff parser to handle renames`              |
| `done`      | What you just shipped. Comma-separated, most recent first. | `Rename detection, binary file filter, test harness`          |
| `next`      | What comes after `doing` is finished.                      | `Add GitHub Actions integration, write docs`                  |
| `blocked`   | The single most important blocker, if any. Omit if clear.  | `Waiting on upstream API to expose commit signatures`         |
| `risk`      | `low`, `medium`, or `high` with a brief reason if not low. | `high — auth token rotation breaks all existing integrations` |
| `milestone` | Active milestone name.                                     | `v2.0 release`                                                |
| `eta`       | Target date, `YYYY-MM-DD`.                                 | `2026-06-15`                                                  |

## Guidelines

**Be concrete, not categorical.** Don't write `doing: development`. Write `doing: Adding retry logic to the webhook delivery queue`. The reader should understand the actual work without opening the repo.

**`doing` + `done` together tell the story.** `done` shows momentum and context. `doing` shows current focus. Together they answer "what happened and what's happening" in two lines.

**`blocked` is singular and important.** If you have three blockers, pick the one that matters most. If nothing is truly blocked, omit the field entirely.

**`risk` is your judgment call.** Low means on track. Medium means there's a known concern that could cause delay. High means the manager should pay attention now. Always include a reason for medium/high.

**Update the packet whenever you:**

- Start a new task (change `doing`, move old `doing` to `done`)
- Hit or clear a blocker
- Finish a milestone
- Notice a risk change

## Placement

The packet goes at the very top of `STATUS.md`, before any other content. Everything below `-->` is free-form markdown (changelogs, notes, checklists).

## Auto-derived fallbacks

If no packet exists, Willville derives state from GitHub signals (push recency, milestones, repo description). An explicit packet always overrides auto-derived values. Writing one gives the town map real signal instead of guesses.

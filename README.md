# Welcome to Willville

A purely-visual interactive town that orchestrates Will's projects.
[willville.ai](https://willville.ai).

- **No menus.** Click around. The trains run all night.
- **Magic Maze aesthetic**, board-game tile feel, top-down.
- **Live status.** Every participating repo drops a [`.willville.json`](docs/WILLVILLE_MANIFEST.md)
  to claim a stop and publish its current state, blockers, and next steps.
- **Open by design.** The town map is public. Every stop — including stops for
  private repos — is visible to everyone. Source links for private repos will
  404 unless you're a collaborator; that's expected.

## Stack

- Next.js 16 (App Router, TypeScript, static export)
- Tailwind v4
- framer-motion (camera pan/zoom)
- SVG + `<animateMotion>` for transit Lines and vehicles
- Cloudflare Pages Functions for the live-data layer (`functions/api/*`)
- zod for `.willville.json` parsing

## Run it

```bash
nvm use     # uses .nvmrc (Node 20)
npm install
npm run dev
# -> http://localhost:3000
```

`npm run dev` boots the Next.js dev server with the heuristic stop list. The
`/api/town` Pages Function won't run under `next dev` — to test the live
discovery + auth flow locally, use Wrangler:

```bash
npm run build
npx wrangler pages dev out --compatibility-date=2026-05-01
```

## Build

```bash
npm run build      # writes static export to out/
```

## Deploy

Cloudflare Pages is deployed from GitHub Actions with
`.github/workflows/deploy-pages.yml`:

- **Build command:** `npm run build`
- **Functions build command:** `npx wrangler pages functions build functions --project-directory . --outfile out/_worker.js --output-routes-path out/_routes.json --build-output-directory out`
- **Output directory:** `out`
- **Compatibility date:** `2026-05-01` or later
- **GitHub Actions repository secret:**
  - `CLOUDFLARE_API_TOKEN` — Cloudflare API token used by Wrangler for
    `pages deploy ./out --project-name welcome-to-willville --branch main`.
    Create a custom token scoped to your Cloudflare account
    with `Cloudflare Pages: Edit`.
- **Secrets to set in the Pages project:**
  - `GITHUB_PAT` — fine-grained PAT with `Contents: read` on the repos you
    want surfaced. Used server-side to read `.willville.json` packets from
    private repos and to fetch PR data for the canal history.
  - `WILLVILLE_MAYOR_KEY` — long random string. Visiting
    `https://willville.ai/keys-to-the-city/?key=<value>` sets the Mayor
    cookie, which unlocks stop repositioning (edit mode). It does not change
    what is visible — the same town data is served to everyone.

GitHub Actions compiles `functions/` into `out/_worker.js` and
`out/_routes.json` before `pages deploy ./out ...`, so the deployed artifact
contains both the static export and the Pages Worker routes for `/api/*`.

## How the town is built

| Layer                   | File                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| Districts               | [`lib/willville.ts`](lib/willville.ts)                                                            |
| Heuristic stop defaults | [`lib/willville.heuristics.ts`](lib/willville.heuristics.ts)                                      |
| Manifest schema         | [`lib/manifest.ts`](lib/manifest.ts)                                                              |
| Merge logic             | [`lib/town.ts`](lib/town.ts)                                                                      |
| SVG board               | [`components/TownStage.tsx`](components/TownStage.tsx)                                            |
| Transit + trains        | [`components/TransitLines.tsx`](components/TransitLines.tsx), [`Train.tsx`](components/Train.tsx) |
| SPOG card               | [`components/SpogCard.tsx`](components/SpogCard.tsx)                                              |
| Discovery + auth        | [`functions/api/`](functions/api)                                                                 |

See [`docs/WILLVILLE_MANIFEST.md`](docs/WILLVILLE_MANIFEST.md) for how to add
your repo to the map and [`docs/ART_BRIEF.md`](docs/ART_BRIEF.md) for the
visual style guide.

## Data visibility

Willville is built around **opt-in transparency**: everything published here is
published intentionally. Here is the exact list of what is and isn't public.

**What's public (visible to anyone):**

- Every repo's name, district, blurb, and stop on the town map — including
  private repos. The map shows that the work exists; it doesn't show the work.
- `.willville.json` agent packets — status and direction updates written by
  agents working in a repo, explicitly intended for public broadcast.
- The canal history: PR titles and merge dates, going back to the repo's
  beginning. **Private repo PRs appear as boats in the canal but their titles
  are redacted** — you can see that work is happening without seeing what it is.

**What's not public:**

- Source code, commit messages, PR descriptions, diffs, issue titles, branch
  names, or file structure of any private repo.
- Source links on the `/projects` page for private repos — these are labeled
  "Private repo" and not linked. Navigating to the GitHub URL directly will 404
  unless you are a collaborator.

**For collaborators:**

If you contribute to a repo that uses willville, your PRs will appear as boats
in the canal with their titles redacted (shown as "private"). Your repo's stop
will appear on the town map. Any `.willville.json` you commit will broadcast
publicly.

## Roadmap

- **Real art.** Ganglia-studio generated tiles per the art brief — district by
  district.
- **Auto-line discovery.** Lines are statically defined today; new line tags in
  `.willville.json` should eventually auto-appear on the map.

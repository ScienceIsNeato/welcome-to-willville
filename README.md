# Welcome to Willville

A purely-visual interactive town that orchestrates Will's projects.
[willville.ai](https://willville.ai).

- **No menus.** Click around. The trains run all night.
- **Magic Maze aesthetic**, board-game tile feel, top-down.
- **Live status.** Every participating repo drops a [`.willville.json`](docs/WILLVILLE_MANIFEST.md)
  to claim a stop and publish its current state, blockers, and next steps.
- **Mayor vs Tourist.** Tourists see public-repo data. Will, with the Keys to
  the City, sees private repos and Mayor-only stops.

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
- **Output directory:** `out`
- **Compatibility date:** `2026-05-01` or later
- **GitHub Actions repository secret:**
  - `CLOUDFLARE_API_TOKEN` — Cloudflare API token used by Wrangler for
    `pages deploy ./out --project-name welcome-to-willville --branch main`.
    Create a custom token scoped to account
    `4c2341810414766ae8cbf672785e82c5` with `Cloudflare Pages: Edit`.
- **Secrets to set in the Pages project:**
  - `GITHUB_PAT` — fine-grained PAT with `Contents: read` on the ScienceIsNeato
    repos you want surfaced. Used only when a Mayor cookie is present.
  - `WILLVILLE_MAYOR_KEY` — long random string. Visiting
    `https://willville.ai/keys-to-the-city/?key=<value>` sets the Mayor
    cookie.

Cloudflare Pages bundles the `functions/` directory into a Worker that runs
alongside the static site, so `/api/town` and `/api/auth/*` are served from
the edge with no extra configuration.

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

## Roadmap

- **Phase 2 auth.** Replace the static Mayor key with GitHub OAuth + per-user
  tokens.
- **Real art.** Ganglia-studio / manual LLM-generated tiles per the art brief.
- **Auto-line discovery.** Today, lines are statically defined; eventually new
  line tags in `.willville.json` files should automatically appear on the map.

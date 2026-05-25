<!-- willville
doing: Building deterministic isthmus town-generation and art-pipeline contracts
done: Shared spline/squiggle district geometry, canal section contract, isthmus terrain, world backdrop, wall tuning, mop sprite-sheet route states, deploy-script repair, mask contract export
next: Bespoke site structures and non-SVG transit/marker sprite conversion
risk: medium
milestone: Isthmus town generation
eta: 2026-05-22
-->

# Status

## Done (2026-05-21) — Isthmus Town Generation Foundation

- **Town topology:** Replaced the old circular island direction with a Rio-inspired isthmus town concept: continuous land bridge, sea on both sides, southern canal, distinct districts, and a separate top-layer Hollywood-style `WELCOME TO WILLVILLE` sign.
- **Shared geometry source:** Added `data/town-layout.v1.json` as the layout source of truth for sparse vertices, generated district topology, canal segments, landmarks, generation parameters, and transit paths.
- **Deterministic district boundaries:** Added a shared layout engine in [lib/town-layout-engine.mjs](lib/town-layout-engine.mjs) that turns sparse shared edges into deterministic sampled squiggle boundaries. Adjacent districts share the same generated edge geometry in reverse order, preserving exact overlap while producing gerrymander-style borders.
- **App integration:** Routed district fills, hit zones, wall loops, stop placement, canal data, and service routes through generated layout geometry instead of old hardcoded heuristics.
- **Wall tuning:** Reworked animated wall borders to be slower, thinner, calmer, and less artifact-prone while preserving a visible stone/brick texture.
- **Art pipeline contracts:** Added generated preview and mask outputs: [docs/generated/willville-layout-preview.svg](docs/generated/willville-layout-preview.svg), [docs/generated/town-mask-contract.v1.json](docs/generated/town-mask-contract.v1.json), and art briefs for both Ganglia Studio and Agent's Choice profiles.
- **Raster masks and base pass:** The artifact pipeline now exports PNG/SVG masks for land, canal, shore wall, district walls, and each district. It also generates a first raster town-base image at [public/art/town/willville-isthmus-v1.png](public/art/town/willville-isthmus-v1.png), which the app renders under the live overlays.
- **World-scale backdrop pass:** Added a generated non-repeating world backdrop at [public/art/town/willville-landscape-v1.png](public/art/town/willville-landscape-v1.png), with sea on both sides of the isthmus, continuous countryside above/below town, and a registered contract at [docs/generated/town-world-backdrop.v1.json](docs/generated/town-world-backdrop.v1.json).
- **Canal section pass:** Promoted the canal to its own generated section with sampled centerline, exact bank paths, masks, and site-placement exclusion. The app renders canal banks from [lib/town-layout-engine.mjs](lib/town-layout-engine.mjs), and the contract now exports `canalSection`, `canal-section`, and `canal-banks` geometry.
- **Site sprite placeholder pass:** Added deterministic generated site-structure sprites in [public/art/stops](public/art/stops) and a manifest in [data/town-site-sprites.v1.json](data/town-site-sprites.v1.json). These are placeholder structures pending bespoke repo-specific pixel art.
- **Mop sprite-sheet scaffold:** Added a generated transparent raster sprite sheet at [public/art/sprites/mop-worker.png](public/art/sprites/mop-worker.png) with walk, sweep, idle, and bucket-carry rows. The mop service layer now clips and animates frames from route states in [data/town-animation.v1.json](data/town-animation.v1.json), sends each worker depot → site → depot, and pauses at the site for the mopping phase.
- **Deploy repair:** Updated [scripts/deploy_app.sh](scripts/deploy_app.sh) so wrangler survives script exit under a managed screen session and status/stop handling stays reliable.
- `npm run town:preview`, `npm run town:art-brief`, `npm run town:validate`, `sm swab`, and deployment through `scripts/deploy_app.sh` pass.

## Done (2026-05-21) — Unified Public Portfolio & Auth Elimination

- **Auth Removal & Unified Page Experience:** Dropped restriction layers, custom cookies, and `isMayor` verification checks across the entire domain. All visitors now securely see the unified set of all 33 repositories and manual stops (including private ones like `welcome-to-willville`, `fogofdog-frontend`, etc.), turning this into a completely open, read-only public portfolio website.
- **Canal Streamlining:** Updated [functions/api/canal.ts](functions/api/canal.ts) to aggregate both private and public pull requests side-by-side with public edge caching headers.
- **Cleanup of Mayor Visibility Flags:** Cleaned up elements displaying special permissions: removed private markers, "Mayor only" badges, and "Mayor visibility" tags from [components/ProjectHud.tsx](components/ProjectHud.tsx), [components/SpogCard.tsx](components/SpogCard.tsx), and [components/StopMarker.tsx](components/StopMarker.tsx) to align with the streamlined site strategy.
- `npm run build` passes flawlessly.

## Done (2026-05-19) — Split-Flap Audio + Cell Transitions + Click Repair

- **Whispery Audio:** Re-engineered the click synthesis in [components/CentralBoard.tsx](components/CentralBoard.tsx) to triple the flip sound duration to 135ms, introduce a slow, soft attack onset, and broaden the bandpass Q filter from 0.9 to 0.38 to replicate whispering autumn leaves.
- **Smart Cell Transitions:** Refactored `SplitFlapCell` in [components/CentralBoard.tsx](components/CentralBoard.tsx) with character-value tracking via `prevCharRef` to bypass trigger/flip animations on any letters or blank cells that maintain identical character values across updates.
- **Click Restoration & Race-Condition Repair:** Restored map site interaction by replacing the React-state based `isDragging` logic for pointer events. Enabled DOM-direct synchronous styling updates for `style.pointerEvents` in [hooks/useTownCamera.ts](hooks/useTownCamera.ts) and leveraged a synchronous `wasDragging()` micro-delay helper to cleanly separate standard mouse clicks from drag panning operations.
- `npm run build` passes flawlessly.

## Done (2026-05-19) — Interaction + bucolic world

- **Pan/zoom model:** single pointer-down drag pans everywhere (only `data-project-hud` excluded); wheel zoom unchanged
- **Double-click:** screen → world via `screenToWorld()`; zoom 1.4× centered on click point; stop hit-test opens `ProjectHud` + updates URL
- **Removed:** district click zoom/navigation; stop single-click HUD; stage background click reset; `focusDistrict`
- **World canvas:** 2400×1800 with town 1600×1240 centered at offset (400, 280); `BucolicMargin` SVG scenery in margins
- `npm run build` passes

## Done (2026-05-19) — ProjectHud dismiss + links

- Stage pointer capture fix for HUD; deep-link dismiss guard
- `npm run build` passes

## Done (2026-05-19) — Pan clamp to world corners

- **Bug:** `clampCamera` used `max(halfW, cx)` / `min(W-halfW, cx)`; when zoomed out (`halfW > W/2`) bounds inverted and locked `cy`/`cx` to the wrong edge (could not reach top-right world corner).
- **Fix:** ordered `minCx = min(halfW, W-halfW)`, `maxCx = max(...)`; `panDelta` uses two `screenToWorld` samples (letterbox-safe).
- `npm run build` passes

## Manual verify

- Drag pan from anywhere on map (including over districts/stops)
- At min/max zoom, pan until each world corner (0,0), (2400,0), (2400,1800), (0,1800) can sit in a viewport corner
- Double-click open ground zooms to cursor; double-click stop zooms + HUD
- Double-click empty map closes HUD
- Zoom into town corners shows meadow/hills/sea margin, not black void
- Deep link `/{district}/{stop}/` opens HUD without camera reframe
- Mayor's Express list still opens HUD (no map zoom)

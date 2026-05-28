<!-- willville
doing: Slop Wharf inpaint pass wrapped and the district layer is live
done: fixed the masked-edit polarity, regenerated the Gates of Hell halo plates, finished the Zeitgeist plates, and added the Slop Wharf landmark pass
next: keep the inpaint rail ready for the next district that needs a similar treatment
risk: low
milestone: Glyph halo integration
eta: 2026-05-27
-->

# Status

## Done (2026-05-27) — Slop Wharf Landmark Pass Is Live

- Ran the existing Slop Wharf site-inpaint rail on the Slop-Mop landmark and regenerated the district layer from the new masked-edit path.
- Fixed the site-inpaint script to prefer the Ganglia Studio venv Python instead of the global interpreter so the district pass could actually execute.
- Confirmed the live Slop Wharf route reloads against the regenerated inpainted district layer with the new landmark visible.
- Validation: `GANGLIA_STUDIO_DIR=/Users/pacey/Documents/SourceCode/ganglia_repos/ganglia-core/ganglia-studio node scripts/apply-town-site-inpaints.mjs --district=slop-wharf` completed successfully after the Python fallback fix; `./scripts/deploy_app.sh` rebuilt and served the updated district on `http://127.0.0.1:3740/`; the live Slop Wharf stop page reloaded cleanly with the new layer.

## Done (2026-05-27) — Zeitgeist Inpaint Plates Regenerated

- Started the Zeitgeist set on the new masked inpaint rail after finishing the Gates of Hell halo fixup.
- Regenerated the Zeitgeist halo plates for ChronicChronicler, fogofdog-frontend, loopcloser, and razer-ripple using the same district-clipped editing path.
- Reloaded the live Zeitgeist route and confirmed the updated loopcloser plate is rendering from the new cached asset.
- Validation: `node scripts/apply-town-glyph-halo.mjs --id=loopcloser --dry-run` resolved `alphaBox.width: 122`, `haloRayPadding: 12`, `maskBox: 146x168`, and `cropBox: 194x216`; real runs for `--id=chronicchronicler`, `--id=fogofdog-frontend`, and `--id=razer-ripple` completed successfully; the live route at `http://127.0.0.1:3740/the-zeitgeist/loopcloser/?site_type=desktop` reloaded against `loopcloser-halo-v1`.

## Done (2026-05-27) — Halo Mask Polarity Fixed And All Three Gates Of Hell Plates Regenerated

- Confirmed the masked-edit bug was a polarity mistake: the generator was only opening the thin outer ring and protecting the center silhouette, which made the paint read like the opposite of the intended mask.
- Changed the halo authoring mask so the full scaled glyph footprint becomes the editable region, then regenerated Ganglia Studio, ganglia-common, and Halloween Tracker with fresh cache keys.
- Rebuilt the local preview and confirmed the updated plates now read as painted underlays beneath the foreground glyphs instead of center cut-outs.
- Validation: dry-run mask inspection showed the editable region move from ring-only to filled silhouette; real `GANGLIA_STUDIO_DIR=/Users/pacey/Documents/SourceCode/ganglia_repos/ganglia-core/ganglia-studio node scripts/apply-town-glyph-halo.mjs --id=ganglia-common`, `--id=ganglia-studio`, and `--id=halloweentracker` all completed successfully; `./scripts/deploy_app.sh` rebuilt the app and served the refreshed overlays on `http://127.0.0.1:3740/`.

## Done (2026-05-27) — Halo Extent Now Uses Constant-Length Rays Off The Real Glyph Silhouette

- Replaced the multiplicative silhouette-scaling rule with the actual halo rule: start from the opaque glyph silhouette, then extend every radial line outward by the same short fixed distance, derived from about `10%` of the occupied glyph width rather than from the empty sprite frame.
- Kept the explicit alpha-bound metadata for Halloween Tracker and Ganglia Studio, but changed the shared box math and the Ganglia authoring mask to add fixed per-ray padding around the real occupied silhouette instead of making already-long rays even longer.
- Regenerated both halo plates and confirmed the live stage now reflects the capped-ray model: Halloween Tracker renders at about `59x74` on stage around a roughly `53x42` marker box, and Ganglia Studio renders at about `68x76` around a roughly `47x42` marker box.
- Validation: `node scripts/apply-town-glyph-halo.mjs --id=halloweentracker --dry-run` resolved `alphaBox.width: 97`, `haloRayPadding: 10`, `maskBox: 117x160`, and `cropBox: 165x208`; `node scripts/apply-town-glyph-halo.mjs --id=ganglia-studio --dry-run` resolved `alphaBox.width: 118`, `haloRayPadding: 12`, `maskBox: 142x164`, and `cropBox: 190x212`; both real `GANGLIA_STUDIO_DIR=/Users/pacey/Documents/SourceCode/ganglia_repos/ganglia-core/ganglia-studio node scripts/apply-town-glyph-halo.mjs --id=...` passes regenerated `/art/town/glyph-halos/halloweentracker.png` and `/art/town/glyph-halos/ganglia-studio.png`; fresh local deploy via `./scripts/deploy_app.sh` confirmed both routes live; `sm swab --no-cache` passed.

## Done (2026-05-27) — Halloween Tracker Tightened Again And Ganglia Studio Gets Its First Halo

- Pulled the Halloween Tracker spread in one more step from `14px` to `10px`, which brings the editable contour down again from `168x168` to `160x160` around the `140x140` glyph frame.
- Added the first Ganglia Studio inpaint halo in the same district-clipped contour system, with a Gates of Hell workshop-style underlay and an initial `168x168` contour around the `140x140` studio glyph frame.
- Regenerated both halo plates, rebuilt the local preview, and confirmed both sites render their updated underlays live in Gates of Hell.
- Validation: `node scripts/apply-town-glyph-halo.mjs --id=halloweentracker --dry-run` resolved a `160x160` mask box and `208x208` crop; `node scripts/apply-town-glyph-halo.mjs --id=ganglia-studio --dry-run` resolved a `168x168` mask box and `216x216` crop; `GANGLIA_STUDIO_DIR=/Users/pacey/Documents/SourceCode/ganglia_repos/ganglia-core/ganglia-studio node scripts/apply-town-glyph-halo.mjs --id=halloweentracker` and `--id=ganglia-studio` regenerated `/art/town/glyph-halos/halloweentracker.png` and `/art/town/glyph-halos/ganglia-studio.png`; fresh local deploy via `./scripts/deploy_app.sh` confirmed both live routes; `sm swab --no-cache` passed.

## Done (2026-05-27) — Halloween Tracker Halo Is District-Clipped And Only About 20% Wider Than The Glyph

- Intersected the contour-based halo mask with the Gates of Hell district art mask so the inpaint area cannot spill into parts of the town the site should not know about.
- Pulled the Halloween Tracker halo spread in from `25px` to `14px`, which brings the editable contour down to `168x168` around the `140x140` glyph frame instead of the earlier `190x190` footprint.
- Regenerated the live halo asset and confirmed the stage render tightened again after the district clipping pass.
- Validation: a dry run of `node scripts/apply-town-glyph-halo.mjs --id=halloweentracker --dry-run` resolved `regionMaskImage: /art/town/masks/district-art/gates-of-hell.png`, a `168x168` contour mask box, and a `216x216` crop; `GANGLIA_STUDIO_DIR=/Users/pacey/Documents/SourceCode/ganglia_repos/ganglia-core/ganglia-studio node scripts/apply-town-glyph-halo.mjs --id=halloweentracker` regenerated `/art/town/glyph-halos/halloweentracker.png`; fresh local deploy via `./scripts/deploy_app.sh` confirmed the tighter live route on `http://127.0.0.1:3740/gates-of-hell/halloweentracker?site_type=desktop`; `sm swab --no-cache` passed.

## Done (2026-05-27) — Halloween Tracker Halo Uses The Glyph Contour Instead Of A Rectangle

- Replaced the old rectangular inpaint cutout with a glyph-shaped mask that grows outward from the actual Halloween Tracker alpha silhouette, so the edit boundary now follows the pumpkin/totem form instead of reading like a pasted box.
- Switched the halo config from the earlier width squeeze to a fixed `25px` contour spread, regenerated the live halo asset, and confirmed the resulting overlay plate now has an irregular contour that matches the glyph footprint.
- Added a dry-run debug mask artifact so the contour can be checked directly before spending a real Ganglia generation pass.
- Validation: `node scripts/apply-town-glyph-halo.mjs --id=halloweentracker --dry-run` wrote `/docs/generated/halloweentracker-glyph-halo-mask.png` plus a readable preview and resolved the new `190x190` contour mask box with a `238x238` crop; `GANGLIA_STUDIO_DIR=/Users/pacey/Documents/SourceCode/ganglia_repos/ganglia-core/ganglia-studio node scripts/apply-town-glyph-halo.mjs --id=halloweentracker` regenerated `/art/town/glyph-halos/halloweentracker.png`; fresh local deploy via `./scripts/deploy_app.sh` confirmed the updated halo is live on `http://127.0.0.1:3740/gates-of-hell/halloweentracker?site_type=desktop`; `sm swab --no-cache` passed.

## Done (2026-05-27) — Halloween Tracker Halo Width Now Fits The Marked Area Better

- Tightened the Halloween Tracker halo horizontally instead of introducing a more complex new shape system, keeping the full vertical glow while pulling the underlay in from the sides.
- Regenerated the real halo plate with the narrower bounds and verified it in the live Gates of Hell route, where the underlay now hugs the glyph much more closely instead of bleeding far past the marked boundary.
- Validation: `node scripts/apply-town-glyph-halo.mjs --id=halloweentracker --dry-run` resolved the narrowed `98x140` halo box and `146x188` context crop; `GANGLIA_STUDIO_DIR=/Users/pacey/Documents/SourceCode/ganglia_repos/ganglia-core/ganglia-studio node scripts/apply-town-glyph-halo.mjs --id=halloweentracker` regenerated `/art/town/glyph-halos/halloweentracker.png`; fresh local deploy via `./scripts/deploy_app.sh` confirmed the tighter live stage render on `http://127.0.0.1:3740/gates-of-hell/halloweentracker?site_type=desktop`; `sm swab --no-cache` passed.

## Done (2026-05-27) — Halloween Tracker Glyph Halo Spike Works On The Live Map

- Added a first-pass glyph halo feature directly off the glyph manifest and tried it on Halloween Tracker instead of inventing a separate authoring manifest.
- Generated a real Halloween Tracker halo plate through Ganglia Studio from the Gates of Hell background crop, then rendered that plate directly above the district art and below the foreground glyph in the live town stage.
- Kept the spike deliberately simple: square halo bounds from the glyph width, one optional halo block in the glyph manifest, one apply script, one runtime layer.
- Validation: `node scripts/apply-town-glyph-halo.mjs --id=halloweentracker --dry-run` resolved the expected `140x140` halo box and `188x188` context crop; `GANGLIA_STUDIO_DIR=/Users/pacey/Documents/SourceCode/ganglia_repos/ganglia-core/ganglia-studio node scripts/apply-town-glyph-halo.mjs --id=halloweentracker` passed twice and wrote `/art/town/glyph-halos/halloweentracker.png`; `sm swab --no-cache` passed; fresh local deploy via `./scripts/deploy_app.sh` confirmed the halo layer renders under Halloween Tracker on `http://127.0.0.1:3740/gates-of-hell/halloweentracker?site_type=desktop`.

## Done (2026-05-27) — Reposition Coordinates Persistence & StopId Abstraction Removal

- Persisted the live-dragged coordinates for all 33 repositories in `lib/willville.heuristics.ts`, carefully retaining all visual `glyph` and `queue` definitions to prevent asset regression.
- Resolved a pipeline layout bug inside `lib/town.ts` where both `buildStop` (live path) and `buildInitialStops` (offline path) ignored the manual `heuristic.position` overrides and dynamically forced stops back to auto-calculated locations.
- Pulled out the `stopId` metaphorical translation layer entirely from the codebase, standardizing on lowercase repository names as the single source of truth for routing, layouts, and assets.
- Cleaned up dynamic routing slug generation in `lib/slugs.ts` and `app/[district]/[stop]/page.tsx`, and migrated the `"stopId"` mappings in `data/town-site-sprites.v1.json` and `data/canal-ship-sprites.v1.json` to use repository-centric IDs without breaking existing binary PNG paths.
- Renamed the bespoke sprite config file `the-reactor.tti.json` to `ganglia-core.tti.json` and resolved all unmigrated references inside `functions/api/canal.ts` and `functions/api/manifests.ts`.
- Validation: `npx tsc --noEmit` passed with zero errors; `npm run build` compiled all routes successfully with Next.js prerendering the new repository slugs; direct local deploy via `scripts/deploy_app.sh` succeeded at `http://127.0.0.1:3740/`.

## Done (2026-05-27) — Tourism Sign Reads In The Actual Town View

- Reworked the Department of Tourism art prompt so Ganglia Studio is required to render a big, high-contrast `DEPT. OF TOURISM` sign on the front of the building instead of suppressing readable text.
- Regenerated the tourism sprite, bumped the stage asset URL to `tourism-v2`, and scaled the Town Square landmark up so the sign is still legible in the live town view instead of only in the raw render.
- Validation: `GANGLIA_STUDIO_DIR=/Users/pacey/Documents/SourceCode/ganglia_repos/ganglia-core/ganglia-studio ./scripts/generate-bespoke-sprite.sh department-of-tourism --force --skip-manifest` passed; fresh local deploy via `./scripts/deploy_app.sh` confirmed the updated `tourism-v2` asset on `http://127.0.0.1:3740/?site_type=desktop`; live stage screenshot showed the marker grow from roughly `44px` to `60px`; `sm swab --no-cache` passed.

## Done (2026-05-27) — Department Of Tourism Gets Real Town Art

- Extended the bespoke sprite rail so special town-only landmarks can use the Ganglia Studio generation path without force-writing bogus stop manifest entries.
- Generated the Department of Tourism sprite through the real Ganglia Studio checkout and installed the finished 100x100 PNG into the town art set.
- Kept the updated hover copy as `add your own stop to Willville` and verified the tourism click still returns the Digital Detail board to its default `Select a site in Willville` state while Time Central flips over to the tourism pitch plus contact email.
- Validation: `GANGLIA_STUDIO_DIR=/Users/pacey/Documents/SourceCode/ganglia_repos/ganglia-core/ganglia-studio ./scripts/generate-bespoke-sprite.sh department-of-tourism --force --skip-manifest` passed; `sm swab --no-cache` passed; local browser verification on `http://127.0.0.1:3740/?site_type=desktop` confirmed the sprite render, hover copy, empty Digital Detail board state, and the Time Central tourism announcement with `unique.will.martin@gmail.com`.

## Done (2026-05-27) — Town Square Gets A Department Of Tourism

- Added a special Town Square landmark for the Department of Tourism in the same non-repo landmark lane as the other town-only interactions, with hover copy that says `Come visit Willville!`.
- Clicking the tourism kiosk now clears the selected stop, routes back to the town overview, restores the desktop Digital Detail board to its default `Select a site in Willville` empty state, and swaps Time Central over to the tourism pitch plus contact email.
- Finished the landmark extraction properly by routing the bell, egg, Hollywood sign, and tourism kiosk through the shared `SpecialTownLandmarks` component instead of leaving a stale inline landmark block in `TownStage`.
- Validation: `sm swab -g myopia:code-sprawl --no-cache` passed; `sm swab --no-cache` passed; local browser verification on `http://127.0.0.1:3740/?site_type=desktop` confirmed the tourism hover text, the empty Digital Detail board state, and the updated Time Central tourism announcement.

## Done (2026-05-27) — Prod Custom Domain Falls Back To Pages API

- Confirmed the production mismatch was not the town merge logic: the real domain was serving `404` HTML for `/api/town` while the Pages hostname still returned live JSON, so the UI stayed on the empty static fallback.
- Added a client-side retry path for the town, bell, and canal requests so the custom domain can fall back to the known-good Pages API host when same-origin `/api/*` misses.
- Added explicit cross-origin headers on the Pages town, bell, and canal responses so that fallback can be read from the custom domain instead of dying at the browser boundary.
- Validation: `npm run build` passed; `npx wrangler pages functions build functions --project-directory . --outdir /tmp/willville_pages_validation_$$ --output-routes-path /tmp/willville_pages_validation_routes_$$.json --build-output-directory out` passed; live probes still show `https://willville.ai/api/town -> 404` and `https://welcome-to-willville.pages.dev/api/town -> 200`, which is the split this patch works around.

## Done (2026-05-27) — Bell Couriers Hold, Thrum, And Return Per Site

- Reworked the bell courier animation so the yellow messengers no longer vanish after the initial fan-out: they now orbit each site and keep a live thrum bed going until that site's manifest write finishes, then flip green and head back individually.
- Updated the bell endpoint to stream per-site completion events instead of only returning one final aggregate payload, so the courier return timing is tied to actual site completion rather than a fake global delay.
- Removed the old bottom-right refresh icon and reused that corner slot for the mobile digital-detail panel toggle, so stop routes now expose the bottom pane with the eye control instead of the centered `Open details` pill.
- Validation: touched-file diagnostics were clean; `./scripts/deploy_app.sh` passed on `http://127.0.0.1:3750/`; the 390px stop route reported `showDetailButton: true` and `refreshButton: false`; a bell probe at the 2.8s hold window saw `yellowCount: 14`, `greenCount: 19`, and moving particle transforms before the run settled into the fully green return leg.

## Done (2026-05-27) — Mobile Layout And Pan Work Across Browser Paths

- Stopped forcing touch-only drag events on the town camera so the headed mobile-emulation browser can pan with an ordinary click-drag while real touch input still works.
- Broadened the mobile layout gate from a strict coarse-pointer test to a responsive-width-or-touch check, so narrow embedded browsers like the VS Code preview now take the mobile board path instead of falling back to the desktop split-flap board.
- Validation: `./scripts/deploy_app.sh` passed on `http://127.0.0.1:3750/`; a Playwright mobile-emulated mouse drag changed the camera transform from `translate(-420 -315) scale(1.35)` to `translate(-274.9763033175361 -221.16113744075847) scale(1.35)`; the shared 390px browser tab reported `mobileBoard: true` and `desktopBoard: false`; touched-file diagnostics were clean.

## Done (2026-05-27) — Mobile Drag Panning Works Again

- Moved the camera gesture target onto the actual stage SVG instead of the outer wrapper so phone drags land on the element the user is touching.
- Added `touch-action: none` directly to the stage SVG so mobile browsers stop trying to own the pan gesture before the camera hook sees it.
- Validation: touched-file diagnostics were clean; `./scripts/deploy_app.sh` passed on `http://127.0.0.1:3750/`; a Playwright mobile-emulated drag probe in a `390x844` `hasTouch` context changed the camera transform from `translate(-420 -315) scale(1.35)` to `translate(-274.9763033175361 -221.16113744075847) scale(1.35)`; cleanup via `./scripts/deploy_app.sh --stop` passed.

## Done (2026-05-27) — Deploy Script Can Launch Mobile Preview

- Added `--mobile` to the local deploy script so it still does the normal build + wrangler launch, then hands off to the existing headed mobile preview flow instead of making you run a second command.
- The mobile deploy path defaults to the root route on an iPhone 14 view, while still forwarding explicit mobile preview args like `--path` and `--device`.
- Updated the deploy usage note so the new entry point shows up where agents look for the sanctioned local run command.
- Validation: `bash -n scripts/deploy_app.sh` passed; `./scripts/deploy_app.sh --help` shows the new `--mobile` usage; `./scripts/deploy_app.sh --mobile --device iphone-14 --path /` built the app, started the local preview on `http://127.0.0.1:3750/`, and launched the headed iPhone 14 mobile session before cleanup via `./scripts/deploy_app.sh --stop`.

## Done (2026-05-27) — Mobile Detail Panel Stays Closed And Stacks Cleanly

- Stopped the route-sync path from auto-opening the digital detail display on initial load, so the panel stays hidden until the user intentionally selects a site.
- Reworked the mobile detail board rows into a true single-column stack inside the drawer, so fact rows and activity rows no longer squeeze text into side-by-side badge/value columns.
- Let the mobile drawer body own the scroll behavior with touch-friendly overflow so long sections can keep flowing instead of clipping at the section boundary.
- Validation: touched-file diagnostics were clean; `npm run build` passed; `scripts/mobile_preview.sh --path / --output /tmp/willville-mobile-followup-root-managed` and `scripts/mobile_preview.sh --path /town-square/willville-town-hall/ --output /tmp/willville-mobile-followup-stop-managed` both passed; refreshed iPhone screenshots confirmed the root route still loads without the detail display and the selected-stop route now shows the `Open details` CTA instead of auto-opening the panel on load.

## Done (2026-05-26) — Mobile Gets Its Own Board, Drawer, And Framing

- Hid the detail board by default so it does not appear until a site is purposefully selected.
- Added a dedicated mobile Time Central board with shorter rows/columns, mobile-specific labels, and top-mounted controls that no longer collide with the header.
- Replaced the desktop-style mobile detail panel with a bottom drawer shell and a stacked list-style detail board that is meant to be pulled up instead of reading like a squeezed desktop SPOG.
- Changed the mobile stage framing so the phone view opens on the town itself instead of showing the wider desktop world composition.
- Validation: touched-file diagnostics were clean; `npm run build` passed; `scripts/mobile_preview.sh --url http://127.0.0.1:3760 --path / --output /tmp/willville-mobile-check-root-final` and `scripts/mobile_preview.sh --url http://127.0.0.1:3760 --path /town-square/willville-town-hall/ --output /tmp/willville-mobile-check-stop-final` both passed; refreshed iPhone screenshots confirmed the root mobile view now hides details by default and the selected-stop route now uses the bottom drawer + compact mobile board layout.

## Done (2026-05-26) — Site Buildings Are The Marker

- Removed the extra colored dot from sprite-backed site markers so the building art is the only visible site marker.
- Centered each building sprite on the stop coordinate and centered the selected focus rings on that same point, so the ring wraps the building instead of landing offset below it.
- Validation: touched-file diagnostics were clean; `npm run build` passed; `./scripts/deploy_app.sh` passed on `http://127.0.0.1:3752/`; browser geometry checks confirmed sprite images and focus rings share the same center and sprite-backed stops no longer render the old dot.

## Done (2026-05-26) — Bell Noise Helper Deduplicated

- Moved the procedural audio noise buffer helper into one shared module so bell messenger sounds and board rustle sounds no longer carry separate copies that can drift.
- Preserved the existing tuning values at each call site while sharing the buffer generation path.
- Validation: touched-file diagnostics were clean; `npm run build` passed; `sm swab -g laziness:sloppy-formatting.js --no-cache` passed.

## Done (2026-05-26) — Dead-Code Gate Barnacle Filed

- Filed ScienceIsNeato/slop-mop#226 because the JavaScript dead-code gate is still reporting entries that the repo Knip config excludes, including Pages Function files and `prettier`.
- Kept the gate enabled rather than weakening the repo checks; the local app build, npm install dry-run, and Pages Functions bundle step all pass while the slop-mop issue is tracked upstream.
- Current PR state: review feedback is resolved; the remaining external blocker is the Cloudflare Workers Builds check, which does not expose logs through the local buff rail.

## Done (2026-05-26) — Town Art Loads Use Cropped Render Assets

- Replaced the full-canvas district art render path with cropped WebP render assets sized to each actual district region.
- Kept the lightweight generated isthmus image underneath the district layers so the town has a complete visual fallback while the richer regional art finishes loading.
- Added a project script to regenerate those cropped render assets after district art changes.
- Validation: generated district render assets dropped the district art payload from roughly 66MB to 3.9MB before browser decode; touched-file diagnostics were clean.

## Done (2026-05-26) — Heuristic Stops Use Repo Names

- Removed custom stop display names from the repo heuristic list so fallback stop labels now come from the repository name instead of a second hand-maintained title.
- Updated stop building so live and static fallback stops use the repo slug unless a manifest explicitly provides a project display name.
- Updated the Digital Detail Board to lead with the repository name and removed the redundant full owner/repo line beneath it.
- Expanded the timestamp labels to `Last Commit` and `Last Merged` now that the fact column has room.
- Validation: touched-file diagnostics were clean; `npm run build` passed; `./scripts/deploy_app.sh` passed on `http://127.0.0.1:3750/`; browser probe confirmed the Town Hall digital display now shows `welcome-to-willville` and no longer shows `Willville Town Hall`.

## Done (2026-05-26) — Digital Board Readability Tuning

- Tuned the Digital Detail Board so long-form body text is smaller, scrollable, and no longer clipped by fixed-height text regions.
- Styled board scrollbars to match the terminal-green display and reserved space so panel controls no longer sit over the activity text.
- Changed default panel opacity: split-flap board now starts at 35%, Digital Detail Board starts at 75%.
- Relabeled commit activity as `Commits 3/7/21d` and widened the fact label column so the time-window label and values fit cleanly.
- Validation: touched-file diagnostics were clean; `./scripts/deploy_app.sh` passed on `http://127.0.0.1:3750/`; browser probe confirmed opacity defaults, 13px rendered body text, scrollable sections, styled scrollbar colors, and the commit label/value layout.

## Done (2026-05-26) — Static Export Uses Multiple Workers In CI

- Fixed the build path that could fall back to `Generating static pages using 1 worker` in constrained environments.
- Configured Next static generation to use a default 4-worker pool, with `NEXT_STATIC_GENERATION_WORKERS` available for CI/local tuning, and lowered the per-worker page batch size so this 46-page export actually spreads across the pool.
- Validation: `npm run build` reported `Generating static pages using 4 workers (46/46)`; `./scripts/deploy_app.sh` completed successfully on `http://127.0.0.1:3750/`; smoke checks returned `200` for `/` and `/api/town`.

## Done (2026-05-26) — Local Deploy No Longer Depends On Google Fonts

- Fixed `deploy_app` failing during `next build` when the environment could not reach Google Fonts for the Next font optimizer.
- Removed the build-time `next/font/google` dependency and defined the existing font CSS variables as local system font stacks instead.
- Validation: touched-file diagnostics were clean; `./scripts/deploy_app.sh` completed successfully and served `http://127.0.0.1:3750/`; smoke checks returned `200` for `/` and `/api/town`.

## Done (2026-05-26) — Bell Refresh Tracks Willville Packet Source

- Added source metadata to displayed `.willville.json` agent packets so each packet now carries the branch, branch head commit, and file blob SHA it came from.
- Updated active-branch discovery to retain the latest push head SHA, and threaded that through the town API into each stop.
- Updated bell-board change detection so a repo is marked updated when its active branch changes, active branch commit changes, or the displayed `.willville.json` packet source/blob changes.
- Made bell toll and manual sync refreshes bypass cached `/api/town` responses so packet changes are checked immediately after the bell work finishes.
- Validation: touched-file diagnostics were clean; `npm run build` passed.

## Done (2026-05-25) — District Art No Longer Clipped By Landscape Mask

- Fixed the missing edge chunks in The Graveyard, The Gates of Hell, and Slop Wharf by separating the broad landscape `landPath` mask from the district/town art clipping path.
- Updated `GeneratedTownBase` so runtime district layers clip to the computed `townFootprintPath` instead of the newer landscape land mask, which had been cutting off coastal district pieces.
- Updated the mask contract generator so district masks, canal banks, and district wall masks use the town footprint clip while the landscape layer can keep using `landPath`.
- Reapplied corrected masks to the affected district art. The available PNG history preserved enough pixels to recover most of the missing regions; a small amount of already-zeroed transparent RGB had to be filled from neighboring art pixels rather than restored from an original raw source.
- Validation: touched-file diagnostics were clean; `node scripts/generate-town-mask-contract.mjs` completed successfully; remask previews no longer show black cutout chunks in the affected district layers.

## Done (2026-05-25) — Per-Panel Eye Toggles + Independent Opacity Controls

- Replaced the old detached `TownStageControls` overlay with panel-mounted chrome controls so each large board now owns its own visibility toggle and opacity control in the upper-right corner.
- Split the old shared `panelOpacity` state into independent top/bottom opacity values, so fading the Time Central board no longer changes the Digital Detail Board and vice versa.
- Added hidden-state restore pills anchored to each panel slot so a fully hidden panel can still be re-opened without bringing back the old global control bar.
- Validation: `npm run build` passed; `./scripts/deploy_app.sh` rebuilt and served on `http://127.0.0.1:3750`; browser validation on `/halls-of-judgement/the-mystery-manor/` confirmed top opacity can be set to `0.61` while bottom stays `0.94`, bottom opacity can then be set independently to `0.47`, and each hidden panel leaves behind a working `Show ... panel` restore control while the other panel stays visible.

## Done (2026-05-25) — Time Central Board Fill + Justification Fix

- Fixed the split-flap formatting path in `components/CentralBoard.tsx` so centered rows stay centered all the way through render instead of being re-normalized back to left-justified at the last step.
- Kept numbered list rows left-justified while centering non-list rows, including stop-detail narrative lines and section headers.
- Widened the Time Central board shell to match the Digital Detail Board width and changed each split-flap row to use full-width flexible columns, removing the internal left/right letterboxing.
- Validation: `npm run build` passed; local browser checks showed the top board width equals the bottom board width (`838px` vs `838px` on the sampled route), centered narrative rows begin several cells in (`row0FirstFilled: 3`, `row2FirstFilled: 4` on a stop page), and numbered list rows still start at column `0` on a district page.

## Done (2026-05-25) — Panel Slider No Longer Dims Board Text

- Reworked the top and bottom board opacity control so it no longer applies element-level `opacity` to `CentralBoard` or `DigitalDetailBoard`.
- The slider now changes board chrome alpha only: backgrounds, borders, glows, and panel surfaces fade, while the actual text and labels on both boards stay fully opaque.
- Validation: touched-file diagnostics were clean; `npm run build` passed; search confirmed there are no remaining `opacity: panelOpacity` paths in the board components.

## Done (2026-05-25) — Restored District Art + Added Panel Opacity Slider

- Corrected the mobile-safe art regression by restoring `GeneratedTownBase` to always render the actual district art layers instead of swapping to the flat topology source image, which was why the town suddenly looked like the images disappeared.
- Tightened the mobile-safe media query in `components/TownStage.tsx` so the lighter render path only engages on actual touch/coarse devices (`pointer: coarse` and `hover: none`) instead of catching ordinary desktop/narrow-window use.
- Added a shared `Panel opacity` slider in the top-left stage controls and threaded its value into both `CentralBoard` and `DigitalDetailBoard`, so the top and bottom chrome can be faded without touching the world layer.
- Fixed the opaque blue top/bottom bands by letting the map render behind the full stage while keeping the boards in their top and bottom slots, so panel transparency now reveals the map instead of a separate layout row background.
- Validation: touched-file diagnostics were clean; `npm run build` passed; local browser probe confirmed the town base is back to 8 district art images and the slider is present with a default value of `94`; overlay screenshot verification confirmed the top and bottom panels now show the map behind them instead of blue banners.

## Done (2026-05-25) — Mobile Safe Render Path For iOS Crash Triage

- Added a mobile-safe render path in `components/TownStage.tsx` that activates on coarse/small screens and swaps the town art stack to a lighter mode instead of always rendering the full desktop scene.
- Updated `components/GeneratedTownBase.tsx` so mobile-safe mode uses the single composite town image (`/art/town/willville-isthmus-v1.png`) instead of stacking every district PNG layer at once.
- Trimmed the heaviest decorative/animated layers in mobile-safe mode by skipping chimney smoke, dynamic walls, canal traffic animation, world-worker animation, and the Hollywood sign while keeping the core town, stops, and interaction surfaces intact.
- Validation: touched-file diagnostics were clean; `npm run build` passed; forced mobile-safe browser validation confirmed the rendered town base drops from 8 SVG image layers to 1 and removes the worker/smoke layers; production redeploy succeeded at `https://a227e912.welcome-to-willville.pages.dev`, and both that deployment and the custom-domain edge now return `200` for `/` and `/api/town`.

## Done (2026-05-25) — Pages Domain Attach Attempt + Fresh Production Deploy

- Attached `willville.ai` to the `welcome-to-willville` Cloudflare Pages project directly through the Cloudflare API after confirming Wrangler has no Pages custom-domain CLI for this path.
- Re-deployed the latest local build, including the mobile viewport hardening, with the corrected Pages bundle flow; the current healthy production deployment is `https://3f0d4b7f.welcome-to-willville.pages.dev` and it serves the app plus `/api/*` correctly.
- The custom domain is still not cut over yet: the Pages domain object remains `status: initializing` with `verification_data.error_message: "CNAME record not set"`, which explains why `https://willville.ai/` still serves shell HTML while `https://willville.ai/api/town` remains a 404.
- Re-checked the local perf harness on a phone-sized viewport and confirmed it is not a reliable primary repro rail yet because `window.__willvillePerf.runOfficialProfile()` still fails to populate a `getLastReport()` result under Playwright mobile emulation.
- Validation: direct `wrangler pages deploy` succeeded at `https://3f0d4b7f.welcome-to-willville.pages.dev`; Pages domain API confirms the attach exists; live custom-domain probe still shows `town 404` while verification is pending.

## Done (2026-05-25) — Mobile Viewport Stabilization + Prod Domain Split

- Patched `app/globals.css` so the app shell uses stable/dynamic viewport units (`100svh` / `100dvh`) instead of relying only on raw `100vh`, which is a likely iOS Safari trigger for flash/resize/collapse behavior when browser chrome changes height.
- Local mobile-sized sanity check on `http://127.0.0.1:3752/` stayed stable for the initial load window with no console or page errors, so the viewport contract is healthier even though I still do not have a hard Chromium repro of the device-only white-frame failure.
- Verified the production bell problem is a separate domain/routing issue: `welcome-to-willville.pages.dev` serves `/api/town` correctly, but `https://willville.ai/api/town` and `https://willville.ai/api/manifests` still return 404, and Cloudflare `pages project list` shows no `willville.ai` custom domain attached to the Pages project.
- Validation: local rebuild via `./scripts/deploy_app.sh` passed; direct mobile browser sanity check passed; `sm swab` only failed on the pre-existing `laziness:dead-code.js` backlog, not on the viewport or deploy changes.

## Done (2026-05-25) — Pages Deploy Foot-Guns Split And Fixed

- Confirmed the recurring Cloudflare deploy failures were two separate problems that looked similar in logs: repo `wrangler.toml` was Pages-invalid because of `[assets]`, and the workflow was using deprecated `wrangler pages functions build --outfile`, which writes a multipart upload payload instead of a deployable worker script.
- Unstuck production deploys from the CLI by building the app, compiling Pages Functions with `--outdir`, copying `index.js` to `out/_worker.js` plus `_routes.json`, and running `wrangler pages deploy ... --cwd /tmp` so Wrangler never reads the repo config while deploying.
- Updated `.github/workflows/deploy-pages.yml` to use that same supported path and removed `[assets]` from `wrangler.toml` so repo-local Pages commands stop tripping over an invalid mixed config.
- Validation: direct CLI deploy succeeded at `https://ed3689b1.welcome-to-willville.pages.dev`, then the post-fix repo-cwd deploy path also succeeded at `https://1351d0c7.welcome-to-willville.pages.dev`; `sm swab` passed. `https://willville.ai/api/town` still returns 404, which now appears to be a separate custom-domain/routing issue rather than the broken Pages bundle path.

## Done (2026-05-25) — Digital Board Truncation Hover Titles

- Updated `components/DigitalDetailBoard.tsx` so clipped text on the Digital Detail Board now exposes the full string on hover via native `title` attributes.
- Covered the truncation-heavy surfaces directly: panel headers, metric values, branch names, recent commit subjects, GitHub Actions workflow names, and the Status/Direction text blocks.
- Validation: rebuilt with `./scripts/deploy_app.sh`, then verified on `http://127.0.0.1:3752/town-square/willville-town-hall/` that recent commit rows, workflow rows, long status/direction text, panel headers, and the branch link all carried the expected full hover text; `sm swab` also passed.

## Done (2026-05-25) — Recent Commits Replaced Canal Panel

- Replaced the Digital Detail Board's top-right Canal/PR list with a Recent Commits panel so each stop now shows the latest commit subjects in reverse chronological order.
- Threaded `recentCommits` through `functions/api/town.ts` and `lib/town.ts` by reusing the existing GitHub commits endpoint that already powers the 3d/7d/21d activity counts, so this change did not add an extra repo API round-trip.
- Validation: rebuilt with `./scripts/deploy_app.sh`, then verified on a fresh `http://127.0.0.1:3752/town-square/willville-town-hall/` page that the board rendered `Merge pull request #9 from ScienceIsNeato/codex/isthmus-town-generation`, `buff: address town interaction review`, and `fix: declare worker static assets` under `Recent Commits`; `sm swab` also passed.

## Done (2026-05-25) — Dense Stop Marker Click Targets No Longer Cross-Select

- Fixed the repo-selection bug in dense districts by tightening `StopMarker` click targets to the visible label and sprite instead of one tall invisible rectangle that could overlap neighboring stops.
- This was the root cause behind Slop Wharf repos sometimes opening the wrong board content, because overlapping marker hitboxes let a nearby stop intercept clicks even when the visible label or sprite belonged to another repo.
- Validation: rebuilt with `./scripts/deploy_app.sh`, then ran a browser DOM probe against the live `http://127.0.0.1:3752/slop-wharf/the-rulebook/` page to confirm the `text`, `image`, `circle`, and label hitbox centers for `the-mop-bucket`, `the-action-dock`, `the-slop-bucket`, and `the-rulebook` all resolve to their own stop IDs; `sm swab` also passed.

## Done (2026-05-25) — Local Token Verification For Town Data

- Rebuilt the app after rotating the local GitHub token and verified the live `welcome-to-willville` stop payload from `/api/town` now reports `openPrCount: 1` and three recent CI workflow runs.
- Confirmed the stop still carries the expected owner-facing `status.doing` / `status.next` text after the token change.
- Production `https://willville.ai/api/town` is still returning a raw 404, so the missing live data there is a deployment/merge problem now, not a remaining local token-permissions problem.

## Done (2026-05-25) — Canal Panel Fallback + Local Rebuild Refresh

- Fixed `components/DigitalDetailBoard.tsx` so the Canal panel no longer goes blank when the selected stop has no repo-local PRs; it now falls back to the live town-wide canal traffic while keeping repo-specific PR metrics unchanged.
- Rebuilt the local app with `scripts/deploy_app.sh`, which refreshed the stale exported `out/` pages that were still showing the older `Activity Log` / `No recent agent actions.` copy.
- Validation: `./scripts/deploy_app.sh` rebuilt and served on `http://127.0.0.1:3752/`; browser verification on the `welcome-to-willville` stop showed canal entries and the `GitHub Actions` panel title in the rendered UI.

## Done (2026-05-25) — PR #10 Final Review Fix: Preserve Fallback Manifest Values

- Fixed `mergeSection` in `functions/api/town-manifests.ts` so preferred manifest sections only overwrite fallback values when the preferred property is actually defined.
- This restores the intended active-branch/PR/default-branch backfill behavior for `project`, `status`, and `queue` fields even though the parser emits explicit `undefined` keys for missing values.
- Validation: `activate && sm swab --no-cache --json --output-file .slopmop/last_swab_merge_section_fix.json` passed.

## Done (2026-05-25) — PR #10 Final Review Fix: Bell Announcement Snapshot Baseline

- Fixed `handlePopulate` in `components/TownStage.tsx` so the bell announcement compares a frozen pre-refresh `currentStops` snapshot against refreshed data merged onto that same baseline.
- This removes the stale-data mismatch where the "before" side used prior live state while the "after" side merged the fresh payload against the original static `stops` prop.
- Validation: `activate && sm swab --no-cache --json --output-file .slopmop/last_swab_bell_snapshot_fix.json` passed.

## Done (2026-05-25) — PR #10 Final Review Fix: Shared CentralBoard Dimensions

- Removed the duplicated split-flap board dimension constants by introducing `components/centralBoardConstants.ts` as the shared source of truth for board columns, rows, and the empty row string.
- Updated both `components/CentralBoard.tsx` and `components/townStageUtils.ts` to consume the shared constants so bell-board announcements cannot silently drift out of sync with the split-flap renderer.
- Validation: `activate && sm swab --no-cache --json --output-file .slopmop/last_swab_shared_board_constants.json` passed.

## Done (2026-05-25) — GitHub Workflow Runs Replace Manifest Actions

- Corrected the Willville packet contract so `.willville.json` only carries owner-facing `agent.status` and `agent.direction`, not an authored actions list.
- Updated the Digital Detail Board Activity Log to render the last 3 GitHub Actions workflow runs with status chips and links from `/api/town` instead of reading manifest `agent.actions`.
- Added workflow-run fetching in `functions/api/town.ts`, threaded `workflowRuns` through `lib/town.ts`, and kept the bell refresh path aligned because the bell already reloads `/api/town` after sync.
- Updated the repo-local Willville skill guidance to stop teaching `actions` in committed packets.
- Validation: `activate && sm swab --no-cache --json --output-file .slopmop/last_swab_actions_runtime_fix.json` passed.

## Done (2026-05-25) — PR #10 Review Fixes: Preview Output + Manifest Overrides

- Fixed the preview generator regression in `scripts/generate-town-layout-preview.mjs` by restoring the resolved SVG output path so the script no longer throws a `ReferenceError` on `output`.
- Updated `buildStop` in `lib/town.ts` so validated manifest project overrides now win for `district`, `lines`, and `visibility` before position/layout are computed.
- Swapped blocker precedence so `status.blockers[0]` from the current manifest schema wins over legacy `agent.difficulties`, keeping blocker behavior aligned with `summary`, `next`, and `updated`.
- Validation: `activate && node scripts/generate-town-layout-preview.mjs` wrote the preview SVG successfully; `activate && sm swab --json --output-file .slopmop/last_swab_pr10_review_fixes.json` passed.

## Done (2026-05-25) — Pages Functions Deploy Repair + Bell Error Diagnostics

- Production investigation showed `https://willville.ai/api/town`, `/api/canal`, and `/api/manifests` all returning 404, so the live failure was missing Pages Worker routes, not a confirmed PAT problem.
- Updated `.github/workflows/deploy-pages.yml` to run `wrangler pages functions build` and emit `out/_worker.js` plus `out/_routes.json` before `pages deploy ./out ...`.
- Updated the README deploy section so it reflects the actual production path instead of claiming raw `functions/` are bundled implicitly.
- Updated `components/TownStage.tsx` so bell failures surface the actual response reason: missing deploy routes on 404, missing `GITHUB_PAT` on the known 403 payload, or the returned HTTP/message detail otherwise.
- Validation: `npx wrangler pages functions build functions --project-directory . --outfile out/_worker.js --output-routes-path out/_routes.json --build-output-directory out` emitted both worker artifacts; `activate && sm swab --json --output-file .slopmop/last_swab_prod_api_fix.json` passed.

## Done (2026-05-25) — Willville Skill Install + Owner-Facing Packet Guidance

- Rewrote the Willville skill guidance so `.willville.json` updates are written for the repo owner, not as newcomer-facing repo introductions.
- Installed the canonical workspace skill under `.github/skills/willville/SKILL.md` and wired repo `CLAUDE.md` to include that repo-local skill.
- Updated the global Copilot and Claude Willville guidance, repo Claude plugin metadata, and the repo's own `.willville.json` packet to the leaner owner-facing shape.
- Removed the stale root-level `skills/willville/SKILL.md` copy so the repo has one canonical skill path instead of a dead duplicate.
- Validation: confirmed `.github/skills/willville/SKILL.md` is the only repo-local Willville skill file, `CLAUDE.md` references it, and `.willville.json` parses through `WillvilleManifestParser` with only the owner-facing `agent.status` / `agent.direction` metadata present.

## Done (2026-05-25) — Split-Flap Tightening + Canal Slot Restore

- Tightened the Time Central split-flap board by switching from wide fractional cells to narrower fixed-width flap columns with smaller gutters and padding.
- Removed the horizontal character stretch so the board text sits on a tighter monospace rhythm instead of looking artificially spread apart.
- Restored the Canal list to a dedicated upper-right panel in the Digital Detail Board instead of leaving it down in the lower action row.
- Validation: `./scripts/deploy_app.sh` passed and served on `http://127.0.0.1:3750/`; `activate && sm swab --no-cache --json --output-file .slopmop/last_swab_flap_spacing_and_canal_slot.json` passed.

## Done (2026-05-25) — Board Compaction + Hidden Pane Behavior

- Removed the ETA field from the Digital Detail Board and folded Active Branch into the Primary Metrics panel.
- Dropped the third top-row panel entirely so the board now uses a two-panel top row.
- Moved the Canal list back into the lower action row instead of giving it a dedicated full-width row, reducing the board height.
- When a site is opened while either board is hidden, TownStage now re-opens both boards automatically.
- When both large boards are hidden, the stage switches to a full-screen map presentation so the world view fills the screen instead of leaving a large banner/letterbox gap.
- Validation: `./scripts/deploy_app.sh` passed and served on `http://127.0.0.1:3750/`.

## Done (2026-05-25) — Pane Toggle Controls

- Added simple on-page toggle controls for the two large chrome panes in TownStage.
- Time Central can now be shown/hidden independently from the lower Digital Detail Board.
- The toggles live in the stage overlay so they remain accessible even when one of the panes is hidden.
- Removed the Digital Detail Board Milestone, Difficulties, and Needs Human fields from the board UI.
- Validation: `./scripts/deploy_app.sh` passes and serves on `http://127.0.0.1:3750/`; `activate && sm swab --no-cache --json --output-file .slopmop/last_swab_pane_toggle_controls.json` passed.

## Done (2026-05-25) — Manifest Ref Merge For Repo Status

- Updated the town manifest client to merge `.willville.json` sections across active-branch, PR, and default-branch refs instead of stopping at the first manifest file found.
- This preserves current `project/status/queue` data from the active branch while backfilling missing owner-facing `agent` status/direction fields from later refs.
- Corrected stop status precedence so fallback `agent.status` does not overwrite newer `status.summary` and `status.next` text from the active branch manifest.
- Validation: `./scripts/deploy_app.sh` passes; live `/api/town` for `ScienceIsNeato/slop-mop` now returns queue milestone `v1.1 release` plus current summary/next text dated `2026-05-25` from the merged manifest path.

## Done (2026-05-25) — Repo Display Data + Perf Overlay Fixes

- Fixed the Digital Detail Board so repo metrics no longer hardcode placeholder values for branches, last merge, and release.
- Added live GitHub-backed repo signals to `/api/town`: open PR count, branch count, latest merged PR timestamp, and latest release metadata.
- Corrected issue counts to exclude open pull requests, since GitHub's repo `open_issues_count` includes both.
- Updated `.willville.json` parsing to understand the current `project/status/queue` schema instead of only the older legacy `agent` block.
- The slop-mop stop now reads the active branch packet correctly: summary/status text, next-step direction, blockers, milestone, active branch, branch count, last merge, and latest release all flow through the live stop payload.
- Moved the perf panel to a fixed high-z overlay so it sits above the rest of the page chrome.
- Validation: `sm swab --no-cache --json --output-file .slopmop/last_swab_repo_display_fix.json` passed; `./scripts/deploy_app.sh` built and served successfully; local `/api/town` verification for `ScienceIsNeato/slop-mop` now returns `displayName: The Mop Bucket`, `openIssues: 15`, `openPrCount: 1`, `branchCount: 16`, `lastMergeAt: 2026-05-25T05:07:51Z`, `latestRelease: v1.3.2`, and active branch `gang-press-discharge`.

## Done (2026-05-25) — Official Town Perf Profile

- Added an in-app official performance profiling flow for the town camera interaction.
- `?perf=1` shows a dedicated report panel; `?perf=1&autorun=1` runs the scenario automatically.
- Restored the app-wide zoom ceiling; the lower zoom cap now applies only to the perf scenario.
- The scenario now replays a fuller user journey through real UI surfaces instead of camera setters directly: two region double-click zooms, two site clicks, wheel zoom out, drag pan, wheel zoom into a new region, region label click, Time Central shortcut click, zoom to the test cap, pan, then full zoom out.
- Added a `settleWait` phase so delayed zoom animation time shows up explicitly in the report.
- Added JSON download support and a page-level `window.__willvillePerf` hook for automated verification.
- Validation: `activate && sm swab --no-cache --json --output-file .slopmop/last_swab_user_journey_clean.json` passed; `scripts/deploy_app.sh` succeeded; browser verification produced a full user-journey report and confirmed non-perf zoom still exceeds the perf cap.

## Done (2026-05-25) — Barnacle Filed For Swab Diagnostics

- Filed upstream slop-mop barnacle for the contradictory `laziness:sloppy-formatting.js` failure that reported `location unknown`, logged only a generic ESLint count, and then passed from cache on targeted rerun.
- Issue: https://github.com/ScienceIsNeato/slop-mop/issues/220

## Done (2026-05-25) — Bell Sync Board Announcement

- Added a temporary Time Central Station board override when the Town Square bell triggers manifest refresh.
- The board now briefly lists updated repos and Mayor's Express route changes after refresh.
- If nothing changed, the board shows a brief `NO RECENT CHANGES` / route-steady message, then returns to its previous content.
- Validation: `activate && sm swab` passes; `scripts/deploy_app.sh` builds and serves successfully; browser verification confirmed the board flashes the sync message and then reverts.

## Done (2026-05-25) — Started UI Cleanup Branch

- Confirmed the previous temp branch tip matched `origin/main` at `d8902e6`.
- Replaced local branch `codex/tweaks-20260525` with `codex/ui-cleanup-20260525`.
- Preserved all local UI-related working tree changes while resetting branch context for cleanup work.

## Done (2026-05-22) — PR #9 Buff Loop

- **PR:** [#9 Build isthmus town generation and world art](https://github.com/ScienceIsNeato/welcome-to-willville/pull/9) on `codex/isthmus-town-generation`.
- **CI fix:** `72c3afd` — ignore `.venv/**` in ESLint so CI `sm scour` passes after Python venv setup.
- **Bugbot batch:** `7214acc` — fork PR ref guard, edge cache headers, heuristic `displayName`, deploy PID/stale cleanup, dead clipPath + unused prop removal.
- **Review threads:** all 8 Bugbot threads resolved via `sm buff resolve`; `sm buff verify 9` clean.
- **CI now:** `verify` ✅, `Cursor Bugbot` ✅; `Workers Builds` ❌ (also fails on `main` — Cloudflare integration, not introduced by this PR).
- Local validation: `sm swab`, `sm scour`, `npm run build` pass on branch tip.

## Done (2026-05-21) — Isthmus Town Generation Foundation

- **Town topology:** Replaced the old circular island direction with a Rio-inspired isthmus town concept: continuous land bridge, sea on both sides, southern canal, distinct districts, and a separate top-layer Hollywood-style `WELCOME TO WILLVILLE` sign.
- **Shared geometry source:** Added `data/town-layout.v1.json` as the layout source of truth for sparse vertices, generated district topology, canal segments, landmarks, generation parameters, and transit paths.
- **Deterministic district boundaries:** Added a shared layout engine in [lib/town-layout-engine.mjs](lib/town-layout-engine.mjs) that turns sparse shared edges into deterministic sampled squiggle boundaries. Adjacent districts share the same generated edge geometry in reverse order, preserving exact overlap while producing gerrymander-style borders.
- **App integration:** Routed district fills, hit zones, wall loops, stop placement, canal data, and service routes through generated layout geometry instead of old hardcoded heuristics.
- **Wall tuning:** Reworked animated wall borders to be slower, thinner, calmer, and less artifact-prone while preserving a visible stone/brick texture.
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

# test

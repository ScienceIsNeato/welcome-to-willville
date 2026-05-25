# Willville Art Brief (Ganglia Studio)

Profile: `ganglia-studio`

Use generated masks, region briefs, and site briefs as controlled inputs for Ganglia Studio asset production.

## Global Direction

Willville is a Rio-inspired coastal project town on a narrow isthmus: bright masonry, steep terrain, ocean edges, a southern winding canal, dense neighborhoods, retaining walls, bridges, stair streets, and a prominent Hollywood-style "Welcome to Willville" sign on the northern hillside.

The generated layout in `data/town-layout.v1.json` is the source of truth. Art may add texture, detail, lighting, and personality, but must preserve land shape, district boundaries, canal path, wall loops, site anchor intent, and the sign location.

The world backdrop contract in `docs/generated/town-world-backdrop.v1.json` defines the registered whole-land mask for the visible isthmus. Use `docs/generated/town-region-art-prompts/world-landscape.md` for the Ganglia Studio prompt: South American coastal topography, mountains on the west coast, beaches on the east, and a style match to the existing district art. Do not fall back to procedural grids, repeated tiles, or generic countryside.

The canal is its own generated section, not leftover paint inside neighboring districts. Use `canalSection` and the `canal-section` / `canal-banks` masks from `docs/generated/town-mask-contract.v1.json`; do not place site structures inside that corridor.

District art is authored from `docs/generated/town-district-art-kits.v1.json`. Each component has a cropped 4x mask under `public/art/town/art-kits/`; generate or paint to that authoring size, then apply the result with `npm run town:apply-district-art -- --district=<id> --source=<image>`.

## Required Outputs

- town-base
- world-backdrop
- district-paintovers
- site-structure-sprites
- mop-worker-sprite-sheet
- canal-boat-sprites
- ambient-effect-sprites

## Asset Contracts

- `world-backdrop` -> `public/art/town/willville-landscape-v1.png`: Single masked land-region image for the world isthmus, authored from the Ganglia Studio world-landscape prompt and composited over simple water.
- `town-base` -> `public/art/town/willville-isthmus-v1.png`: Painted full-town background that follows the generated land, canal, district, and sign masks.
- `district-mask` -> `public/art/town/masks/districts/<district-id>.png`: One precise mask per district, generated from layout polygons.
- `global-mask` -> `public/art/town/masks/<land|canal|canal-section|canal-banks|shore-wall|district-walls>.png`: Global town masks for the land footprint, canal centerline ROI, canal section, canal banks, shoreline wall, and generated district-wall layer.
- `site-structure-sprite` -> `public/art/stops/<stop-id>.png`: Transparent bespoke structure sprite for a project site.
- `mop-worker-sprite-sheet` -> `public/art/sprites/mop-worker.png`: Transparent raster sprite sheet for mop workers with walk, sweep, idle, and bucket-carry cycles; generated from the animation manifest frame contract.
- `animation-manifest` -> `data/town-animation.v1.json`: Declarative animation data for sprite sheets, frame timing, and route assignment.

## Mirrored Mile

- Region id: `mirrored-mile`
- Label anchor: 420, 270
- Geometry formula: `resolveTownLayout(data/town-layout.v1.json).districts["mirrored-mile"].polygon`, then `pointsToPath(...)` from `lib/town-layout-engine.mjs`.
- Generated boundary points: produced by the formula above; do not paste or hand-edit the expanded path in this brief.
- Direction: A long literary hillside promenade with terraced print shops, book stalls, reflective tile courtyards, stair streets, brass lamps, and warm parchment masonry.
- Geometry contract: follow the generated polygon and wall loop exactly; do not redraw this district as a circular wedge.

## The Zeitgeist

- Region id: `the-zeitgeist`
- Label anchor: 810, 300
- Geometry formula: `resolveTownLayout(data/town-layout.v1.json).districts["the-zeitgeist"].polygon`, then `pointsToPath(...)` from `lib/town-layout-engine.mjs`.
- Generated boundary points: produced by the formula above; do not paste or hand-edit the expanded path in this brief.
- Direction: A dense commercial web quarter of blue roofs, storefronts, kiosks, rooftop antennas, cable runs, glass windows, and stacked public-facing shopfronts.
- Geometry contract: follow the generated polygon and wall loop exactly; do not redraw this district as a circular wedge.

## The Graveyard

- Region id: `the-graveyard`
- Label anchor: 1210, 350
- Geometry formula: `resolveTownLayout(data/town-layout.v1.json).districts["the-graveyard"].polygon`, then `pointsToPath(...)` from `lib/town-layout-engine.mjs`.
- Generated boundary points: produced by the formula above; do not paste or hand-edit the expanded path in this brief.
- Direction: An old irregular high-ground quarter of retired labs, crypt-workshops, mossy walls, rusted machines, overgrown paths, and archival structures.
- Geometry contract: follow the generated polygon and wall loop exactly; do not redraw this district as a circular wedge.

## The Halls of Judgement

- Region id: `halls-of-judgement`
- Label anchor: 1045, 610
- Geometry formula: `resolveTownLayout(data/town-layout.v1.json).districts["halls-of-judgement"].polygon`, then `pointsToPath(...)` from `lib/town-layout-engine.mjs`.
- Generated boundary points: produced by the formula above; do not paste or hand-edit the expanded path in this brief.
- Direction: A formal burgundy civic district with courthouses, colonnades, ledgers, record halls, inspection yards, scales, banners, and deliberate block geometry.
- Geometry contract: follow the generated polygon and wall loop exactly; do not redraw this district as a circular wedge.

## Town Square

- Region id: `town-square`
- Label anchor: 725, 565
- Geometry formula: `resolveTownLayout(data/town-layout.v1.json).districts["town-square"].polygon`, then `pointsToPath(...)` from `lib/town-layout-engine.mjs`.
- Generated boundary points: produced by the formula above; do not paste or hand-edit the expanded path in this brief.
- Direction: The civic pinch point of the isthmus with mosaic paving, Town Hall, a clock tower, rail access, bridges, stairs, and market-like pedestrian flow.
- Geometry contract: follow the generated polygon and wall loop exactly; do not redraw this district as a circular wedge.

## Slop Wharf

- Region id: `slop-wharf`
- Label anchor: 350, 815
- Geometry formula: `resolveTownLayout(data/town-layout.v1.json).districts["slop-wharf"].polygon`, then `pointsToPath(...)` from `lib/town-layout-engine.mjs`.
- Generated boundary points: produced by the formula above; do not paste or hand-edit the expanded path in this brief.
- Direction: A teal working canal dockyard with wet stone, mop depots, bucket sheds, hoses, drains, bridges, low warehouses, service carts, and animated mop-worker traffic.
- Geometry contract: follow the generated polygon and wall loop exactly; do not redraw this district as a circular wedge.

## Dogwallow Ramble II

- Region id: `dogwallow-ramble-ii`
- Label anchor: 640, 985
- Geometry formula: `resolveTownLayout(data/town-layout.v1.json).districts["dogwallow-ramble-ii"].polygon`, then `pointsToPath(...)` from `lib/town-layout-engine.mjs`.
- Generated boundary points: produced by the formula above; do not paste or hand-edit the expanded path in this brief.
- Direction: A warm domestic workshop edge with cottages, gardens, sheds, tool benches, clotheslines, pantry machinery, and winding footpaths.
- Geometry contract: follow the generated polygon and wall loop exactly; do not redraw this district as a circular wedge.

## The Gates of Hell

- Region id: `gates-of-hell`
- Label anchor: 1210, 955
- Geometry formula: `resolveTownLayout(data/town-layout.v1.json).districts["gates-of-hell"].polygon`, then `pointsToPath(...)` from `lib/town-layout-engine.mjs`.
- Generated boundary points: produced by the formula above; do not paste or hand-edit the expanded path in this brief.
- Direction: A playful spooky southeast compound with purple lanterns, crooked gates, pumpkin props, theatrical studio buildings, glowing windows, smoke, and canal bridges.
- Geometry contract: follow the generated polygon and wall loop exactly; do not redraw this district as a circular wedge.

## Animation Direction

The mop service system starts at Slop Wharf and travels from the slop depot to project sites. Produce raster sprite sheets, not primitive SVG glyphs, for mop workers and bespoke site structures. SVG remains reserved for paths, masks, hit regions, and debug overlays.

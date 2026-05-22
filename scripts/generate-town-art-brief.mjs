#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pointsToPath, resolveTownLayout } from "../lib/town-layout-engine.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const profileArg = process.argv.find((arg) => arg.startsWith("--profile="));
const profileId = profileArg?.split("=")[1] ?? "agent-choice";
const layout = resolveTownLayout(
  JSON.parse(await readFile(resolve(root, "data/town-layout.v1.json"), "utf8")),
);
const pipeline = JSON.parse(
  await readFile(resolve(root, "data/town-art-pipeline.v1.json"), "utf8"),
);
const profile = pipeline.profiles.find((p) => p.id === profileId);
if (!profile) {
  throw new Error(`Unknown profile: ${profileId}`);
}

const output = resolve(root, `docs/generated/town-art-brief-${profile.id}.md`);

const regionNotes = {
  "mirrored-mile":
    "A long literary hillside promenade with terraced print shops, book stalls, reflective tile courtyards, stair streets, brass lamps, and warm parchment masonry.",
  "the-zeitgeist":
    "A dense commercial web quarter of blue roofs, storefronts, kiosks, rooftop antennas, cable runs, glass windows, and stacked public-facing shopfronts.",
  "the-graveyard":
    "An old irregular high-ground quarter of retired labs, crypt-workshops, mossy walls, rusted machines, overgrown paths, and archival structures.",
  "halls-of-judgement":
    "A formal burgundy civic district with courthouses, colonnades, ledgers, record halls, inspection yards, scales, banners, and deliberate block geometry.",
  "town-square":
    "The civic pinch point of the isthmus with mosaic paving, Town Hall, a clock tower, rail access, bridges, stairs, and market-like pedestrian flow.",
  "slop-wharf":
    "A teal working canal dockyard with wet stone, mop depots, bucket sheds, hoses, drains, bridges, low warehouses, service carts, and animated mop-worker traffic.",
  "dogwallow-ramble-ii":
    "A warm domestic workshop edge with cottages, gardens, sheds, tool benches, clotheslines, pantry machinery, and winding footpaths.",
  "gates-of-hell":
    "A playful spooky southeast compound with purple lanterns, crooked gates, pumpkin props, theatrical studio buildings, glowing windows, smoke, and canal bridges.",
};

const districts = layout.districts
  .map(
    (district) => `## ${district.displayName}

- Region id: \`${district.id}\`
- Label anchor: ${district.label.x}, ${district.label.y}
- Generated mask path: \`${pointsToPath(district.polygon)}\`
- Generated boundary points: ${district.polygon.length}
- Direction: ${regionNotes[district.id]}
- Geometry contract: follow the generated polygon and wall loop exactly; do not redraw this district as a circular wedge.
`,
  )
  .join("\n");

const assets = pipeline.assetKinds
  .map(
    (asset) => `- \`${asset.id}\` -> \`${asset.path}\`: ${asset.description}`,
  )
  .join("\n");

const brief = `# Willville Art Brief (${profile.displayName})

Profile: \`${profile.id}\`

${profile.description}

## Global Direction

Willville is a Rio-inspired coastal project town on a narrow isthmus: bright masonry, steep terrain, ocean edges, a southern winding canal, dense neighborhoods, retaining walls, bridges, stair streets, and a prominent Hollywood-style "Welcome to Willville" sign on the northern hillside.

The generated layout in \`data/town-layout.v1.json\` is the source of truth. Art may add texture, detail, lighting, and personality, but must preserve land shape, district boundaries, canal path, wall loops, site anchor intent, and the sign location.

The world backdrop contract in \`docs/generated/town-world-backdrop.v1.json\` defines the outer isthmus, west/east coastlines, river, and registered town offset. Use it for any paintover that extends beyond the town proper; do not fall back to a repeated water tile.

The canal is its own generated section, not leftover paint inside neighboring districts. Use \`canalSection\` and the \`canal-section\` / \`canal-banks\` masks from \`docs/generated/town-mask-contract.v1.json\`; do not place site structures inside that corridor.

District art is authored from \`docs/generated/town-district-art-kits.v1.json\`. Each component has a cropped 4x mask under \`public/art/town/art-kits/\`; generate or paint to that authoring size, then apply the result with \`npm run town:apply-district-art -- --district=<id> --source=<image>\`.

## Required Outputs

${profile.outputs.map((item) => `- ${item}`).join("\n")}

## Asset Contracts

${assets}

${districts}

## Animation Direction

The mop service system starts at Slop Wharf and travels from the slop depot to project sites. Produce raster sprite sheets, not primitive SVG glyphs, for mop workers and bespoke site structures. SVG remains reserved for paths, masks, hit regions, and debug overlays.
`;

await mkdir(dirname(output), { recursive: true });
await writeFile(output, brief);
console.log(`wrote ${output}`);

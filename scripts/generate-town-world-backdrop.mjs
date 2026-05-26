#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  pointsToPath,
  resolveCanalSection,
  resolveTownLayout,
} from "../lib/town-layout-engine.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const layoutSource = JSON.parse(
  await readFile(resolve(root, "data/town-layout.v1.json"), "utf8"),
);
const layout = resolveTownLayout(layoutSource);
const canalSection = resolveCanalSection(layoutSource);

const world = { width: 2400, height: 1800 };
const townOffset = {
  x: (world.width - layout.size.width) / 2,
  y: (world.height - layout.size.height) / 2,
};

const promptOutput = resolve(
  root,
  "docs/generated/town-region-art-prompts/world-landscape.md",
);
const contractOutput = resolve(
  root,
  "docs/generated/town-world-backdrop.v1.json",
);

const landTransform = `translate(${townOffset.x} ${townOffset.y})`;
let existingContract = {};
try {
  existingContract = JSON.parse(await readFile(contractOutput, "utf8"));
} catch {
  existingContract = {};
}

const prompt = `# World Landscape Region Art Prompt

Use case: stylized-concept
Profile: ganglia-studio
Asset type: masked raster world land layer for Welcome to Willville

Region id: \`world-landscape\`
Output target: \`public/art/town/willville-landscape-v1.png\`
Mask to use: \`public/art/town/masks/land.png\`, translated by the world town offset from \`docs/generated/town-world-backdrop.v1.json\`
Canvas: ${world.width}x${world.height}

Primary request:
Create a crisp, richly detailed raster illustration for the entire visible region around Willville. It should read as one cohesive Central America / Panama Canal shaped coastal isthmus, not as separate seams or layers. Include the ocean, canal water, and visible coastlines in the source art. The app will sample its water from this source, tile that water behind the whole map, and use the land mask only as a broad placement window so the generated coastlines stay safely inside it.

Style:
Match the existing Willville district image layers: dense hidden-object board-game diorama, elevated three-quarter top-down view, crisp tiny terrain marks, wobbly hand-drawn contours, saturated readable colors, miniature painted texture, playful puzzle-map density, and hand-inked terrain edges. The backdrop should feel like the same artist painted the foreground districts and the surrounding land. It must not look like soft concept art, photoreal terrain, or a smooth painterly matte painting.

Scene:
South American coastal topography translated into a whimsical game-board underpainting. The west side must feel steep and mountainous: green slopes, cliff faces, terraced ridges, rocky shelves, footpaths, palms, scrub, and dense tiny hillside texture. The east side must feel brighter, flatter, and beachier: pale sand, low dunes, warm coastal paths, tide-smoothed rocks, sea-grass, and sunny open beach shelves. The center should blend the two with winding dirt paths, soft hills, tropical vegetation, boulders, palms, and small scenic details that make the district art feel embedded in one continuous landscape.

Composition:
The town districts and canal will be composited above this layer. Put the highest visual detail and strongest terrain character in the visible land outside and between the districts, but avoid fighting the town art. Preserve a coherent Central America / Panama Canal isthmus silhouette with coastlines that sit inside the broad land mask rather than exactly on the mask edge. Keep the western and eastern coastlines visually different. Make the top and bottom land feel like it continues beyond the viewport where needed.

Reference assets:

- Existing district art: \`public/art/town/districts/*.png\`
- Land mask: \`public/art/town/masks/land.png\`
- World geometry: \`docs/generated/town-world-backdrop.v1.json\`

Geometry contract:
The supplied land mask is a broad containment region, not the exact coastline. Keep every generated coastline and every bit of land safely inside that mask. The app will make pixels outside the land mask transparent and will also cut the canal transparent so the sampled water tile shows through. Do not add labels, UI, readable signs, repo markers, city walls, boats, town district boundaries, or foreground buildings that should belong to district art. The goal is a coherent underpainting that makes all district art feel embedded in one continuous isthmus with matching water everywhere.

Avoid:
Flat green grids, primitive SVG-like shapes, childlike sketches, synthetic vector doodles, soft blurry concept art, photorealism, cinematic blur, muddy dark grading, huge focal objects, visible seams, repeated tiles, debug-mask colors, readable text, watermarks, or anything that makes users notice the compositing pipeline.
`;

const contract = {
  version: "willville-world-landscape-v1",
  size: world,
  townOffset,
  townSize: layout.size,
  assets: {
    ...existingContract.assets,
    landPng: "/art/town/willville-landscape-v1.png",
    waterTilePng: "/art/town/willville-water-tile-v1.png",
  },
  prompts: {
    worldLandscape: "docs/generated/town-region-art-prompts/world-landscape.md",
  },
  sourceGeometry: {
    townLayoutVersion: layout.version,
    landPath: layout.landPath,
    canalPath: pointsToPath(canalSection.polygon),
    landTransform,
  },
};

await mkdir(dirname(promptOutput), { recursive: true });
await mkdir(dirname(contractOutput), { recursive: true });
await writeFile(promptOutput, prompt);
await writeFile(contractOutput, `${JSON.stringify(contract, null, 2)}\n`);
console.log(`wrote ${promptOutput}`);
console.log(`wrote ${contractOutput}`);

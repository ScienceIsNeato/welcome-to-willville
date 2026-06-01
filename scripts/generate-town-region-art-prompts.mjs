#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const contract = JSON.parse(
  await readFile(
    resolve(root, "docs/generated/town-mask-contract.v1.json"),
    "utf8",
  ),
);
const glyphInserts = JSON.parse(
  await readFile(resolve(root, "data/town-glyph-inserts.v1.json"), "utf8"),
);
const outputRoot = resolve(root, "docs/generated/town-region-art-prompts");

const regionDirections = {
  "mirrored-mile": {
    palette: "warm parchment tan, brass, ivory stone, soft ink black",
    motifs:
      "terraced print shops, book stalls, reflective tile courtyards, stair streets, brass lamps, stacks of papers, small writing desks",
  },
  "the-zeitgeist": {
    palette: "bright civic blue, glass cyan, white trim, warm shop lights",
    motifs:
      "blue roofs, storefronts, kiosks, rooftop antennas, cable runs, glass windows, awnings, public-facing shopfronts",
  },
  "the-graveyard": {
    palette: "rust orange, dusty ochre, oxidized metal, dead-leaf brown",
    motifs:
      "retired labs, old machines, archival towers, overgrown paths, crates, inactive furnaces, broken prototypes",
  },
  "halls-of-judgement": {
    palette: "burgundy, deep red, legal parchment, dark walnut, brass",
    motifs:
      "courthouses, colonnades, ledgers, scales, record halls, inspection yards, filing cabinets, evidence crates",
  },
  "town-square": {
    palette:
      "civic cream stone, green planters, blue fountain water, warm roof tile",
    motifs:
      "circular plaza, fountain, town hall, bell tower, mosaic paving, market stalls, lamps, stairs, rail access",
  },
  "slop-wharf": {
    palette: "teal, wet stone gray, bucket blue, mop straw yellow, dock brown",
    motifs:
      "mop depots, bucket sheds, wet stone, drains, hoses, low warehouses, service carts, docks, cleaning tools",
  },
  "dogwallow-ramble-ii": {
    palette: "warm orange, garden green, tan cottages, workshop brown",
    motifs:
      "cottages, gardens, sheds, tool benches, clotheslines, pantry machinery, winding footpaths, domestic workshops",
  },
  "gates-of-hell": {
    palette:
      "deep purple, violet, pumpkin orange, theatrical black, glowing gold",
    motifs:
      "crooked gates, playful spooky studio buildings, pumpkins, lanterns, glowing windows, smoke, bridges, theatrical props",
  },
  "the-nursery": {
    palette:
      "fresh spring green, tender leaf green, soft moss, terracotta pots, warm soil brown, pale sprout gold",
    motifs:
      "greenhouses, seedling beds, sprouting saplings, potting sheds, raised garden boxes, watering cans, trellises, tiny saplings in rows, propagation tables",
  },
};

function componentSummary(district) {
  if (!district.artComponents?.length) return "single connected art ROI";
  return district.artComponents
    .map(
      (component) =>
        `${component.id}: ${component.bounds.width}x${component.bounds.height}+${component.bounds.x}+${component.bounds.y}`,
    )
    .join("; ");
}

function authoringPlateSummary(district, scale = 4, padding = 28) {
  if (!district.artComponents?.length) return "none";
  return district.artComponents
    .map((component) => {
      const padded = {
        x: Math.max(0, component.bounds.x - padding),
        y: Math.max(0, component.bounds.y - padding),
        width:
          Math.min(
            contract.size.width,
            component.bounds.x + component.bounds.width + padding,
          ) - Math.max(0, component.bounds.x - padding),
        height:
          Math.min(
            contract.size.height,
            component.bounds.y + component.bounds.height + padding,
          ) - Math.max(0, component.bounds.y - padding),
      };
      return `${component.id}: author at ${padded.width * scale}x${padded.height * scale} pixels for ${padded.width}x${padded.height}+${padded.x}+${padded.y} map units`;
    })
    .join("; ");
}

function glyphInsertSummary(district) {
  const inserts = glyphInserts.inserts.filter(
    (insert) => insert.districtId === district.id,
  );
  if (inserts.length === 0) return "";

  const lines = inserts
    .map(
      (insert) =>
        `- ${insert.displayName} (\`${insert.id}\`): must be explicitly visible at map coordinate ${insert.anchor.x}, ${insert.anchor.y}. Use mask \`${insert.maskImage}\` when doing a targeted insertion pass. ${insert.description}`,
    )
    .join("\n");

  return `\nRequired glyph inserts:\n${lines}\n`;
}

function promptForDistrict(district) {
  const direction = regionDirections[district.id];
  return `# ${district.displayName} Region Art Prompt

Use case: stylized-concept
Asset type: masked raster district layer for Welcome to Willville

Region id: \`${district.id}\`
Output target: \`public/art/town/districts/${district.id}.png\`
Mask to use: \`${district.artMask.png}\`
Raw district mask: \`${district.mask.png}\`
Art ROI components: ${componentSummary(district)}
Recommended authoring plates: ${authoringPlateSummary(district)}
Canvas: ${contract.size.width}x${contract.size.height}

Primary request:
Create richly detailed raster illustration art for only the ${district.displayName} district of Willville. Author each ROI at 4x its map-unit size, then let the pipeline downsample it into the final map layer. This layer will be clipped by the exact district art mask, so fill the whole masked region with dense, miniature, hand-drawn town detail while keeping all important content inside the mask.

Style:
Dense Magic Maze-like hidden-object board-game diorama, elevated three-quarter top-down view, crisp tiny shapes, wobbly hand-drawn contours, saturated but readable colors, lively masonry and roof detail, many small repeated objects, playful puzzle-map density. Do not copy any specific existing game artwork.

Palette:
${direction.palette}

Motifs:
${direction.motifs}${glyphInsertSummary(district)}

Geometry contract:
The supplied mask is authoritative. Do not redraw the district as a circle, wedge, rectangle, or standalone island. Do not paint across the canal cutouts. Any disconnected ROI component should feel like the same district continuing on the other side of the canal, but the canal itself remains empty for the shared canal layer.

Composition:
No labels, no readable text, no UI, no map pins, no logos, no watermarks. Leave breathing room around the label anchor at ${district.label.x}, ${district.label.y} so the app's SVG label remains readable. Avoid putting critical detail under expected repo marker locations.

Avoid:
Flat icon glyphs, primitive SVG-like symbols, photorealism, cinematic blur, low-detail blocks, muddy dark grading, huge single focal objects, readable signs, or important objects outside the mask.
`;
}

const indexLines = ["# Willville Region Art Prompts", ""];
await mkdir(outputRoot, { recursive: true });

for (const district of contract.districts) {
  const prompt = promptForDistrict(district);
  const output = resolve(outputRoot, `${district.id}.md`);
  await writeFile(output, prompt);
  indexLines.push(
    `- [${district.displayName}](./town-region-art-prompts/${district.id}.md) -> \`${district.artMask.png}\``,
  );
}

const indexOutput = resolve(root, "docs/generated/town-region-art-prompts.md");
await mkdir(dirname(indexOutput), { recursive: true });
await writeFile(indexOutput, `${indexLines.join("\n")}\n`);
console.log(`wrote ${indexOutput}`);
console.log(`wrote ${outputRoot}`);

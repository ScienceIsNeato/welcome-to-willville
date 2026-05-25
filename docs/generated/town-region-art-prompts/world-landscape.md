# World Landscape Region Art Prompt

Use case: stylized-concept
Profile: ganglia-studio
Asset type: masked raster world land layer for Welcome to Willville

Region id: `world-landscape`
Output target: `public/art/town/willville-landscape-v1.png`
Mask to use: `public/art/town/masks/land.png`, translated by the world town offset from `docs/generated/town-world-backdrop.v1.json`
Canvas: 2400x1800

Primary request:
Create a richly detailed raster illustration for the entire visible landmass around Willville. Treat the whole land mask as one background region. It should read as one cohesive South American coastal isthmus with a town built on it, not as separate seams or layers.

Style:
Match the existing Willville district image layers: dense Magic Maze-like hidden-object board-game diorama, elevated three-quarter top-down view, crisp tiny shapes, wobbly hand-drawn contours, saturated but readable colors, miniature painted texture, playful puzzle-map density, and hand-painted terrain. Do not copy any specific existing game artwork.

Scene:
Rio de Janeiro and South American coastal topography translated into a whimsical game-board underpainting. The west coast should feel steep and mountainous: green slopes, cliff faces, terraced ridges, rocky shelves, footpaths, palms, scrub, and tiny hillside texture. The east coast should feel brighter and beachier: pale sand, low dunes, warm coastal paths, tide-smoothed rocks, sea-grass, and sunny open beach shelves. The center should blend the two with winding paths, soft hills, tropical vegetation, and small scenic details that make the district art feel embedded in one continuous landscape.

Composition:
The town districts and canal will be composited above this layer. Put the highest visual detail and strongest terrain character in the visible land outside and between the districts, but avoid fighting the town art. Preserve a coherent north-south isthmus silhouette. Keep the western and eastern coastlines visually different. Make the top and bottom land feel like it continues beyond the viewport.

Reference assets:

- Existing district art: `public/art/town/districts/*.png`
- Land mask: `public/art/town/masks/land.png`
- World geometry: `docs/generated/town-world-backdrop.v1.json`

Geometry contract:
The supplied land mask is authoritative. Paint land only inside the mask. Sea remains outside this layer. Do not add labels, UI, readable signs, repo markers, city walls, canal water, boats, town district boundaries, or foreground buildings that should belong to district art. The goal is a coherent underpainting that makes all district art feel embedded in one continuous isthmus.

Avoid:
Flat green grids, primitive SVG-like shapes, childlike sketches, synthetic vector doodles, photorealism, cinematic blur, muddy dark grading, huge focal objects, visible seams, repeated tiles, debug-mask colors, readable text, watermarks, or anything that makes users notice the compositing pipeline.

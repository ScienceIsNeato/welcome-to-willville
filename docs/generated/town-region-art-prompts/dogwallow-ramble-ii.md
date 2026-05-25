# Dogwallow Ramble II Region Art Prompt

Use case: stylized-concept
Asset type: masked raster district layer for Welcome to Willville

Region id: `dogwallow-ramble-ii`
Output target: `public/art/town/districts/dogwallow-ramble-ii.png`
Mask to use: `/art/town/masks/district-art/dogwallow-ramble-ii.png`
Raw district mask: `/art/town/masks/districts/dogwallow-ramble-ii.png`
Art ROI components: dogwallow-ramble-ii-1: 318x182+493+913; dogwallow-ramble-ii-2: 212x118+581+760
Recommended authoring plates: dogwallow-ramble-ii-1: author at 1496x952 pixels for 374x238+465+885 map units; dogwallow-ramble-ii-2: author at 1072x696 pixels for 268x174+553+732 map units
Canvas: 1600x1240

Primary request:
Create richly detailed raster illustration art for only the Dogwallow Ramble II district of Willville. Author each ROI at 4x its map-unit size, then let the pipeline downsample it into the final map layer. This layer will be clipped by the exact district art mask, so fill the whole masked region with dense, miniature, hand-drawn town detail while keeping all important content inside the mask.

Style:
Dense Magic Maze-like hidden-object board-game diorama, elevated three-quarter top-down view, crisp tiny shapes, wobbly hand-drawn contours, saturated but readable colors, lively masonry and roof detail, many small repeated objects, playful puzzle-map density. Do not copy any specific existing game artwork.

Palette:
warm orange, garden green, tan cottages, workshop brown

Motifs:
cottages, gardens, sheds, tool benches, clotheslines, pantry machinery, winding footpaths, domestic workshops

Geometry contract:
The supplied mask is authoritative. Do not redraw the district as a circle, wedge, rectangle, or standalone island. Do not paint across the canal cutouts. Any disconnected ROI component should feel like the same district continuing on the other side of the canal, but the canal itself remains empty for the shared canal layer.

Composition:
No labels, no readable text, no UI, no map pins, no logos, no watermarks. Leave breathing room around the label anchor at 640, 985 so the app's SVG label remains readable. Avoid putting critical detail under expected repo marker locations.

Avoid:
Flat icon glyphs, primitive SVG-like symbols, photorealism, cinematic blur, low-detail blocks, muddy dark grading, huge single focal objects, readable signs, or important objects outside the mask.

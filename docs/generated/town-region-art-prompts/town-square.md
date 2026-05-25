# Town Square Region Art Prompt

Use case: stylized-concept
Asset type: masked raster district layer for Welcome to Willville

Region id: `town-square`
Output target: `public/art/town/districts/town-square.png`
Mask to use: `/art/town/masks/district-art/town-square.png`
Raw district mask: `/art/town/masks/districts/town-square.png`
Art ROI components: town-square-1: 456x412+420+348
Recommended authoring plates: town-square-1: author at 2048x1872 pixels for 512x468+392+320 map units
Canvas: 1600x1240

Primary request:
Create richly detailed raster illustration art for only the Town Square district of Willville. Author each ROI at 4x its map-unit size, then let the pipeline downsample it into the final map layer. This layer will be clipped by the exact district art mask, so fill the whole masked region with dense, miniature, hand-drawn town detail while keeping all important content inside the mask.

Style:
Dense Magic Maze-like hidden-object board-game diorama, elevated three-quarter top-down view, crisp tiny shapes, wobbly hand-drawn contours, saturated but readable colors, lively masonry and roof detail, many small repeated objects, playful puzzle-map density. Do not copy any specific existing game artwork.

Palette:
civic cream stone, green planters, blue fountain water, warm roof tile

Motifs:
circular plaza, fountain, town hall, bell tower, mosaic paving, market stalls, lamps, stairs, rail access

Geometry contract:
The supplied mask is authoritative. Do not redraw the district as a circle, wedge, rectangle, or standalone island. Do not paint across the canal cutouts. Any disconnected ROI component should feel like the same district continuing on the other side of the canal, but the canal itself remains empty for the shared canal layer.

Composition:
No labels, no readable text, no UI, no map pins, no logos, no watermarks. Leave breathing room around the label anchor at 725, 565 so the app's SVG label remains readable. Avoid putting critical detail under expected repo marker locations.

Avoid:
Flat icon glyphs, primitive SVG-like symbols, photorealism, cinematic blur, low-detail blocks, muddy dark grading, huge single focal objects, readable signs, or important objects outside the mask.

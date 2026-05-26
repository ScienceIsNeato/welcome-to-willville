# The Graveyard Region Art Prompt

Use case: stylized-concept
Asset type: masked raster district layer for Welcome to Willville

Region id: `the-graveyard`
Output target: `public/art/town/districts/the-graveyard.png`
Mask to use: `/art/town/masks/district-art/the-graveyard.png`
Raw district mask: `/art/town/masks/districts/the-graveyard.png`
Art ROI components: the-graveyard-1: 411x477+967+151
Recommended authoring plates: the-graveyard-1: author at 1868x2132 pixels for 467x533+939+123 map units
Canvas: 1600x1240

Primary request:
Create richly detailed raster illustration art for only the The Graveyard district of Willville. Author each ROI at 4x its map-unit size, then let the pipeline downsample it into the final map layer. This layer will be clipped by the exact district art mask, so fill the whole masked region with dense, miniature, hand-drawn town detail while keeping all important content inside the mask.

Style:
Dense Magic Maze-like hidden-object board-game diorama, elevated three-quarter top-down view, crisp tiny shapes, wobbly hand-drawn contours, saturated but readable colors, lively masonry and roof detail, many small repeated objects, playful puzzle-map density. Do not copy any specific existing game artwork.

Palette:
rust orange, dusty ochre, oxidized metal, dead-leaf brown

Motifs:
retired labs, old machines, archival towers, overgrown paths, crates, inactive furnaces, broken prototypes

Geometry contract:
The supplied mask is authoritative. Do not redraw the district as a circle, wedge, rectangle, or standalone island. Do not paint across the canal cutouts. Any disconnected ROI component should feel like the same district continuing on the other side of the canal, but the canal itself remains empty for the shared canal layer.

Composition:
No labels, no readable text, no UI, no map pins, no logos, no watermarks. Leave breathing room around the label anchor at 1210, 350 so the app's SVG label remains readable. Avoid putting critical detail under expected repo marker locations.

Avoid:
Flat icon glyphs, primitive SVG-like symbols, photorealism, cinematic blur, low-detail blocks, muddy dark grading, huge single focal objects, readable signs, or important objects outside the mask.

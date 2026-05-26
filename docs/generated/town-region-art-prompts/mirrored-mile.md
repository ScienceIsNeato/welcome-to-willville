# Mirrored Mile Region Art Prompt

Use case: stylized-concept
Asset type: masked raster district layer for Welcome to Willville

Region id: `mirrored-mile`
Output target: `public/art/town/districts/mirrored-mile.png`
Mask to use: `/art/town/masks/district-art/mirrored-mile.png`
Raw district mask: `/art/town/masks/districts/mirrored-mile.png`
Art ROI components: mirrored-mile-1: 509x300+225+144
Recommended authoring plates: mirrored-mile-1: author at 2260x1424 pixels for 565x356+197+116 map units
Canvas: 1600x1240

Primary request:
Create richly detailed raster illustration art for only the Mirrored Mile district of Willville. Author each ROI at 4x its map-unit size, then let the pipeline downsample it into the final map layer. This layer will be clipped by the exact district art mask, so fill the whole masked region with dense, miniature, hand-drawn town detail while keeping all important content inside the mask.

Style:
Dense Magic Maze-like hidden-object board-game diorama, elevated three-quarter top-down view, crisp tiny shapes, wobbly hand-drawn contours, saturated but readable colors, lively masonry and roof detail, many small repeated objects, playful puzzle-map density. Do not copy any specific existing game artwork.

Palette:
warm parchment tan, brass, ivory stone, soft ink black

Motifs:
terraced print shops, book stalls, reflective tile courtyards, stair streets, brass lamps, stacks of papers, small writing desks

Geometry contract:
The supplied mask is authoritative. Do not redraw the district as a circle, wedge, rectangle, or standalone island. Do not paint across the canal cutouts. Any disconnected ROI component should feel like the same district continuing on the other side of the canal, but the canal itself remains empty for the shared canal layer.

Composition:
No labels, no readable text, no UI, no map pins, no logos, no watermarks. Leave breathing room around the label anchor at 420, 270 so the app's SVG label remains readable. Avoid putting critical detail under expected repo marker locations.

Avoid:
Flat icon glyphs, primitive SVG-like symbols, photorealism, cinematic blur, low-detail blocks, muddy dark grading, huge single focal objects, readable signs, or important objects outside the mask.

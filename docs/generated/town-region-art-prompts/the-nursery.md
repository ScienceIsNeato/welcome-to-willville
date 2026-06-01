# The Nursery Region Art Prompt

Use case: stylized-concept
Asset type: masked raster district layer for Welcome to Willville

Region id: `the-nursery`
Output target: `public/art/town/districts/the-nursery.png`
Mask to use: `/art/town/masks/district-art/the-nursery.png`
Raw district mask: `/art/town/masks/districts/the-nursery.png`
Art ROI components: the-nursery-1: 407x296+263+897
Recommended authoring plates: the-nursery-1: author at 1852x1408 pixels for 463x352+235+869 map units
Canvas: 1600x1240

Primary request:
Create richly detailed raster illustration art for only the The Nursery district of Willville. Author each ROI at 4x its map-unit size, then let the pipeline downsample it into the final map layer. This layer will be clipped by the exact district art mask, so fill the whole masked region with dense, miniature, hand-drawn town detail while keeping all important content inside the mask.

Style:
Dense Magic Maze-like hidden-object board-game diorama, elevated three-quarter top-down view, crisp tiny shapes, wobbly hand-drawn contours, saturated but readable colors, lively masonry and roof detail, many small repeated objects, playful puzzle-map density. Do not copy any specific existing game artwork.

Palette:
fresh spring green, tender leaf green, soft moss, terracotta pots, warm soil brown, pale sprout gold

Motifs:
greenhouses, seedling beds, sprouting saplings, potting sheds, raised garden boxes, watering cans, trellises, tiny saplings in rows, propagation tables

Geometry contract:
The supplied mask is authoritative. Do not redraw the district as a circle, wedge, rectangle, or standalone island. Do not paint across the canal cutouts. Any disconnected ROI component should feel like the same district continuing on the other side of the canal, but the canal itself remains empty for the shared canal layer.

Composition:
No labels, no readable text, no UI, no map pins, no logos, no watermarks. Leave breathing room around the label anchor at 474, 1090 so the app's SVG label remains readable. Avoid putting critical detail under expected repo marker locations.

Avoid:
Flat icon glyphs, primitive SVG-like symbols, photorealism, cinematic blur, low-detail blocks, muddy dark grading, huge single focal objects, readable signs, or important objects outside the mask.

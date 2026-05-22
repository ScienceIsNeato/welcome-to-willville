# The Gates of Hell Region Art Prompt

Use case: stylized-concept
Asset type: masked raster district layer for Welcome to Willville

Region id: `gates-of-hell`
Output target: `public/art/town/districts/gates-of-hell.png`
Mask to use: `/art/town/masks/district-art/gates-of-hell.png`
Raw district mask: `/art/town/masks/districts/gates-of-hell.png`
Art ROI components: gates-of-hell-1: 430x280+758+826
Recommended authoring plates: gates-of-hell-1: author at 1944x1344 pixels for 486x336+730+798 map units
Canvas: 1600x1240

Primary request:
Create richly detailed raster illustration art for only the The Gates of Hell district of Willville. Author each ROI at 4x its map-unit size, then let the pipeline downsample it into the final map layer. This layer will be clipped by the exact district art mask, so fill the whole masked region with dense, miniature, hand-drawn town detail while keeping all important content inside the mask.

Style:
Dense Magic Maze-like hidden-object board-game diorama, elevated three-quarter top-down view, crisp tiny shapes, wobbly hand-drawn contours, saturated but readable colors, lively masonry and roof detail, many small repeated objects, playful puzzle-map density. Do not copy any specific existing game artwork.

Palette:
deep purple, violet, pumpkin orange, theatrical black, glowing gold

Motifs:
crooked gates, playful spooky studio buildings, pumpkins, lanterns, glowing windows, smoke, bridges, theatrical props

Geometry contract:
The supplied mask is authoritative. Do not redraw the district as a circle, wedge, rectangle, or standalone island. Do not paint across the canal cutouts. Any disconnected ROI component should feel like the same district continuing on the other side of the canal, but the canal itself remains empty for the shared canal layer.

Composition:
No labels, no readable text, no UI, no map pins, no logos, no watermarks. Leave breathing room around the label anchor at 1210, 955 so the app's SVG label remains readable. Avoid putting critical detail under expected repo marker locations.

Avoid:
Flat icon glyphs, primitive SVG-like symbols, photorealism, cinematic blur, low-detail blocks, muddy dark grading, huge single focal objects, readable signs, or important objects outside the mask.

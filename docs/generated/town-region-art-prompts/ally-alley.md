# Ally Alley Region Art Prompt

Use case: stylized-concept
Asset type: masked raster district layer for Welcome to Willville

Region id: `ally-alley`
Output target: `public/art/town/districts/ally-alley.png`
Mask to use: `/art/town/masks/district-art/ally-alley.png`
Raw district mask: `/art/town/masks/districts/ally-alley.png`
Art ROI components: ally-alley-1: 265x151+720+1075
Recommended authoring plates: ally-alley-1: author at 1284x772 pixels for 321x193+692+1047 map units
Canvas: 1600x1240

Primary request:
Create richly detailed raster illustration art for only the Ally Alley district of Willville. Author each ROI at 4x its map-unit size, then let the pipeline downsample it into the final map layer. This layer will be clipped by the exact district art mask, so fill the whole masked region with dense, miniature, hand-drawn town detail while keeping all important content inside the mask.

Style:
Dense Magic Maze-like hidden-object board-game diorama, elevated three-quarter top-down view, crisp tiny shapes, wobbly hand-drawn contours, saturated but readable colors, lively masonry and roof detail, many small repeated objects, playful puzzle-map density. Do not copy any specific existing game artwork.

Palette:
slate gray, weathered brick red, iron black, warm streetlamp amber, faded teal signage

Motifs:
crisscrossing narrow alleyways winding between tall close-packed buildings, brick tenements, fire escapes and iron stairs, overhead crossing wires and strung lights, hanging shop signs, cobbled lanes, archways and connecting bridges between rooftops, glowing windows and street lamps in the dusk

Geometry contract:
The supplied mask is authoritative. Do not redraw the district as a circle, wedge, rectangle, or standalone island. Do not paint across the canal cutouts. Any disconnected ROI component should feel like the same district continuing on the other side of the canal, but the canal itself remains empty for the shared canal layer.

Composition:
No labels, no readable text, no UI, no map pins, no logos, no watermarks. Leave breathing room around the label anchor at 850, 1155 so the app's SVG label remains readable. Avoid putting critical detail under expected repo marker locations.

Avoid:
Flat icon glyphs, primitive SVG-like symbols, photorealism, cinematic blur, low-detail blocks, muddy dark grading, huge single focal objects, readable signs, or important objects outside the mask.

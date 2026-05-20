# Willville Town Background V2 With Animation Chroma

Use case: stylized-concept

Asset type: interactive web-app town map background, source image for later animation masks

Primary request:
Create a new illustrated top-down/elevated town map for “Welcome to Willville,” a whimsical project-town where each district is a small thematic world. The image must be a dense, puzzle-like, hand-drawn cartoon diorama with strong segmented composition, many small readable repeated objects, and explicit chroma-green lanes where animated moving walls/passages will be composited later.

Scene/backdrop:
A compact coastal fantasy town on a harbor island, viewed from above like a game board or hidden-object puzzle spread. The town is divided into eight distinct districts arranged around a central plaza with a fountain. Include an outer harbor wall, docks along the bottom edge, a small ocean/open-water edge, and tiny streets/rails/pathways that weave between zones.

Districts and motif packages:
- The Press Row: warm parchment, ink, tiny print shops, stacked papers, little newsstands, type blocks, small chimneys, wordy signs without readable text.
- Web Row: bright blue roofs, storefronts, cables, glassy windows, tiny app kiosks, network-like paths, cheerful shop awnings.
- The Foundry: hot oranges and reds, furnaces, smokestacks, gears, molten vats, industrial brick, tiny carts, metal catwalks.
- The Audit Yard: burgundy and deep red, ledgers, scales, filing cabinets, courtyards, stamps, evidence crates, inspection tables.
- Slop Wharf: teal water, mops, buckets, docks, small boats, utility sheds, cleaning tools, comic mess-cleanup details.
- The Sawmill District: warm browns, timber stacks, saw blades, workshops, planters, benches, little machines, wood grain patterns.
- Hallow Hollow: purple and violet, pumpkins, lanterns, crooked fences, little crypts, playful spooky props, glowing windows.
- The Hearth: orange hearthlight, cottages, gardens, family-house details, tiny laundry lines, cozy-but-busy domestic props.

Style/medium:
Dense hand-drawn cartoon illustration, puzzle-board world, whimsical hidden-object diorama. Use solid-ish saturated colors, wavy living contours, toy-like miniaturized buildings, simplified recognizable objects, repeated tiny icons, decorative pattern density, and semi-flat illustrated topography. Every zone should feel like its own color-biome and micro-story. The composition should reward scanning and feel busy, crowded, playful, manic, and alive.

Composition/framing:
Single full-map image, no UI, no labels, no text, no legends, no interface chrome. Elevated three-quarter top-down map view. The entire town should fit in frame with slight breathing room around the island. Maintain a readable central plaza and clear district separations. The district boundaries should be wavy and organic rather than perfect circles or straight polygons.

Animation chroma-key requirements:
Place perfectly flat, uniform #00ff00 chroma-green strips only where future animation should replace the static art. These green areas are intentional mask channels, not scenery.

The #00ff00 areas must:
- follow the exact visible wall/passages between districts and around district edges
- appear as clean, continuous lanes or openings integrated into the masonry/path system
- be at least 18-28 pixels wide at final image scale so they can be cleanly extracted
- include rounded/wavy hand-drawn contours that match the illustration
- include tunnel/gate apertures between districts where cargo can pass
- avoid shadows, gradients, antialias tint, texture, objects, labels, or visual noise inside the green
- not appear anywhere except animation/mask regions

The rest of the image must not use #00ff00 or any similar neon green.

Lighting/mood:
Bright, readable, playful, busy, colorful. Avoid a single global cinematic mood. Each district should have its own local color identity. Keep the image clear enough for web interaction and future overlays.

Color palette:
Saturated patchwork color islands: parchment tan, bright web blue, hot foundry orange/red, audit burgundy, slop-wharf teal, sawmill brown/gold, hallow purple/violet, hearth orange. Avoid one-note palettes, beige dominance, dark blue dominance, and overly realistic atmospheric grading.

Materials/textures:
Patterned roofs, rows of windows, repeated stones, planks, tiny carts, tiles, waves, ladders, tools, rails, crates, signs, plants, and decorative marks. Texture should come from repeated symbolic details rather than photorealistic material rendering.

Text:
No readable text. Do not render labels, names, signs with words, captions, logos, watermarks, or UI.

Constraints:
- Must be one cohesive town map while still reading as a patchwork of mini-zones.
- Must feel hand-drawn, wobbly, lively, and cartoon-readable.
- Must include clearly extractable flat #00ff00 mask strips exactly where animated walls/passages should go.
- Must preserve open space for later SVG labels and stop markers.
- Must not place important visual detail where labels usually sit near district centers.
- No photorealism, no painterly realism, no cinematic blur, no low-detail minimalism.

Avoid:
Photorealism, realistic perspective, empty areas, soft ethereal fantasy, smooth vector corporate style, perfect geometric district outlines, dark muddy colors, huge single focal subject, readable text, logos, UI panels, map pins, labels, watermarks, non-green mask colors.

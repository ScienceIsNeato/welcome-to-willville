# Art Brief — Willville

The visual target is **Magic Maze the board game**: top-down, tile-based,
chunky and vibrant, slightly painterly, immediately legible from across the
room. Districts read as distinct zones at a glance. Trains and stops feel
hand-drawn, not pixel-perfect.

## What we need

Drop assets into `public/art/` at the paths below. The interactive layer
already references them; replacing a placeholder requires no code change.

```
public/art/
├── town/willville-landscape-v1.png # masked world land backdrop
├── town/districts/<district-id>.png # one painted district layer
├── stops/<stop-id>.png         # building icon, transparent bg, ~64x64
└── trains/<vehicle>.png        # trolley, steam, hearse, cart, paperboy
```

District IDs and stop IDs match those in `lib/willville.ts` and
`lib/willville.heuristics.ts`. Names there are the source of truth.

## Color cues (already baked into `app/globals.css`)

| District             | Color          |
| -------------------- | -------------- |
| The Press Row        | warm cream     |
| The Foundry          | iron orange    |
| Slop Wharf           | teal           |
| The Audit Yard       | maroon         |
| Web Row              | sky blue       |
| The Sawmill District | walnut brown   |
| Hallow Hollow        | lantern purple |
| The Hearth           | hearth amber   |

## Prompt template (LLM or ganglia-studio)

Use the same skeleton for every asset; only swap the bracketed bits.

> A top-down [district / stop] tile in the style of the Magic Maze board game.
> [Specific subject e.g. "A foundry district with smoke-stack buildings and
>
> > glowing forges"]. Chunky, painterly, slightly cartoonish, vibrant primary
> > colors, soft shadows, transparent background, clean silhouette, suitable for
> > compositing on a dark night-sky board.

Avoid: photo-realism, isometric 3D, hand-lettered signs, anachronistic UI
elements, watermarks.

## Trains

Five vehicles, transparent background, ~64×40, side-view but slightly
top-down. They render via SVG sprite by default; PNG drop-ins go to
`public/art/trains/<vehicle>.png`.

| Line        | Vehicle  |
| ----------- | -------- |
| `web`       | trolley  |
| `ai`        | steam    |
| `halloween` | hearse   |
| `workshop`  | cart     |
| `writing`   | paperboy |

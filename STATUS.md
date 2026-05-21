<!-- willville
doing: Restructuring district map and repo coverage audit per new CSV mapping
done: District rename (8 regions), hallucinated stop removal, split-flap board merge, packet format v2
next: Rebuild static export, verify all 33 repos render on map
risk: low
milestone: Repo coverage audit
eta: 2026-05-22
-->

# Status

## Done (2026-05-19) — Split-Flap Audio + Cell Transitions + Click Repair

- **Whispery Audio:** Re-engineered the click synthesis in [components/CentralBoard.tsx](components/CentralBoard.tsx) to triple the flip sound duration to 135ms, introduce a slow, soft attack onset, and broaden the bandpass Q filter from 0.9 to 0.38 to replicate whispering autumn leaves.
- **Smart Cell Transitions:** Refactored `SplitFlapCell` in [components/CentralBoard.tsx](components/CentralBoard.tsx) with character-value tracking via `prevCharRef` to bypass trigger/flip animations on any letters or blank cells that maintain identical character values across updates.
- **Click Restoration & Race-Condition Repair:** Restored map site interaction by replacing the React-state based `isDragging` logic for pointer events. Enabled DOM-direct synchronous styling updates for `style.pointerEvents` in [hooks/useTownCamera.ts](hooks/useTownCamera.ts) and leveraged a synchronous `wasDragging()` micro-delay helper to cleanly separate standard mouse clicks from drag panning operations.
- `npm run build` passes flawlessly.

## Done (2026-05-19) — Interaction + bucolic world

- **Pan/zoom model:** single pointer-down drag pans everywhere (only `data-project-hud` excluded); wheel zoom unchanged
- **Double-click:** screen → world via `screenToWorld()`; zoom 1.4× centered on click point; stop hit-test opens `ProjectHud` + updates URL
- **Removed:** district click zoom/navigation; stop single-click HUD; stage background click reset; `focusDistrict`
- **World canvas:** 2400×1800 with town 1600×1240 centered at offset (400, 280); `BucolicMargin` SVG scenery in margins
- `npm run build` passes

## Done (2026-05-19) — ProjectHud dismiss + links

- Stage pointer capture fix for HUD; deep-link dismiss guard
- `npm run build` passes

## Done (2026-05-19) — Pan clamp to world corners

- **Bug:** `clampCamera` used `max(halfW, cx)` / `min(W-halfW, cx)`; when zoomed out (`halfW > W/2`) bounds inverted and locked `cy`/`cx` to the wrong edge (could not reach top-right world corner).
- **Fix:** ordered `minCx = min(halfW, W-halfW)`, `maxCx = max(...)`; `panDelta` uses two `screenToWorld` samples (letterbox-safe).
- `npm run build` passes

## Manual verify

- Drag pan from anywhere on map (including over districts/stops)
- At min/max zoom, pan until each world corner (0,0), (2400,0), (2400,1800), (0,1800) can sit in a viewport corner
- Double-click open ground zooms to cursor; double-click stop zooms + HUD
- Double-click empty map closes HUD
- Zoom into town corners shows meadow/hills/sea margin, not black void
- Deep link `/{district}/{stop}/` opens HUD without camera reframe
- Mayor's Express list still opens HUD (no map zoom)

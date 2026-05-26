/**
 * Curved canal spine through Willville (1600×1240 viewbox).
 *
 * The canal geometry comes from the generated town layout so boats, gates,
 * masks, and the painted art brief all share a single source of truth.
 */

import { GENERATED_TOWN_LAYOUT } from "./town-layout";

/**
 * SVG path for the canal centerline.
 *
 * Stays inside the generated harbor zone so SVG boats and gate lines land on
 * the same canal geometry used by masks and district art.
 */
export const CANAL_PATH_D = GENERATED_TOWN_LAYOUT.canal.pathD;

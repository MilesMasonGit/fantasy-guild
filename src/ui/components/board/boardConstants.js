// Fantasy Guild — Board presentation constants (UI-only).

/**
 * What is left here is presentation: offsets and hit boxes that only React
 * draws with, and the pointer-to-tile snapping the drag layer uses.
 *
 * The board's actual geometry — its size, tile count, Guild Hall tile, tile
 * metrics and footprint maths — lives in `src/config/boardGeometry.js`, because
 * the board engine in `src/systems/board/` depends on it and must not import
 * out of the UI tree (CR2-051). Import geometry from there, not from here;
 * this file deliberately does not re-export it.
 */

import { BOARD_SIZE, TILE_PX, TILE_GAP_PX, TILE_STEP_PX } from '../../../config/boardGeometry.js';

/**
 * How far the hero and the Token slide apart on a staffed tile (D-266).
 *
 * A hero and the Token they work are **both drawn at full `TILE_PX`**, then
 * pushed in opposite directions — hero left, Token right — so each is 24px off
 * centre and 48px apart. They still overlap across 80 of their 128 pixels, which
 * is the point: two readable silhouettes that are plainly one stacked unit.
 */
export const PAIR_OFFSET_PX = 24;

/**
 * The hero's clickable box — narrower than the art it draws.
 */
export const HERO_HIT_PX = 64;

/**
 * Calculates the best 2x2 top-left anchor tile given pointer coordinates on the board.
 * Snaps to the nearest top-left anchor in the grid with gap support.
 *
 * @param {number} px X pixel coordinate relative to top-left of board
 * @param {number} py Y pixel coordinate relative to top-left of board
 * @returns {number} Top-left tile index for the 2x2 block
 */
export function closest2x2Anchor(px, py) {
    const footSpan = 2 * TILE_PX + TILE_GAP_PX;
    const step = TILE_STEP_PX;
    const anchorCol = Math.max(0, Math.min(BOARD_SIZE - 2, Math.round((px - footSpan / 2) / step)));
    const anchorRow = Math.max(0, Math.min(BOARD_SIZE - 2, Math.round((py - footSpan / 2) / step)));
    return anchorRow * BOARD_SIZE + anchorCol;
}

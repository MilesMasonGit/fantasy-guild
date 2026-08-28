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
import { ALERT } from '../../../systems/board/boardEvents.js';

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

/**
 * What the red mark means, in the player's words (D-114).
 *
 * Hovering a tile whose Token cannot work states exactly what is wrong. There
 * is no aggregate supply dashboard, so diagnosis happens tile by tile, and this
 * table is the whole of it. Two surfaces read it: the tile's own `title`
 * (`BoardTile`) and the hover panel under the alert bar (`TileProgressBar`).
 *
 * Keyed off the engine's exported `ALERT` so the two vocabularies cannot drift.
 * That now includes `UNSTOCKED`, which `Managers` publishes (CR2-060); it used
 * to be the one alert spelled out as a bare string in three separate files.
 */
export const ALERT_HINT = {
    [ALERT.INPUTS]: 'Waiting for materials — nothing in the Bank or on the board',
    [ALERT.ACCESS]: 'This hero’s skill is too low to work this Token',
    [ALERT.UNSKILLED]: 'This hero doesn’t have the skill for this work — levelling won’t help',
    [ALERT.NO_RECIPE]: 'This station is missing a Token its recipe needs beside it',
    [ALERT.CHARGES]: 'Not enough charges left here to run a full cycle',
    [ALERT.UNSTOCKED]: 'This tile ran dry and the Vault has no replacement — restock it'
};

/** The two-word label printed on the alert bar itself. The sentence is in `ALERT_HINT`. */
export const ALERT_LABEL = {
    [ALERT.INPUTS]: 'Need Items',
    [ALERT.ACCESS]: 'Level Too Low',
    [ALERT.UNSKILLED]: 'Wrong Skill',
    [ALERT.NO_RECIPE]: 'Need Tokens',
    [ALERT.CHARGES]: 'Need Charges',
    [ALERT.UNSTOCKED]: 'Restock'
};

/** Alerts drawn in warning yellow; every other alert is drawn in red. */
const YELLOW_ALERTS = [ALERT.INPUTS];

/** The bar's fill class for an alert value. */
export const alertFillClass = (alert) =>
    YELLOW_ALERTS.includes(alert) ? 'progress-fill--yellow-chroma' : 'progress-fill--red-chroma';

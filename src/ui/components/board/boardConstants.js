// Fantasy Guild — Board geometry constants (7×7 Playmat rework, Phase 1)

/**
 * The board is a fixed 7×7 forever (D-1). There is no expansion mechanic, so
 * these are constants rather than configuration.
 */
export const BOARD_SIZE = 7;

/** 49 tiles, of which 48 are usable (D-106). */
export const TILE_COUNT = BOARD_SIZE * BOARD_SIZE;

/**
 * The centre tile is a permanent Guild Hall — not placeable, not removable
 * (D-106). Index 24 in a row-major 7×7: row 3, column 3.
 */
export const GUILD_HALL_TILE = Math.floor(TILE_COUNT / 2);

/**
 * Token art is 64px displayed at 2× on a tile (D-216), giving 128px tiles.
 * An 8px buffer/gap between tiles gives a 944px board (128*7 + 8*6 = 944).
 */
export const ART_PX = 64;
export const TILE_SCALE = 2;
export const TILE_PX = ART_PX * TILE_SCALE;
export const TILE_GAP_PX = 8;
export const TILE_STEP_PX = TILE_PX + TILE_GAP_PX;
export const BOARD_PX = TILE_PX * BOARD_SIZE + TILE_GAP_PX * (BOARD_SIZE - 1);

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

/** Row and column of a tile index, row-major. */
export const rowOf = (index) => Math.floor(index / BOARD_SIZE);
export const colOf = (index) => index % BOARD_SIZE;

/** Whether an index is a real tile on the board. */
export const isTileIndex = (index) =>
    Number.isInteger(index) && index >= 0 && index < TILE_COUNT;

/** Whether a tile can hold anything at all — everything except the Guild Hall. */
export const isPlaceable = (index) =>
    isTileIndex(index) && index !== GUILD_HALL_TILE;

/**
 * Returns the array of tile indices occupied by a token anchored at `anchorIndex`
 * with given size (1 for 1x1, 2 for 2x2).
 */
export function tileFootprint(anchorIndex, size = 1) {
    if (!isTileIndex(anchorIndex)) return [];
    if (size === 1) return [anchorIndex];
    if (size === 2) {
        return [
            anchorIndex,
            anchorIndex + 1,
            anchorIndex + BOARD_SIZE,
            anchorIndex + BOARD_SIZE + 1
        ];
    }
    return [anchorIndex];
}

/**
 * Checks whether a token with `size` anchored at `anchorIndex` fits within board bounds.
 */
export function isFootprintInBounds(anchorIndex, size = 1) {
    if (!isTileIndex(anchorIndex)) return false;
    if (size === 1) return true;
    if (size === 2) {
        const row = rowOf(anchorIndex);
        const col = colOf(anchorIndex);
        return row >= 0 && row < BOARD_SIZE - 1 && col >= 0 && col < BOARD_SIZE - 1;
    }
    return false;
}

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
 * Returns the outward quadrant direction for each tile in a 2x2 footprint.
 * TL: Up / Left, TR: Up / Right, BL: Down / Left, BR: Down / Right.
 */
export function quadrantPushVectors(anchorIndex) {
    return {
        [anchorIndex]: { primary: { dRow: -1, dCol: 0 }, secondary: { dRow: 0, dCol: -1 }, label: 'TL' },
        [anchorIndex + 1]: { primary: { dRow: -1, dCol: 0 }, secondary: { dRow: 0, dCol: 1 }, label: 'TR' },
        [anchorIndex + BOARD_SIZE]: { primary: { dRow: 1, dCol: 0 }, secondary: { dRow: 0, dCol: -1 }, label: 'BL' },
        [anchorIndex + BOARD_SIZE + 1]: { primary: { dRow: 1, dCol: 0 }, secondary: { dRow: 0, dCol: 1 }, label: 'BR' }
    };
}

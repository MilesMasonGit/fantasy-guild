// Fantasy Guild — Board geometry (engine-owned).

/**
 * The shape of the playmat, in tiles and in pixels.
 *
 * This lives in `src/config/` rather than `src/ui/` because the board *engine*
 * depends on it: `BoardState`, `Placement`, `SpriteLayer`, `adjacency` and
 * `Restrictions` all need to know how big the board is, which tile is the Guild
 * Hall, and where a tile sits in pixel space. `src/systems/` is meant to be
 * React-agnostic, so the geometry cannot live inside a component folder
 * (CR2-051). The Guild Hall upgrade tree reads the same numbers from here too,
 * so the board exists once rather than twice (CR2-104).
 *
 * Values that only React cares about — hero/token art offsets, hit boxes,
 * pointer snapping — stay in `src/ui/components/board/boardConstants.js`.
 */

/**
 * The board is a fixed 7×7 forever (D-1). There is no expansion mechanic, so
 * these are constants rather than configuration.
 */
export const BOARD_SIZE = 7;

/** 49 tiles, of which 48 are usable (D-106). */
export const TILE_COUNT = BOARD_SIZE * BOARD_SIZE;

/**
 * The centre tile (Index 24 in a row-major 7×7: row 3, column 3).
 */
export const GUILD_HALL_TILE = Math.floor(TILE_COUNT / 2);

/**
 * Token art is 64px displayed at 2× on a tile (D-216), giving 128px tiles.
 * An 8px buffer/gap between tiles gives a 944px board (128*7 + 8*6 = 944).
 *
 * ⚠️ `BOARD_PX` is a compile-time constant and sprite coordinates are stored
 * against it. Do not make it dynamic (CR2-050 was refuted on this point).
 */
export const ART_PX = 64;
export const TILE_SCALE = 2;
export const TILE_PX = ART_PX * TILE_SCALE;
export const TILE_GAP_PX = 8;
export const TILE_STEP_PX = TILE_PX + TILE_GAP_PX;
export const BOARD_PX = TILE_PX * BOARD_SIZE + TILE_GAP_PX * (BOARD_SIZE - 1);

/** Row and column of a tile index, row-major. */
export const rowOf = (index) => Math.floor(index / BOARD_SIZE);
export const colOf = (index) => index % BOARD_SIZE;

/** Whether an index is a real tile on the board. */
export const isTileIndex = (index) =>
    Number.isInteger(index) && index >= 0 && index < TILE_COUNT;

/** Whether a tile can hold anything at all — all 49 tiles are placeable. */
export const isPlaceable = (index) => isTileIndex(index);

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

/**
 * Returns the prioritized push directions for any 1x1 tile index.
 * Prefers moving outward from the central Guild Hall (row 3, col 3) towards outer edges,
 * then checks remaining directions if outward space is unavailable.
 */
export function getTilePushVectors(index) {
    const row = rowOf(index);
    const col = colOf(index);

    const verticalDir = row <= 3 ? -1 : 1;
    const horizontalDir = col <= 3 ? -1 : 1;

    const vDist = Math.abs(row - 3);
    const hDist = Math.abs(col - 3);

    const outwardV = { dRow: verticalDir, dCol: 0 };
    const outwardH = { dRow: 0, dCol: horizontalDir };
    const inwardH = { dRow: 0, dCol: -horizontalDir };
    const inwardV = { dRow: -verticalDir, dCol: 0 };

    const directions = vDist >= hDist
        ? [outwardV, outwardH, inwardH, inwardV]
        : [outwardH, outwardV, inwardV, inwardH];

    directions.primary = directions[0];
    directions.secondary = directions[1];
    return directions;
}

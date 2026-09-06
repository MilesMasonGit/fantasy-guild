// Fantasy Guild — Board geometry (engine-owned).

/**
 * The shape of the playmat, in tiles and in pixels.
 *
 * This lives in `src/config/` rather than `src/ui/` because the board *engine*
 * depends on it: `BoardState`, `Placement`, `SpriteLayer`, `adjacency` and
 * `Restrictions` all need to know how big the board is, which tile is the Guild
 * Hall, and where a tile sits in pixel space. `src/systems/` is meant to be
 * React-agnostic, so the geometry cannot live inside a component folder
 * (CR2-051). The Guild Hall upgrade board's geometry lives here too, at the
 * bottom of this file — it is a second, differently-shaped board, but keeping
 * both here means board geometry is still described in exactly one place
 * (CR2-104).
 *
 * Values that only React cares about — hero/token art offsets, hit boxes,
 * pointer snapping — stay in `src/ui/components/board/boardConstants.js`.
 */

/**
 * The board is a fixed 6×6. There is no expansion mechanic, so these are
 * constants rather than configuration.
 */
export const BOARD_SIZE = 6;

/** 36 tiles, of which 35 are usable once the Guild Hall takes its own. */
export const TILE_COUNT = BOARD_SIZE * BOARD_SIZE;

/**
 * Row and column of the Guild Hall — `floor(BOARD_SIZE / 2)` in both axes.
 *
 * On an odd board that is dead centre. On the current even 6×6 there is no
 * true centre tile, so the Hall sits one half-tile down and right of it: row 3,
 * column 3, index 21. It still has all eight neighbours, and it is the same
 * point `getTilePushVectors` treats as the origin things get pushed away from.
 */
export const GUILD_HALL_ROW = Math.floor(BOARD_SIZE / 2);
export const GUILD_HALL_COL = Math.floor(BOARD_SIZE / 2);
export const GUILD_HALL_TILE = GUILD_HALL_ROW * BOARD_SIZE + GUILD_HALL_COL;

/**
 * Token art is 64px displayed at 2× on a tile (D-216), giving 128px tiles.
 * A 32px gap between tiles gives a 928px board (128*6 + 32*5 = 928).
 *
 * ⚠️ `BOARD_PX` is a compile-time constant and sprite coordinates are stored
 * against it. Do not make it dynamic (CR2-050 was refuted on this point).
 */
export const ART_PX = 64;
export const TILE_SCALE = 2;
export const TILE_PX = ART_PX * TILE_SCALE;
export const TILE_GAP_PX = 32;
export const TILE_STEP_PX = TILE_PX + TILE_GAP_PX;
export const BOARD_PX = TILE_PX * BOARD_SIZE + TILE_GAP_PX * (BOARD_SIZE - 1);

/** Row and column of a tile index, row-major. */
export const rowOf = (index) => Math.floor(index / BOARD_SIZE);
export const colOf = (index) => index % BOARD_SIZE;

/** Whether an index is a real tile on the board. */
export const isTileIndex = (index) =>
    Number.isInteger(index) && index >= 0 && index < TILE_COUNT;

/** Whether a tile can hold anything at all — every tile is placeable. */
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
 * Prefers moving outward from the Guild Hall tile towards the outer edges,
 * then checks remaining directions if outward space is unavailable.
 */
export function getTilePushVectors(index) {
    const row = rowOf(index);
    const col = colOf(index);

    const verticalDir = row <= GUILD_HALL_ROW ? -1 : 1;
    const horizontalDir = col <= GUILD_HALL_COL ? -1 : 1;

    const vDist = Math.abs(row - GUILD_HALL_ROW);
    const hDist = Math.abs(col - GUILD_HALL_COL);

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

// ---------------------------------------------------------------------------
// The Guild Hall upgrade board
// ---------------------------------------------------------------------------

/**
 * The upgrade board is a separate 7×7 surface and does NOT follow the playmat.
 *
 * The two used to share `BOARD_SIZE`, on the reasoning that they are the same
 * object seen twice. They are not: the playmat is a space the player fills and
 * re-arranges, so its size is a live design question, while the upgrade board
 * is a fixed diagram of a fixed upgrade tree. When the playmat went to 6×6 the
 * upgrade board stayed where it was, and these constants are why.
 *
 * ⚠️ Nothing here is interchangeable with the playmat constants above. A tile
 * index means a different square on each board, so an index from one is
 * meaningless on the other — the two never exchange them.
 */
export const UPGRADE_BOARD_SIZE = 7;

/** 49 tiles, six of which carry an upgrade. */
export const UPGRADE_BOARD_TILE_COUNT = UPGRADE_BOARD_SIZE * UPGRADE_BOARD_SIZE;

/** The Guild Hall itself, dead centre: row 3, column 3, index 24. */
export const UPGRADE_BOARD_GUILD_HALL_TILE =
    Math.floor(UPGRADE_BOARD_SIZE / 2) * UPGRADE_BOARD_SIZE + Math.floor(UPGRADE_BOARD_SIZE / 2);

/** 128px tiles with an 8px gap: 128*7 + 8*6 = 944. */
export const UPGRADE_BOARD_TILE_GAP_PX = 8;
export const UPGRADE_BOARD_PX =
    TILE_PX * UPGRADE_BOARD_SIZE + UPGRADE_BOARD_TILE_GAP_PX * (UPGRADE_BOARD_SIZE - 1);

/** Row and column of a tile index on the upgrade board, row-major. */
export const upgradeRowOf = (index) => Math.floor(index / UPGRADE_BOARD_SIZE);
export const upgradeColOf = (index) => index % UPGRADE_BOARD_SIZE;

// Fantasy Guild — The Guild Hall upgrade board's geometry (Free Playmat slice 1.6d-2).

/**
 * ⭐ **The one board in the game that still has tiles, and the only one.**
 *
 * The playmat is a free surface: Tokens and flags sit wherever they are put, and
 * slice 1.6d-2 deleted every tile the game had. This file is what survived that
 * deletion, because the Guild Hall upgrade board is **not the playmat seen
 * twice** — it is a fixed diagram of a fixed upgrade tree, a 7×7 grid of squares
 * that the player reads rather than arranges.
 *
 * The two used to share `boardGeometry.js`, on the reasoning that they were the
 * same object. They were not, and the playmat's half of that file is now gone.
 *
 * ⚠️ Nothing here is interchangeable with a mat point. A tile index means a
 * square on this diagram and nothing else; the playmat has no indices at all any
 * more, so there is nothing left to confuse one with.
 */

/** The upgrade board is a fixed 7×7. */
export const UPGRADE_BOARD_SIZE = 7;

/** 49 tiles, six of which carry an upgrade. */
export const UPGRADE_BOARD_TILE_COUNT = UPGRADE_BOARD_SIZE * UPGRADE_BOARD_SIZE;

/** The Guild Hall itself, dead centre: row 3, column 3, index 24. */
export const UPGRADE_BOARD_GUILD_HALL_TILE =
    Math.floor(UPGRADE_BOARD_SIZE / 2) * UPGRADE_BOARD_SIZE + Math.floor(UPGRADE_BOARD_SIZE / 2);

/**
 * One square of the diagram, in pixels.
 *
 * Held here rather than imported, so this board's look cannot be changed by
 * retuning Token art. It happens to equal the Token art size today (64 × 2), and
 * that coincidence is exactly what used to tie the two boards together.
 */
export const UPGRADE_BOARD_TILE_PX = 128;

/** 128px tiles with an 8px gap: 128*7 + 8*6 = 944. */
export const UPGRADE_BOARD_TILE_GAP_PX = 8;
export const UPGRADE_BOARD_PX =
    UPGRADE_BOARD_TILE_PX * UPGRADE_BOARD_SIZE + UPGRADE_BOARD_TILE_GAP_PX * (UPGRADE_BOARD_SIZE - 1);

/** Row and column of a tile index on the upgrade board, row-major. */
export const upgradeRowOf = (index) => Math.floor(index / UPGRADE_BOARD_SIZE);
export const upgradeColOf = (index) => index % UPGRADE_BOARD_SIZE;

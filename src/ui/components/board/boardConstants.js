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
 * Token art is 32px displayed at 4× (D-171), giving 128px tiles and an 896px
 * board — comfortably the dominant element beside a ~25% Tray.
 *
 * **Integer scaling is required, not preferred**: the art is pixel art and
 * fractional scaling blurs it. A future "small mode" for narrow windows must
 * therefore drop to a whole-number scale (3× or 2×), never a CSS shrink.
 *
 * Nothing may hardcode 128 — small mode is deferred (roadmap G-20), and keeping
 * the size in one place is what makes it a config change later rather than a
 * layout rewrite.
 */
export const ART_PX = 32;
export const TILE_SCALE = 4;
export const TILE_PX = ART_PX * TILE_SCALE;
export const BOARD_PX = TILE_PX * BOARD_SIZE;

/** Row and column of a tile index, row-major. */
export const rowOf = (index) => Math.floor(index / BOARD_SIZE);
export const colOf = (index) => index % BOARD_SIZE;

/** Whether an index is a real tile on the board. */
export const isTileIndex = (index) =>
    Number.isInteger(index) && index >= 0 && index < TILE_COUNT;

/** Whether a tile can hold anything at all — everything except the Guild Hall. */
export const isPlaceable = (index) =>
    isTileIndex(index) && index !== GUILD_HALL_TILE;

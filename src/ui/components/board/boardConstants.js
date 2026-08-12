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
 * Token art is 64px displayed at 2× on a tile (D-216), giving 128px tiles and
 * an 896px board — comfortably the dominant element beside a ~25% Tray.
 *
 * **Integer scaling is required, not preferred**: the art is pixel art and
 * fractional scaling blurs it. A future "small mode" for narrow windows must
 * therefore drop to a whole-number scale (1×), never a CSS shrink.
 *
 * Nothing may hardcode 128 — small mode is deferred (roadmap G-20), and keeping
 * the size in one place is what makes it a config change later rather than a
 * layout rewrite.
 *
 * ⚠️ **D-216 amends D-171's arithmetic, not its conclusions.** D-171 said "32px
 * art at 4×", which was measured from the placeholder *skill* icons the game
 * currently draws. The real Token pipeline is **64×64** — see
 * `.agent/skills/Artist/SKILL.md` ("32×32 = Items, 64×64 = Tokens"), and the 15
 * finished sprites already sitting in `public/assets/tokens/`. Corroborated by
 * the floor tiles in `public/assets/playmat/tiles/`, which are natively 128×128.
 *
 * `TILE_PX` and `BOARD_PX` are **identical under both readings** (32×4 = 64×2 =
 * 128). Only the source grid and the scale move, which is why nothing about the
 * board's geometry changes here.
 */
export const ART_PX = 64;
export const TILE_SCALE = 2;
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

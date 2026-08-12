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

/**
 * How far the hero and the Token slide apart on a staffed tile (D-266).
 *
 * A hero and the Token they work are **both drawn at full `TILE_PX`**, then
 * pushed in opposite directions — hero left, Token right — so each is 24px off
 * centre and 48px apart. They still overlap across 80 of their 128 pixels, which
 * is the point: two readable silhouettes that are plainly one stacked unit,
 * rather than a hero-shaped hole punched in the Token art.
 *
 * ⚠️ **The pair overhangs its tile by this much on each side, deliberately.**
 * 128 + 48 does not fit in 128 and was never going to — the owner chose spill
 * over shrinking either sprite, and shrinking was not really available anyway:
 * the scale rules above allow 64px or 128px and nothing between. Two consequences
 * follow, and both are load-bearing:
 *
 *  - **Nothing on the board may clip.** `Board.jsx` pads its scroll container to
 *    32px for exactly this reason. A tile that ever gains `overflow-hidden`
 *    beheads its neighbour's hero.
 *  - **Paint order does the depth work for free.** Tiles render in index order,
 *    so later tiles cover earlier ones: a left-shifted hero lands on top of the
 *    left neighbour's Token, and each row overlaps the row above it. That is the
 *    correct stacking, and it costs no `z-index` at all — which is why there
 *    isn't one. Reordering the grid would silently invert it.
 *
 * Must stay **even**: it is applied to art drawn at 2×, and an odd offset puts
 * the sprite half a source pixel off the grid, which is the fractional scaling
 * `ART_PX` exists to prevent.
 */
export const PAIR_OFFSET_PX = 24;

/**
 * The hero's clickable box — narrower than the art it draws.
 *
 * The hero is a 128px sprite sitting on top of a 128px Token, so a hit area
 * matching the art would swallow nearly every click meant for the Token
 * underneath: inspect-on-click (D-145) and tile-to-tile Token drags both live on
 * the tile behind it. 64px centred on the hero keeps the figure's body grabbable
 * for the redeploy drag (D-134) while leaving the Token's right side free.
 *
 * The art overflows this box on both sides and is `pointer-events-none`, so what
 * you see and what you can grab are deliberately different shapes.
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

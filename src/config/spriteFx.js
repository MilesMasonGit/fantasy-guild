// Fantasy Guild — the ready-made shadow and outline images.

/**
 * ⭐ **Shadows and outlines are pictures, not filters.**
 *
 * - **Hard shadow:** a solid black silhouette of the sprite, 2 art-pixels down
 *   and to the right, shown ONLY on a Token being dragged and on floating loot.
 *   A Token resting on the board has no shadow.
 * - **Outlines replace the glow:** green = working, white = hovered or
 *   selected, red = alert. They sit around the art's own 1-px black outline.
 *
 * Both are generated from the sprite PNGs by `scripts/spriteFx.mjs` (a Vite
 * plugin: on `npm run dev` and `npm run build`, and again whenever a sprite is
 * added or changed while the dev server runs) into the git-ignored
 * `public/_gen/sprite-fx/`. Nothing is written into `public/assets/`.
 *
 * ⚠️ **This file imports nothing**, because the generator (plain Node) reads it
 * as well as the game. It is the one place the two agree on names and sizes.
 */

/** Where the generated images live, under `public/` (and so under `dist/`). */
export const SPRITE_FX_DIR = '_gen/sprite-fx';

/** Bump to make every machine regenerate everything on its next start. */
export const SPRITE_FX_VERSION = 2;

/**
 * The outline colours, as RGB. `work` is `--color-gi-success` (#09b554);
 * `alert` is Tailwind red-500, the alert badges' red.
 */
export const OUTLINE_COLOURS = Object.freeze({
    work: [9, 181, 84],
    hover: [255, 255, 255],
    alert: [239, 68, 68]
});

/**
 * ⭐ **The outline is one art pixel, on the art's own grid, cardinal only**. An outline pixel sits
 * where a clear pixel touches the art EDGE TO EDGE — up, down, left or right —
 * never where it only touches it corner to corner. That is a plus-shaped
 * (4-connected) dilation of the full alpha mask (the art's own black border
 * counts as art), minus the art. It is drawn scaled with the sprite, exactly
 * like the art, so every outline pixel is a whole art pixel.
 *
 * Why not 8-connected: the corner-only pixels it adds make "doubles" — L-shaped
 * clumps where a 1-px line turns — and a line that looks chunky and uneven.
 * Why not thinner than an art pixel: on a 2× sprite that draws half-pixels,
 * off the art's grid.
 */
/**
 * Animated sprite sheets: their frame grid, so an outline is grown **inside
 * each frame's cell** and never bleeds into the next frame. The same numbers
 * `AnimatedHeroSprite` (8 × 3) and `AnimatedEnemySprite` (4 × 4) draw with —
 * they import them from here.
 */
export const HERO_SHEET_GRID = Object.freeze({ cols: 8, rows: 3 });
export const ENEMY_SHEET_GRID = Object.freeze({ cols: 4, rows: 4 });

export const SHEET_GRIDS = Object.freeze([
    { test: /^assets\/heroes\/animations\/ani_[^/]+\.png$/i, ...HERO_SHEET_GRID },
    { test: /^assets\/enemies\/.+\/ani_[^/]+\.png$/i, ...ENEMY_SHEET_GRID }
]);

/** The sheet grid for an asset path (`assets/...`), or null for a single sprite. */
export function sheetGridOf(rel) {
    const hit = SHEET_GRIDS.find(g => g.test.test(rel));
    return hit ? { cols: hit.cols, rows: hit.rows } : null;
}

/**
 * Which sprites get outlines as well as a silhouette: anything that can stand
 * on the mat. A Token's art may be any sprite the CMS points it at — the
 * stress boards' fixture Tokens wear skill icons, two real Tokens borrow
 * playmat art — so that is everything except the UI's own chrome. Flags are
 * the one UI sprite on the mat.
 */
export function isOutlined(rel) {
    if (/^assets\/ui\/flag\//i.test(rel)) return true;
    return !/^assets\/ui\//i.test(rel);
}

/** Folders never processed: not sprites, or not shipped. */
export const SKIPPED_DIRS = Object.freeze(['archive', 'audio', 'backgrounds', 'maybe', 'waste']);

/** Larger images are backgrounds or icons, never mat sprites. */
export const MAX_SILHOUETTE_PX = 512;
export const MAX_OUTLINE_PX = 512;

/** Folder names, relative to `SPRITE_FX_DIR`. */
export const silhouetteFolder = () => 'sil';
export const outlineFolder = (colour) => `ol-${colour}`;

/**
 * The hard shadow's offset, in whole screen pixels: 2 art pixels, where one
 * art pixel is `k` screen pixels — never less than one.
 */
export const SHADOW_ART_PX = 2;
export function shadowScreenPx(k) {
    return Math.max(1, Math.round(SHADOW_ART_PX * k));
}

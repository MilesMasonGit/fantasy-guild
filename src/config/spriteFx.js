// Fantasy Guild — the ready-made shadow and outline images (Wave 5, CR3-350).

/**
 * ⭐ **Shadows and outlines are pictures, not filters** (owner rulings, Z §11,
 * "Shadows and outlines — owner rulings after the spike", 2026-09-30).
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
export const SPRITE_FX_VERSION = 1;

/**
 * The outline colours, as RGB. `work` is `--color-gi-success` (#09b554, the
 * old working glow's green); `alert` is Tailwind red-500, the alert badges' red.
 */
export const OUTLINE_COLOURS = Object.freeze({
    work: [9, 181, 84],
    hover: [255, 255, 255],
    alert: [239, 68, 68]
});

/**
 * The outline images made for each outlined sprite. `u` is how many times the
 * art is enlarged (nearest-neighbour) before it is outlined; `r` is how many
 * of those enlarged pixels the outline is thick.
 *
 * Why several: on screen an outline is `r × k / u` pixels thick, where `k` is
 * how many screen pixels one pixel of the source art covers (2 for a Token at
 * the usual 2× size). "1 screen pixel" at `k = 2` therefore needs the art
 * enlarged 2× first (`u2r1`); "1 art pixel" is `u1r1`. A sprite drawn at half
 * its art size (`k = 0.5`) needs `u1r2` so the line still lands on one whole
 * screen pixel. `pickOutlineVariant` chooses.
 */
export const OUTLINE_VARIANTS = Object.freeze([
    Object.freeze({ u: 1, r: 1 }),
    Object.freeze({ u: 1, r: 2 }),
    Object.freeze({ u: 2, r: 1 }),
    Object.freeze({ u: 3, r: 1 }),
    Object.freeze({ u: 4, r: 1 })
]);

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
export const outlineFolder = (colour, { u, r }) => `ol-${colour}-u${u}r${r}`;

/**
 * The outline image to draw for a sprite whose source pixel covers `k` screen
 * pixels, for the thickness setting `mode`:
 *
 * - `'screen'` — 1 screen pixel, whatever the sprite's size;
 * - `'art'` — 1 pixel of the art as drawn (`k` screen pixels), never less
 *   than one screen pixel.
 *
 * Picks the variant whose thickness is closest to the target; on a tie, the
 * smaller image.
 */
export function pickOutlineVariant(k, mode = 'screen') {
    const target = mode === 'art' ? Math.max(1, k) : 1;
    let best = OUTLINE_VARIANTS[0];
    let bestErr = Infinity;
    for (const v of OUTLINE_VARIANTS) {
        const err = Math.abs((v.r * k) / v.u - target);
        if (err < bestErr - 1e-9 || (Math.abs(err - bestErr) <= 1e-9 && v.u < best.u)) {
            best = v;
            bestErr = err;
        }
    }
    return best;
}

/**
 * The hard shadow's offset, in whole screen pixels: 2 art pixels (owner
 * ruling), where one art pixel is `k` screen pixels — never less than one.
 */
export const SHADOW_ART_PX = 2;
export function shadowScreenPx(k) {
    return Math.max(1, Math.round(SHADOW_ART_PX * k));
}

// Fantasy Guild — how the ground looks: the five looks and the sheets they draw with.

import { TERRAIN } from '../../systems/atlas/TerrainMap.js';

/**
 * A Region's ground is its Atlas cell map (`TerrainMap.js`): one terrain per cell. This says what
 * each terrain *looks like*: one look per terrain per Region, from the biome that owns that
 * terrain (`regionGround.looksForGround`), so a hybrid's grass is forest grass and its rock
 * mountain rock, and grass no biome owns is meadow.
 *
 * ## Why this lives in code and not the CMS
 *
 * Presentation config, like `sprite-manifest.js` beside it: no balance numbers, nothing a player
 * reads as content. A code table so the look can be iterated on without building an editor.
 *
 * ⚠️ **Art paths live here rather than in `sprite-manifest.js`.** The CMS *writes* that file
 * (`cms/vite-plugin-cms-api.js` POST /api/register-sprite), so it is a CMS-owned artefact; ground
 * art is not CMS content.
 */

/**
 * ⭐ **The terrain master switch.** While false the ground is not drawn (`MatBoard.jsx`) and the
 * Playmat Tuner is hidden (`ReactRoot.jsx`). Read at the point of use, never copied.
 * `TerrainOff.test.js` fails if a guard goes.
 */
export const TERRAIN_ENABLED = false;

/** A ground sheet's side in pixels: each is one seamless fill. */
export const SHEET_PX = 64;

/**
 * The ground sheets in `public/assets/playmat/terrain/` (`ter_<id>.png`), one per ground. The two
 * "b" sheets are recolours: `grassb` is the forest's darker ground; `waterb`, a much brighter sea,
 * waits for a lake (it is drawn, and no look uses it yet).
 */
export const SHEETS = Object.freeze(['grass', 'grassb', 'dirt', 'gravel', 'sand', 'stone', 'water', 'waterb']);

/** Where a ground sheet lives. */
export function sheetPath(sheetId) {
    return `/assets/playmat/terrain/ter_${sheetId}.png`;
}

/** A prop's side in pixels: one prop pixel is one ground pixel, the same size as a Token's. */
export const PROP_PX = 16;

/** Props across (and down) one prop sheet. */
export const PROP_SHEET_CELLS = 4;

/**
 * The owner's prop sheets in `public/assets/playmat/props/`: each a 4 × 4 grid of 16-pixel flat
 * bits, fully opaque or fully clear. `props/sheets/` holds irregular source sheets the game does
 * not read.
 */
export const PROP_SHEETS = Object.freeze([
    'prop_bush', 'prop_bush_dark', 'prop_coast', 'prop_flowers', 'prop_mushroom', 'prop_rock', 'prop_rock_sand'
]);

/** Where a prop sheet lives. */
export function propSheetPath(sheetId) {
    return `/assets/playmat/props/${sheetId}.png`;
}

function deepFreeze(value) {
    if (value && typeof value === 'object') {
        for (const v of Object.values(value)) deepFreeze(v);
        Object.freeze(value);
    }
    return value;
}

/**
 * The five looks. Each draws one terrain:
 * - `sheets`: the ground sheet, or its alternates; a Region draws one of them throughout, picked
 *   by its seed (`TerrainSurface.sheetFor`). Never one per cell: two seamless sheets side by side
 *   show a square seam.
 * - `wear`: a second sheet showing through in clumps, `coverage` the share of the ground it takes
 *   (calibrated, `TerrainPatches`).
 * - `band`: how the look shades its own edge where `against` (any other ground when absent)
 *   touches it: a `tint` mixed in by `amount`, as wide as the `widthTuning` slider (mat units).
 * - `fringe`: a different terrain written onto the neighbours, `widthTuning` wide: the beach the
 *   sea cuts into whatever land it meets, except the terrains in `except`.
 * - `props`: the prop sheets it scatters from, by weight; `propDensity` the share of its cells
 *   that carry one.
 *
 * ⚠️ First values, retuned at the eye-check with the Playmat Tuner. The shoreline widths (the
 * tuning sliders) and the wear shares carry over from the 8-pixel ground set, where an art pixel
 * was 4 units; the gravel share and the scatter are guesses.
 */
export const LOOKS = deepFreeze({
    meadow: {
        id: 'meadow', name: 'Meadow', terrain: TERRAIN.GRASS, sheets: ['grass'],
        wear: { sheet: 'dirt', coverage: 0.18 },
        props: [{ sheet: 'prop_flowers', weight: 2 }, { sheet: 'prop_bush', weight: 1 }],
        propDensity: 0.06
    },
    forest: {
        id: 'forest', name: 'Forest', terrain: TERRAIN.GRASS, sheets: ['grassb'],
        // Less than the meadow: leaf litter and shade, not footfall.
        wear: { sheet: 'dirt', coverage: 0.12 },
        props: [
            { sheet: 'prop_bush_dark', weight: 2 }, { sheet: 'prop_mushroom', weight: 1 }, { sheet: 'prop_flowers', weight: 1 }
        ],
        propDensity: 0.1
    },
    mountain: {
        id: 'mountain', name: 'Mountain', terrain: TERRAIN.ROCK, sheets: ['stone'],
        wear: { sheet: 'gravel', coverage: 0.15 },
        props: [{ sheet: 'prop_rock', weight: 1 }],
        propDensity: 0.05
    },
    coast: {
        id: 'coast', name: 'Coast', terrain: TERRAIN.SAND, sheets: ['sand'],
        // Wet sand where the water reaches: caused by the water, not by having an edge, or the
        // beach comes out wet where it meets the grass.
        band: { widthTuning: 'wetSandWidth', tint: '#6b4a25', amount: 0.3, against: [TERRAIN.WATER] },
        props: [{ sheet: 'prop_coast', weight: 2 }, { sheet: 'prop_rock_sand', weight: 1 }],
        propDensity: 0.05
    },
    sea: {
        id: 'sea', name: 'Sea', terrain: TERRAIN.WATER, sheets: ['water'],
        // Shallows: the sea going pale wherever it meets land.
        band: { widthTuning: 'shallowsWidth', tint: '#a8e8ff', amount: 0.45 },
        // A beach wherever it comes ashore, so water never meets grass or rock directly. Written
        // onto the land as real sand, so it takes the wet-sand band, no wear and no forest scatter.
        fringe: { terrain: TERRAIN.SAND, widthTuning: 'beachWidth', except: [] }
    }
});

/** The look a terrain takes when no biome in the Region owns it. */
export const DEFAULT_LOOK = Object.freeze({
    [TERRAIN.GRASS]: 'meadow',
    [TERRAIN.ROCK]: 'mountain',
    [TERRAIN.SAND]: 'coast',
    [TERRAIN.WATER]: 'sea'
});

/** A look by id, or null. */
export function getLook(lookId) {
    return Object.prototype.hasOwnProperty.call(LOOKS, lookId) ? LOOKS[lookId] : null;
}

/** How a look shades its own edge, or null. */
export function bandOf(lookId) {
    return getLook(lookId)?.band || null;
}

/** The terrain a look writes onto its neighbours, or null. */
export function fringeOf(lookId) {
    return getLook(lookId)?.fringe || null;
}

/** The sheet worn through a look, and how much of it shows, or null. */
export function wearOf(lookId) {
    return getLook(lookId)?.wear || null;
}

/** The props a look scatters and how thickly, or null. */
export function propsOf(lookId) {
    const look = getLook(lookId);
    if (!look?.props?.length) return null;
    return { props: look.props, density: look.propDensity || 0 };
}

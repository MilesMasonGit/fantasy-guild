// the ground plan: what every plan pixel of a Region's ground should look like

import { resolveArtPixels, hash01, PLAN_PIXEL_U } from './TerrainLattice.js';
import { buildBandMasks } from './TerrainBands.js';
import { buildWearMask } from './TerrainPatches.js';
import { propsForGround } from './TerrainProps.js';
import { getLook, LOOKS } from '../../config/registries/terrainRegistry.js';
import { tuning } from '../../config/playmatTuning.js';

/**
 * Built in two stages, never per frame: this plan (which ground, wear, band and scatter at every
 * 2-unit pixel, independent of the window) when the Region changes or a tuning slider moves; then
 * a screen pass that resamples it onto the screen's ground pixels and samples the sheets.
 *
 * ⚠️ One answer per pixel rather than one drawing pass per feature: the features all answer the
 * same question (what is at this pixel), and a pass each cost far too much per build. Kept as
 * data so it can be tested.
 */

/** Hash channel for the per-Region choice of alternate sheet. */
const CHANNEL_SHEET = 0x5eed;

/**
 * The sheet a look draws throughout one Region: one of its alternates, picked by the Region's
 * seed. ⚠️ Never per cell: two seamless sheets side by side show a square seam.
 */
export function sheetFor(look, seed) {
    const sheets = look.sheets;
    if (sheets.length <= 1) return sheets[0];
    return sheets[Math.floor(hash01(CHANNEL_SHEET, seed) * sheets.length) % sheets.length];
}

/**
 * A Region's ground plan.
 *
 * @param {object} ground The Region's ground, from `regionGround`.
 * @returns {{
 *   width: number, height: number, unit: number, seed: number,
 *   palette: string[], looks: string[], terrainAt: Uint8Array,
 *   wearAt: Uint8Array|null, wear: {mask: Uint8Array|null, worn: number[], thresholds: number[], cell: number},
 *   bands: Array<{terrainId: string, look: string, mask: Uint8Array, pixels: number[], appearance: object|null}>,
 *   sheets: string[], sheetAt: Uint8Array, tints: Array<{tint: string, amount: number}>, tintAt: Int8Array,
 *   props: object[]
 * }}
 *   Per pixel, row by row: `terrainAt` indexes `palette` (and `looks`, the look of each);
 *   `wearAt` 1 where the look's wear shows; each band's `mask` 1 inside it. The drawing answer:
 *   `sheetAt` indexes `sheets`, `tintAt` indexes `tints` (-1 for none). `props` back to front
 *   (`TerrainProps`). Pixels are `unit` mat units.
 */
export function buildGroundPlan(ground) {
    const pixels = resolveArtPixels(ground);
    const { width, height, palette, at } = pixels;
    const { bands } = buildBandMasks(pixels, ground);
    const wear = buildWearMask(pixels, ground);
    const looks = palette.map(t => (getLook(ground.looks[t]) ? ground.looks[t] : LOOKS.meadow.id));

    // Sheet `p` is palette entry `p`'s ground, so the drawing answer starts as a copy of the
    // terrain map; the wear sheets follow. A sheet may be listed twice, and a terrain of the
    // stored legend that no cell uses still lists its sheet.
    const sheets = looks.map(id => sheetFor(getLook(id), ground.seed));
    const wearSheet = looks.map(id => {
        const worn = getLook(id).wear?.sheet;
        if (!worn) return -1;
        if (!sheets.includes(worn)) sheets.push(worn);
        return sheets.indexOf(worn);
    });

    const n = width * height;
    const sheetAt = at.slice();

    // ⚠️ The order is the layering rule: a band tints its look's own edge; wear replaces the
    // ground, so it drops the tint with it (bare earth is not shallow water).
    const tints = [];
    const tintAt = new Int8Array(n).fill(-1);
    for (const band of bands) {
        if (!band.appearance) continue;
        const tint = tints.length;
        tints.push(band.appearance);
        for (const i of band.pixels) tintAt[i] = tint;
    }
    for (const i of wear.worn) {
        sheetAt[i] = wearSheet[at[i]];
        tintAt[i] = -1;
    }

    return {
        width, height, unit: PLAN_PIXEL_U, seed: ground.seed,
        palette, looks, terrainAt: at,
        wearAt: wear.mask, wear, bands,
        sheets, sheetAt, tints, tintAt,
        props: propsForGround(ground, pixels)
    };
}

/**
 * A sheet's RGBA pixels with the mute baked in, about `brightness(0.85) saturate(0.7)`: done once
 * per sheet when it is decoded, never as a CSS filter (a filter would make the ground its own
 * composited layer). The CSS filter formulas, so a value means what it would in a stylesheet.
 *
 * @param {Uint8ClampedArray} rgba
 * @returns {Uint8ClampedArray} a new array; the source is left as decoded
 */
export function muteTexels(rgba) {
    const b = tuning('muteBrightness');
    const s = tuning('muteSaturation');
    const out = new Uint8ClampedArray(rgba.length);
    const rr = 0.213 + 0.787 * s;
    const rg = 0.715 - 0.715 * s;
    const rb = 0.072 - 0.072 * s;
    const gr = 0.213 - 0.213 * s;
    const gg = 0.715 + 0.285 * s;
    const bb = 0.072 + 0.928 * s;
    for (let i = 0; i < rgba.length; i += 4) {
        const r = rgba[i] * b;
        const g = rgba[i + 1] * b;
        const bl = rgba[i + 2] * b;
        out[i] = Math.round(rr * r + rg * g + rb * bl);
        out[i + 1] = Math.round(gr * r + gg * g + rb * bl);
        out[i + 2] = Math.round(gr * r + rg * g + bb * bl);
        out[i + 3] = rgba[i + 3];
    }
    return out;
}

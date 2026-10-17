// the ground plan: what every plan pixel of a Region's ground should look like

import { resolveArtPixels, hash01, PLAN_PIXEL_U } from './TerrainLattice.js';
import { buildBandMasks } from './TerrainBands.js';
import { buildWearMask } from './TerrainPatches.js';
import { propsForGround } from './TerrainProps.js';
import { buildShadePattern, buildWearEdges, composeShades } from './TerrainShade.js';
import { buildGrassPlan, drawsGenerated, shadeRatio } from './TerrainGrass.js';
import { getLook, LOOKS } from '../../config/registries/terrainRegistry.js';
import { hallSpot, HALL_CLEARING } from '../atlas/Layout.js';
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
 *   shades: number[], shadeAt: Uint8Array, pattern: object, edges: {rim: number[], fringe: number[]},
 *   props: object[], grass: object|null
 * }}
 *   Per pixel, row by row: `terrainAt` indexes `palette` (and `looks`, the look of each);
 *   `wearAt` 1 where the look's wear shows; each band's `mask` 1 inside it. The drawing answer:
 *   `sheetAt` indexes `sheets`, `tintAt` indexes `tints` (-1 for none), `shadeAt` indexes
 *   `shades` (brightness factors, 0 being 1: as drawn); `shadeParts`, `patternStep` and `lips`
 *   say what each is made of, for a generated look's own share of the pattern. `pattern` and
 *   `edges` are the shade's parts (`TerrainShade`). `props` back to front (`TerrainProps`), each with the `shade` of the
 *   pattern under its foot. `grass` the shapes of the looks drawn by rules (`TerrainGrass`), null
 *   when none is: their sheet stays in `sheetAt` beneath, without wear. Pixels are `unit` mat units.
 */
export function buildGroundPlan(ground) {
    const pixels = resolveArtPixels(ground);
    const { width, height, palette, at } = pixels;
    const looks = palette.map(t => (getLook(ground.looks[t]) ? ground.looks[t] : LOOKS.meadow.id));
    // The generated sea measures furthest from the shore: first, so the bands reuse its walk.
    const hall = hallSpot(ground.mat);
    const grass = buildGrassPlan(pixels, ground.seed, looks, {
        clear: { x: hall.x / PLAN_PIXEL_U, y: hall.y / PLAN_PIXEL_U, r: HALL_CLEARING / PLAN_PIXEL_U }
    });
    const { bands } = buildBandMasks(pixels, ground);
    const generated = grass ? Uint8Array.from(grass.slotOf.slice(0, palette.length), s => (s >= 0 ? 1 : 0)) : null;
    const wear = buildWearMask(pixels, ground, generated);

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

    const pattern = buildShadePattern(width, height, ground.seed);
    const edges = buildWearEdges(pixels, wear, ground);
    const { shades, shadeAt, levels, parts, step, lips } = composeShades(n, pattern, edges);
    // No bush stands in a sulphur lake.
    const props = propsForGround(ground, pixels).filter(p => !grass?.ring?.[p.footY * width + p.footX]);
    for (const p of props) {
        if (!pattern.levelAt) p.shade = 1;
        else if (drawsGenerated(p.look)) p.shade = 1 + pattern.levelAt[p.footY * width + p.footX] * step * shadeRatio(p.look);
        else p.shade = levels[pattern.levelAt[p.footY * width + p.footX] + 1];
    }

    return {
        width, height, unit: PLAN_PIXEL_U, seed: ground.seed,
        palette, looks, terrainAt: at,
        wearAt: wear.mask, wear, bands,
        sheets, sheetAt, tints, tintAt,
        shades, shadeAt, shadeParts: parts, patternStep: step, lips, pattern, edges,
        props, grass
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

// shade: the ground lighter and darker in large areas, and the lip round a worn patch

import { PLAN_PIXEL_U } from './TerrainLattice.js';
import { layeredNoise, layeredTables, spreadSamples, CALIBRATION_SAMPLES, FINE } from './TerrainPatches.js';
import { wearOf } from '../../config/registries/terrainRegistry.js';
import { tuning } from '../../config/playmatTuning.js';

/**
 * Structure at the large and the middle size without new art: every look's own sheet drawn a few
 * percent lighter or darker in areas several Tokens wide, and a worn patch given a darker rim on
 * its earth and a lighter fringe on the grass round it.
 *
 * ⚠️ Stepped, never a gradient: a pixel is in one of three shades, and the shades meet in hard
 * edges, as a pixel artist would draw them. The pattern's shape comes from layered value noise
 * (`TerrainPatches.layeredNoise`, so the areas are not round blobs on the noise grid), cut at two
 * calibrated levels.
 *
 * The answer is per plan pixel, a brightness factor the screen pass bakes into a shaded copy of each
 * sheet, so drawing a shaded pixel costs the same single copy as drawing a plain one.
 */

/** Hash channels for the pattern's two layers, kept clear of the wear's and the scatter's. */
const CHANNEL_SHADE = 0x5ad1;
const CHANNEL_SHADE_FINE = 0x5ad2;

/** The share of the ground drawn darker, and the share drawn lighter; the rest is as drawn. */
export const PATTERN_SHARES = Object.freeze({ dark: 0.3, light: 0.3 });

/** The pattern's noise cell in plan pixels, from the slider's mat units. */
const patternCell = () => Math.max(4, Math.round(tuning('patternScale') / PLAN_PIXEL_U));

/** The pattern's noise at a pixel: the reference the fast path in {@link buildShadePattern} must match. */
export function shadeNoise(px, py, seed, cell) {
    return layeredNoise(px, py, seed, cell, CHANNEL_SHADE, CHANNEL_SHADE_FINE);
}

/**
 * Which shade every plan pixel is in.
 *
 * @returns {{levelAt: Int8Array|null, cell: number, thresholds: number[]|null}} `levelAt` is -1
 *   (darker), 0 (as drawn) or 1 (lighter) per pixel, row by row; null when the pattern is off.
 *   `thresholds` the two noise levels the shades are cut at.
 */
export function buildShadePattern(width, height, seed) {
    const cell = patternCell();
    if (!(tuning('patternOn') > 0) || !(tuning('patternStrength') > 0)) return { levelAt: null, cell, thresholds: null };

    const noise = layeredTables(width, height, seed, cell, CHANNEL_SHADE, CHANNEL_SHADE_FINE);
    // ⚠️ Calibrated like the wear: blended noise piles up round the middle, so the cut levels are
    // quantiles of the sampled noise, not fixed numbers.
    const sample = spreadSamples(width, height, CALIBRATION_SAMPLES, noise.at);
    const last = sample.length - 1;
    const low = sample[Math.floor(PATTERN_SHARES.dark * last)];
    const high = sample[Math.floor((1 - PATTERN_SHARES.light) * last)];

    const levelAt = new Int8Array(width * height);
    for (let py = 0, row = 0; py < height; py++, row += width) {
        const { coarse, fine } = noise.row(py);
        const ct = coarse.top, cb = coarse.bottom, cfy = coarse.fy;
        const ft = fine.top, fb = fine.bottom, ffy = fine.fy;
        for (let px = 0; px < width; px++) {
            const a = ct[px];
            const b = ft[px];
            const v = (a + (cb[px] - a) * cfy) + FINE * (b + (fb[px] - b) * ffy);
            levelAt[row + px] = v < low ? -1 : v > high ? 1 : 0;
        }
    }
    return { levelAt, cell, thresholds: [low, high] };
}

/** The four side neighbours of pixel `i` inside the plan, passed to `fn`. */
function sides(i, width, n, fn) {
    const x = i % width;
    if (x > 0) fn(i - 1);
    if (x < width - 1) fn(i + 1);
    if (i >= width) fn(i - width);
    if (i + width < n) fn(i + width);
}

/**
 * The lip round every worn patch of a look that asks for one (`wear.rim`): the worn pixels within
 * the edge width of unworn ground (the rim, drawn darker), and the unworn pixels of that look within
 * the width of worn ground (the fringe, drawn lighter). Side steps only, so a one-pixel lip is one
 * clean pixel line, never a thicker diagonal.
 *
 * @param {object} pixels A resolved map from `resolveArtPixels`.
 * @param {{mask: Uint8Array|null, worn: number[]}} wear From `buildWearMask`.
 * @param {object} ground The Region's ground, for the look of each terrain.
 * @returns {{rim: number[], fringe: number[]}} pixel indices, row by row
 */
export function buildWearEdges(pixels, wear, ground) {
    const { width, height, palette, at } = pixels;
    const steps = Math.round(tuning('wearEdgeWidth') / PLAN_PIXEL_U);
    const wantRim = tuning('wearRim') > 0;
    const wantFringe = tuning('wearFringe') > 0;
    if (!wear.mask || !(steps > 0) || (!wantRim && !wantFringe)) return { rim: [], fringe: [] };

    const lipped = new Uint8Array(256);
    let any = false;
    palette.forEach((t, p) => {
        if (wearOf(ground.looks[t])?.rim) { lipped[p] = 1; any = true; }
    });
    if (!any) return { rim: [], fringe: [] };

    const { mask } = wear;
    const n = width * height;
    // 1 rim, 2 fringe: a pixel is one or the other, whichever ring reached it first.
    const mark = new Uint8Array(n);
    let rimRing = [];
    let fringeRing = [];
    // The first ring walks every worn pixel, so its side steps are written out rather than
    // passed to `sides` as a callback.
    const near = new Int32Array(4);
    for (const i of wear.worn) {
        if (!lipped[at[i]]) continue;
        const x = i % width;
        let count = 0;
        if (x > 0) near[count++] = i - 1;
        if (x < width - 1) near[count++] = i + 1;
        if (i >= width) near[count++] = i - width;
        if (i + width < n) near[count++] = i + width;
        let open = false;
        for (let k = 0; k < count; k++) {
            const j = near[k];
            if (mask[j]) continue;
            open = true;
            if (lipped[at[j]] && !mark[j]) {
                mark[j] = 2;
                fringeRing.push(j);
            }
        }
        if (open) {
            mark[i] = 1;
            rimRing.push(i);
        }
    }
    const rim = [...rimRing];
    const fringe = [...fringeRing];
    for (let step = 1; step < steps; step++) {
        const nextRim = [];
        for (const i of rimRing) {
            sides(i, width, n, (j) => {
                if (mask[j] && !mark[j] && lipped[at[j]]) { mark[j] = 1; nextRim.push(j); }
            });
        }
        const nextFringe = [];
        for (const i of fringeRing) {
            sides(i, width, n, (j) => {
                if (!mask[j] && !mark[j] && lipped[at[j]]) { mark[j] = 2; nextFringe.push(j); }
            });
        }
        rim.push(...nextRim);
        fringe.push(...nextFringe);
        rimRing = nextRim;
        fringeRing = nextFringe;
    }
    return { rim: wantRim ? rim : [], fringe: wantFringe ? fringe : [] };
}

/**
 * The pattern and the lips as one brightness factor per pixel.
 *
 * @param {number} n Pixels in the plan.
 * @param {{levelAt: Int8Array|null}} pattern From {@link buildShadePattern}.
 * @param {{rim: number[], fringe: number[]}} edges From {@link buildWearEdges}.
 * @returns {{shades: number[], shadeAt: Uint8Array, levels: number[]}} `shadeAt` indexes `shades`,
 *   whose first entry is 1 (as drawn); `levels` the pattern's factor for darker, as drawn and
 *   lighter, for whatever stands on the ground (the scatter) to take the same light.
 */
export function composeShades(n, pattern, edges) {
    const strength = tuning('patternStrength');
    const levels = pattern.levelAt ? [1 - strength, 1, 1 + strength] : [1, 1, 1];
    const lip = [1, 1 - tuning('wearRim'), 1 + tuning('wearFringe')];

    // Only the factors some pixel takes are listed: each is a shaded copy of a sheet to make.
    const shades = [1];
    const indexOf = new Map([[1, 0]]);
    const table = new Int16Array(9).fill(-1);
    const shadeFor = (l, e) => {
        const k = l * 3 + e;
        if (table[k] < 0) {
            const f = levels[l] * lip[e];
            if (!indexOf.has(f)) {
                indexOf.set(f, shades.length);
                shades.push(f);
            }
            table[k] = indexOf.get(f);
        }
        return table[k];
    };

    const shadeAt = new Uint8Array(n);
    const { levelAt } = pattern;
    if (levelAt) {
        const plain = [shadeFor(0, 0), shadeFor(1, 0), shadeFor(2, 0)];
        for (let i = 0; i < n; i++) shadeAt[i] = plain[levelAt[i] + 1];
    }
    const level = (i) => (levelAt ? levelAt[i] + 1 : 1);
    for (const i of edges.rim) shadeAt[i] = shadeFor(level(i), 1);
    for (const i of edges.fringe) shadeAt[i] = shadeFor(level(i), 2);
    return { shades, shadeAt, levels };
}

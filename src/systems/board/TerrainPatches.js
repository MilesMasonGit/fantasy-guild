// wear: a second sheet showing through a look in clumps

import { hash01, PLAN_PIXEL_U } from './TerrainLattice.js';
import { wearOf } from '../../config/registries/terrainRegistry.js';
import { tuning } from '../../config/playmatTuning.js';

/**
 * Clumps of earth worn through grass, gravel through rock: a second sheet inside one look, with
 * no edge involved.
 *
 * Clumps, not speckle: the shape comes from smooth value noise on a coarse grid, interpolated,
 * because independent per-pixel noise gives dithering. The noise is sampled from absolute pixel
 * coordinates, so a clump runs across cell lines without lining anything up; what stops it is the
 * ground under it changing to a look that does not wear.
 *
 * ⚠️ Two layers of noise, a coarse one and a finer one at half its weight. One layer alone wears
 * through only round its lowest grid corners, so at a low coverage the clumps sit on the noise
 * grid in rows, as dots and crosses; the finer layer moves them off it and gives them ragged,
 * organic outlines.
 *
 * ⚠️ Gated per pixel on the drawn ground (`resolveArtPixels`), after the beach is cut: gated per
 * cell, earth speckled across the beach the sea had cut into a forest's edge.
 */

/** Hash channels for the wear's two layers, kept clear of the ones the edges and the scatter use. */
const CHANNEL_PATCH = 0x7a1c;
const CHANNEL_PATCH_FINE = 0x7a1d;

/** The finer layer's weight against the coarse one, in every layered noise here. */
export const FINE = 0.5;

/** The finer layer's cell for a coarse cell: half as big. */
export const fineCellOf = (cell) => Math.max(2, Math.round(cell / 2));

/** How many samples a noise's distribution is estimated from. */
export const CALIBRATION_SAMPLES = 4096;

/** The R2 sequence's steps (the plastic number's inverse powers): evenly spread 2D samples. */
const R2_X = 0.7548776662466927;
const R2_Y = 0.5698402909980532;

/** Smoothstep, so noise cells blend into each other instead of meeting in creases. */
const smooth = (t) => t * t * (3 - 2 * t);

/** The clump size in plan pixels, from the slider's mat units. */
const clumpPx = () => Math.max(2, Math.round(tuning('wearClump') / PLAN_PIXEL_U));

/**
 * Smooth value noise in [0, 1) at a pixel: the corners of the coarse cell it falls in, hashed on
 * `channel` and interpolated.
 */
export function valueNoise(px, py, seed, cell, channel) {
    const gx = Math.floor(px / cell);
    const gy = Math.floor(py / cell);
    const fx = smooth((px - gx * cell) / cell);
    const fy = smooth((py - gy * cell) / cell);

    const c00 = hash01(gx, gy, channel, seed);
    const c10 = hash01(gx + 1, gy, channel, seed);
    const c01 = hash01(gx, gy + 1, channel, seed);
    const c11 = hash01(gx + 1, gy + 1, channel, seed);

    const top = c00 + (c10 - c00) * fx;
    const bottom = c01 + (c11 - c01) * fx;
    return top + (bottom - top) * fy;
}

/**
 * Two layers of {@link valueNoise}, in [0, 1.5): a coarse one on `cell` and a finer one at half
 * the cell and {@link FINE} its weight. The reference every fast path over {@link layeredTables}
 * must match exactly.
 */
export function layeredNoise(px, py, seed, cell, channel, fineChannel) {
    return valueNoise(px, py, seed, cell, channel) + FINE * valueNoise(px, py, seed, fineCellOf(cell), fineChannel);
}

/** The wear's noise at a pixel: the reference the fast path in {@link buildWearMask} must match. */
export function patchNoise(px, py, seed, cell = 10) {
    return layeredNoise(px, py, seed, cell, CHANNEL_PATCH, CHANNEL_PATCH_FINE);
}

/**
 * {@link valueNoise} over a whole plan, with every corner hashed once rather than four times a
 * pixel and the smoothstep weights worked out once per column and per row. Same arithmetic in the
 * same order, so the same numbers. `blendRow(gy, out)` writes the noise along corner row `gy`
 * (the top of every pixel row in noise row `gy`) for a caller that walks the plan row by row.
 */
export function noiseTables(width, height, seed, cell, channel) {
    const gw = Math.floor((width - 1) / cell) + 2;
    const gh = Math.floor((height - 1) / cell) + 2;
    const corners = new Float64Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) corners[gy * gw + gx] = hash01(gx, gy, channel, seed);
    }
    const gxOf = new Int32Array(width);
    const fxOf = new Float64Array(width);
    for (let px = 0; px < width; px++) {
        const gx = Math.floor(px / cell);
        gxOf[px] = gx;
        fxOf[px] = smooth((px - gx * cell) / cell);
    }
    const gyOf = new Int32Array(height);
    const fyOf = new Float64Array(height);
    for (let py = 0; py < height; py++) {
        const gy = Math.floor(py / cell);
        gyOf[py] = gy;
        fyOf[py] = smooth((py - gy * cell) / cell);
    }
    const at = (px, py) => {
        const row = gyOf[py] * gw + gxOf[px];
        const fx = fxOf[px];
        const c00 = corners[row];
        const c10 = corners[row + 1];
        const c01 = corners[row + gw];
        const c11 = corners[row + gw + 1];
        const top = c00 + (c10 - c00) * fx;
        const bottom = c01 + (c11 - c01) * fx;
        return top + (bottom - top) * fyOf[py];
    };
    const blendRow = (gy, out) => {
        const base = gy * gw;
        for (let px = 0; px < width; px++) {
            const k = base + gxOf[px];
            const c0 = corners[k];
            out[px] = c0 + (corners[k + 1] - c0) * fxOf[px];
        }
    };
    return { gw, corners, gxOf, fxOf, gyOf, fyOf, at, blendRow };
}

/** One layer walked row by row: the two corner rows a pixel row blends between, and its weight. */
function rowWalker(tables, width) {
    const out = { top: new Float64Array(width), bottom: new Float64Array(width), fy: 0 };
    let rowsOf = -1;
    return (py) => {
        const gy = tables.gyOf[py];
        if (gy !== rowsOf) {
            if (rowsOf >= 0 && gy === rowsOf + 1) {
                [out.top, out.bottom] = [out.bottom, out.top];
                tables.blendRow(gy + 1, out.bottom);
            } else {
                tables.blendRow(gy, out.top);
                tables.blendRow(gy + 1, out.bottom);
            }
            rowsOf = gy;
        }
        out.fy = tables.fyOf[py];
        return out;
    };
}

/**
 * {@link layeredNoise} over a whole plan: `at(x, y)` anywhere, and `row(py)` for a caller walking
 * the plan top to bottom, which returns each layer's two corner rows and weight (`coarse`, `fine`:
 * `{top, bottom, fy}`), so a pixel costs two blends. The noise at a pixel `px` of that row is
 * `(t + (b - t) * fy)` of the coarse layer plus {@link FINE} times the same of the fine one, in
 * that order.
 */
export function layeredTables(width, height, seed, cell, channel, fineChannel) {
    const coarse = noiseTables(width, height, seed, cell, channel);
    const fine = noiseTables(width, height, seed, fineCellOf(cell), fineChannel);
    const coarseRow = rowWalker(coarse, width);
    const fineRow = rowWalker(fine, width);
    return {
        at: (px, py) => coarse.at(px, py) + FINE * fine.at(px, py),
        row: (py) => ({ coarse: coarseRow(py), fine: fineRow(py) })
    };
}

/**
 * `count` points spread evenly over a `width × height` plan (the R2 low-discrepancy sequence),
 * each passed to `fn(x, y)`; the answers come back sorted, as quantiles. ⚠️ Never a stride: a
 * stride that shares a factor with the width lands every sample on the same columns of a noise
 * grid, where the noise is distributed differently, and a calibration comes out wrong.
 */
export function spreadSamples(width, height, count, fn) {
    const out = new Float64Array(count);
    for (let k = 0; k < count; k++) {
        const u = (0.5 + R2_X * k) % 1;
        const v = (0.5 + R2_Y * k) % 1;
        out[k] = fn(Math.floor(u * width), Math.floor(v * height));
    }
    out.sort();
    return out;
}

/**
 * How much more (or less) a pixel wears than the average, from the "Wear in the middle" slider:
 * 1 everywhere at 0; at 1, twice the average in the middle of the mat, none in its corners. Its
 * mean over the plan stays about 1, so a coverage still means that share of the ground.
 * `along[x]` and `down[y]` add up to the pixel's squared distance from the middle, as a share.
 */
function middleWeights(width, height) {
    const s = tuning('wearMiddle');
    if (!(s > 0)) return null;
    const along = new Float64Array(width);
    const down = new Float64Array(height);
    for (let x = 0; x < width; x++) {
        const d = (x + 0.5 - width / 2) / (width / 2);
        along[x] = (d * d) / 2;
    }
    for (let y = 0; y < height; y++) {
        const d = (y + 0.5 - height / 2) / (height / 2);
        down[y] = (d * d) / 2;
    }
    // The squared distance averages a third over a rectangle, so `1 + 3s(1/3 - r²)` averages 1.
    return { s, along, down };
}

/**
 * ⚠️ Coverage has to be calibrated, not used as a threshold directly: interpolating uniform random
 * corners piles values up round the middle, so `noise < 0.18` is nowhere near 18 % of pixels.
 * Coverage picks a quantile of the sampled noise instead.
 */
function thresholdFrom(quantiles, coverage) {
    if (!(coverage > 0)) return -Infinity;
    if (coverage >= 1) return Infinity;
    return quantiles[Math.floor(coverage * (quantiles.length - 1))];
}

/**
 * Where each look's wear shows through.
 *
 * @param {object} pixels A resolved map from `resolveArtPixels`.
 * @param {object} ground The Region's ground, for its seed and the look of each terrain.
 * @param {Uint8Array} [skip] 1 per palette entry whose wear is not a sheet: generated ground
 *   draws its own earth.
 * @returns {{mask: Uint8Array|null, worn: number[], thresholds: number[], cell: number}} `mask`
 *   is 1 where the pixel's look wears through (null when no look here wears), `worn` the same
 *   pixels as a list; `thresholds` the noise level below which each palette entry wears (before
 *   the "Wear in the middle" slider moves it per pixel); `cell` the coarse noise cell in pixels.
 */
export function buildWearMask(pixels, ground, skip = null) {
    const { width, height, palette, at, present } = pixels;
    const cell = clumpPx();
    const scale = tuning('patchCoverage');
    const n = width * height;
    const wants = palette.map((t, p) => (present[p] && !skip?.[p] && wearOf(ground.looks[t])?.coverage * scale) || 0);
    if (!wants.some(c => c > 0)) return { mask: null, worn: [], thresholds: wants.map(() => -Infinity), cell };

    const noise = layeredTables(width, height, ground.seed, cell, CHANNEL_PATCH, CHANNEL_PATCH_FINE);
    const sample = spreadSamples(width, height, CALIBRATION_SAMPLES, noise.at);
    const thresholds = wants.map(c => thresholdFrom(sample, c));
    const middle = middleWeights(width, height);
    const last = sample.length - 1;

    const mask = new Uint8Array(n);
    const worn = [];
    for (let py = 0, row = 0; py < height; py++, row += width) {
        const { coarse, fine } = noise.row(py);
        const ct = coarse.top, cb = coarse.bottom, cfy = coarse.fy;
        const ft = fine.top, fb = fine.bottom, ffy = fine.fy;
        const rowWeight = middle ? 1 + middle.s - 3 * middle.s * middle.down[py] : 1;
        for (let px = 0, i = row; px < width; px++, i++) {
            let threshold = thresholds[at[i]];
            if (threshold === -Infinity) continue;
            if (middle) {
                const want = wants[at[i]] * (rowWeight - 3 * middle.s * middle.along[px]);
                if (!(want > 0)) continue;
                threshold = want >= 1 ? Infinity : sample[Math.floor(want * last)];
            }
            const a = ct[px];
            const b = ft[px];
            if ((a + (cb[px] - a) * cfy) + FINE * (b + (fb[px] - b) * ffy) < threshold) {
                mask[i] = 1;
                worn.push(i);
            }
        }
    }
    return { mask, worn: dropSpecks(mask, worn, width, minClumpPx(cell)), thresholds, cell };
}

/**
 * The fewest plan pixels a worn clump may have, for a noise cell of `cell` pixels: anything smaller
 * than a square a quarter of the cell across reads as a speck of dirt beside the clumps the noise
 * makes at that size.
 */
export const minClumpPx = (cell) => Math.max(4, Math.round((cell * cell) / 16));

/**
 * Clears every worn clump (side-connected) smaller than `least` pixels from `mask`, and
 * returns the worn pixels left, in their order. The noise dips just below the threshold in a few
 * places, and a pixel or two of earth with a lip round it is speckle, not wear.
 */
function dropSpecks(mask, worn, width, least) {
    const n = mask.length;
    // Every clump is gathered breadth first into `order`, one after another, so a clump is the
    // run `order[from, end)`. 2 marks a pixel already gathered.
    const order = new Int32Array(worn.length);
    let end = 0;
    let dropped = 0;
    for (const start of worn) {
        if (mask[start] !== 1) continue;
        const from = end;
        order[end++] = start;
        mask[start] = 2;
        for (let k = from; k < end; k++) {
            const i = order[k];
            const x = i % width;
            if (x > 0 && mask[i - 1] === 1) { mask[i - 1] = 2; order[end++] = i - 1; }
            if (x < width - 1 && mask[i + 1] === 1) { mask[i + 1] = 2; order[end++] = i + 1; }
            if (i >= width && mask[i - width] === 1) { mask[i - width] = 2; order[end++] = i - width; }
            if (i + width < n && mask[i + width] === 1) { mask[i + width] = 2; order[end++] = i + width; }
        }
        if (end - from < least) {
            for (let k = from; k < end; k++) mask[order[k]] = 0;
            dropped += end - from;
        }
    }
    const kept = dropped ? [] : worn;
    for (const i of worn) {
        if (mask[i] === 2) {
            mask[i] = 1;
            if (dropped) kept.push(i);
        }
    }
    return kept;
}

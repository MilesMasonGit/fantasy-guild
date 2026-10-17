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
 * ⚠️ Gated per pixel on the drawn ground (`resolveArtPixels`), after the beach is cut: gated per
 * cell, earth speckled across the beach the sea had cut into a forest's edge.
 */

/** Hash channel, kept clear of the ones the edges and the scatter use. */
const CHANNEL_PATCH = 0x7a1c;

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
 * `channel` and interpolated. The reference every fast path over {@link noiseTables} must match
 * exactly.
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

/** The wear's noise at a pixel: the reference the fast path in {@link buildWearMask} must match. */
export function patchNoise(px, py, seed, cell = 10) {
    return valueNoise(px, py, seed, cell, CHANNEL_PATCH);
}

/**
 * {@link valueNoise} over a whole plan, with every corner hashed once rather than four times a
 * pixel and the smoothstep weights worked out once per column and per row. Same arithmetic in the
 * same order, so the same numbers. `blendRow(gy, out)` writes the noise along corner row `gy`
 * (the top of every pixel row in noise row `gy`) for a caller that walks the plan row by row.
 */
export function noiseTables(width, height, seed, cell, channel = CHANNEL_PATCH) {
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

/**
 * `count` points spread evenly over a `width × height` plan (the R2 low-discrepancy sequence),
 * each passed to `fn(x, y)`. ⚠️ Never a stride: a stride that shares a factor with the width lands
 * every sample on the same columns of a noise grid, where the noise is distributed differently,
 * and a calibration comes out wrong.
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
 * mean over the plan stays 1, so a coverage still means that share of the ground.
 * `along(x)` and `down(y)` add up to the pixel's squared distance from the middle, as a share.
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
    return { s, along, down, most: 1 + s };
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
 * @returns {{mask: Uint8Array|null, worn: number[], thresholds: number[], cell: number}} `mask`
 *   is 1 where the pixel's look wears through (null when no look here wears), `worn` the same
 *   pixels as a list; `thresholds` the noise level below which each palette entry wears (before
 *   the "Wear in the middle" slider moves it per pixel); `cell` the noise cell in pixels.
 */
export function buildWearMask(pixels, ground) {
    const { width, height, palette, at, present } = pixels;
    const cell = clumpPx();
    const scale = tuning('patchCoverage');
    const n = width * height;
    const wants = palette.map((t, p) => (present[p] && wearOf(ground.looks[t])?.coverage * scale) || 0);
    if (!wants.some(c => c > 0)) return { mask: null, worn: [], thresholds: wants.map(() => -Infinity), cell };

    const noise = noiseTables(width, height, ground.seed, cell);
    const sample = spreadSamples(width, height, CALIBRATION_SAMPLES, noise.at);
    const thresholds = wants.map(c => thresholdFrom(sample, c));
    const mask = new Uint8Array(n);
    const worn = [];

    // A noise value is a blend of its cell's four corners, never below the least of them, so a
    // noise cell whose corners all sit above every threshold wears nowhere and is skipped whole:
    // most of the ground, at the coverages the looks ask for. The margin keeps rounding out of it.
    const middle = middleWeights(width, height);
    if (middle) {
        const highest = thresholdFrom(sample, Math.max(...wants) * middle.most);
        wearInTheMiddle({ width, height, cell, at, wants, sample, middle, noise, highest, mask, worn });
        return { mask, worn, thresholds, cell };
    }
    const highest = Math.max(...thresholds);

    // The noise along a corner row, once per row of noise cells rather than once per pixel row:
    // `top` and `bottom` are exactly patchNoise's two horizontal blends.
    const { gw, corners, gyOf, fyOf, blendRow } = noise;
    let top = new Float64Array(width);
    let bottom = new Float64Array(width);
    let rowsOf = -1;
    const blocks = gw - 1;
    const clear = new Uint8Array(blocks);

    for (let py = 0, row = 0; py < height; py++, row += width) {
        const gy = gyOf[py];
        if (gy !== rowsOf) {
            if (rowsOf >= 0 && gy === rowsOf + 1) {
                [top, bottom] = [bottom, top];
                blendRow(gy + 1, bottom);
            } else {
                blendRow(gy, top);
                blendRow(gy + 1, bottom);
            }
            rowsOf = gy;
            for (let gx = 0; gx < blocks; gx++) {
                const k = gy * gw + gx;
                const least = Math.min(corners[k], corners[k + 1], corners[k + gw], corners[k + gw + 1]);
                clear[gx] = least > highest + 1e-9 ? 1 : 0;
            }
        }
        const fy = fyOf[py];
        for (let gx = 0; gx < blocks; gx++) {
            if (clear[gx]) continue;
            const x1 = Math.min(width, (gx + 1) * cell);
            for (let px = gx * cell, i = row + px; px < x1; px++, i++) {
                const threshold = thresholds[at[i]];
                if (threshold === -Infinity) continue;
                const t = top[px];
                if (t + (bottom[px] - t) * fy < threshold) {
                    mask[i] = 1;
                    worn.push(i);
                }
            }
        }
    }
    return { mask, worn, thresholds, cell };
}

/**
 * The wear with the "Wear in the middle" slider up: the same noise, each pixel's coverage scaled
 * by how near the middle of the mat it is. Kept apart so the even wear's loop stays as lean as it
 * was. Fills `mask` and `worn`.
 */
function wearInTheMiddle({ width, height, cell, at, wants, sample, middle, noise, highest, mask, worn }) {
    const { gw, corners, gyOf, fyOf, blendRow } = noise;
    const { s, along, down } = middle;
    const last = sample.length - 1;
    let top = new Float64Array(width);
    let bottom = new Float64Array(width);
    let rowsOf = -1;
    const blocks = gw - 1;
    const clear = new Uint8Array(blocks);
    for (let py = 0, row = 0; py < height; py++, row += width) {
        const gy = gyOf[py];
        if (gy !== rowsOf) {
            if (rowsOf >= 0 && gy === rowsOf + 1) {
                [top, bottom] = [bottom, top];
                blendRow(gy + 1, bottom);
            } else {
                blendRow(gy, top);
                blendRow(gy + 1, bottom);
            }
            rowsOf = gy;
            for (let gx = 0; gx < blocks; gx++) {
                const k = gy * gw + gx;
                const least = Math.min(corners[k], corners[k + 1], corners[k + gw], corners[k + gw + 1]);
                clear[gx] = least > highest + 1e-9 ? 1 : 0;
            }
        }
        const fy = fyOf[py];
        const rowWeight = 1 + s - 3 * s * down[py];
        for (let gx = 0; gx < blocks; gx++) {
            if (clear[gx]) continue;
            const x1 = Math.min(width, (gx + 1) * cell);
            for (let px = gx * cell, i = row + px; px < x1; px++, i++) {
                const want = wants[at[i]] * (rowWeight - 3 * s * along[px]);
                if (!(want > 0)) continue;
                const threshold = want >= 1 ? Infinity : sample[Math.floor(want * last)];
                const t = top[px];
                if (t + (bottom[px] - t) * fy < threshold) {
                    mask[i] = 1;
                    worn.push(i);
                }
            }
        }
    }
}

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

/** How many samples the noise's distribution is estimated from. */
const CALIBRATION_SAMPLES = 4096;

/** The R2 sequence's steps (the plastic number's inverse powers): evenly spread 2D samples. */
const R2_X = 0.7548776662466927;
const R2_Y = 0.5698402909980532;

/** Smoothstep, so noise cells blend into each other instead of meeting in creases. */
const smooth = (t) => t * t * (3 - 2 * t);

/** The clump size in plan pixels, from the slider's mat units. */
const clumpPx = () => Math.max(2, Math.round(tuning('wearClump') / PLAN_PIXEL_U));

/**
 * Smooth noise in [0, 1) at a pixel: the corners of the coarse cell it falls in, hashed and
 * interpolated. The reference the fast path in {@link buildWearMask} must match exactly.
 */
export function patchNoise(px, py, seed, cell = 10) {
    const gx = Math.floor(px / cell);
    const gy = Math.floor(py / cell);
    const fx = smooth((px - gx * cell) / cell);
    const fy = smooth((py - gy * cell) / cell);

    const c00 = hash01(gx, gy, CHANNEL_PATCH, seed);
    const c10 = hash01(gx + 1, gy, CHANNEL_PATCH, seed);
    const c01 = hash01(gx, gy + 1, CHANNEL_PATCH, seed);
    const c11 = hash01(gx + 1, gy + 1, CHANNEL_PATCH, seed);

    const top = c00 + (c10 - c00) * fx;
    const bottom = c01 + (c11 - c01) * fx;
    return top + (bottom - top) * fy;
}

/**
 * The same noise over a whole plan, with every corner hashed once rather than four times a pixel
 * and the smoothstep weights worked out once per column and per row. Same arithmetic in the same
 * order as {@link patchNoise}, so the same numbers.
 */
function noiseTables(width, height, seed, cell) {
    const gw = Math.floor((width - 1) / cell) + 2;
    const gh = Math.floor((height - 1) / cell) + 2;
    const corners = new Float64Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) corners[gy * gw + gx] = hash01(gx, gy, CHANNEL_PATCH, seed);
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
    return { gw, corners, gxOf, fxOf, gyOf, fyOf, at };
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
 *   pixels as a list; `thresholds` the noise level below which each palette entry wears; `cell`
 *   the noise cell in pixels.
 */
export function buildWearMask(pixels, ground) {
    const { width, height, palette, at, present } = pixels;
    const cell = clumpPx();
    const scale = tuning('patchCoverage');
    const n = width * height;
    const wants = palette.map((t, p) => (present[p] && wearOf(ground.looks[t])?.coverage * scale) || 0);
    if (!wants.some(c => c > 0)) return { mask: null, worn: [], thresholds: wants.map(() => -Infinity), cell };

    // ⚠️ Sampled at scattered points (an R2 low-discrepancy sequence), never on a stride: a stride
    // that shares a factor with the width lands every sample on the same columns of the noise
    // grid, where the noise is distributed differently, and the calibration comes out wrong.
    const noise = noiseTables(width, height, ground.seed, cell);
    const sample = new Float64Array(CALIBRATION_SAMPLES);
    for (let k = 0; k < CALIBRATION_SAMPLES; k++) {
        const u = (0.5 + R2_X * k) % 1;
        const v = (0.5 + R2_Y * k) % 1;
        sample[k] = noise.at(Math.floor(u * width), Math.floor(v * height));
    }
    sample.sort();
    const thresholds = wants.map(c => thresholdFrom(sample, c));

    // The noise along a corner row, once per row of noise cells rather than once per pixel row:
    // `top` and `bottom` are exactly patchNoise's two horizontal blends.
    const { gw, corners, gxOf, fxOf, gyOf, fyOf } = noise;
    const blendRow = (gy, out) => {
        const base = gy * gw;
        for (let px = 0; px < width; px++) {
            const k = base + gxOf[px];
            const c0 = corners[k];
            out[px] = c0 + (corners[k + 1] - c0) * fxOf[px];
        }
    };
    let top = new Float64Array(width);
    let bottom = new Float64Array(width);
    let rowsOf = -1;

    // A noise value is a blend of its cell's four corners, never below the least of them, so a
    // noise cell whose corners all sit above every threshold wears nowhere and is skipped whole:
    // most of the ground, at the coverages the looks ask for. The margin keeps rounding out of it.
    const highest = Math.max(...thresholds);
    const blocks = gw - 1;
    const clear = new Uint8Array(blocks);

    const mask = new Uint8Array(n);
    const worn = [];
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

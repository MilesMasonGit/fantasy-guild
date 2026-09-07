// Fantasy Guild — Patches of one substrate showing through another.

import { LATTICE_SIZE, hash01, subtileArtPx } from './TerrainLattice.js';
import { patchOf } from '../../config/registries/terrainRegistry.js';
import { tuning } from '../../config/playmatTuning.js';

/**
 * Clumps of bare earth worn through the grass — the concept doc's §5, finally.
 *
 * Everything before this was a boundary *between* two terrains. This is a
 * second substrate showing through a first **inside** one terrain: patches of
 * dirt scuffed into a meadow, with no edge involved.
 *
 * ## Clumps, not speckle
 *
 * The shape comes from smooth value noise rather than a per-pixel coin flip.
 * Independent noise per pixel would give dithering — the same mistake that made
 * the first coastline look like static. Noise sampled on a coarse grid and
 * interpolated between gives blobs a few pixels across, which is what a worn
 * patch actually looks like.
 *
 * ## It ignores every boundary on the board
 *
 * The noise is sampled from **absolute art-pixel coordinates**, so a clump runs
 * across subtile and tile boundaries without noticing them. That is the concept
 * doc's own third answer to seam continuity (§6, "Continuous Global Coordinate
 * Sampling"), and here it comes for free: there is nothing to line up, because
 * nothing is ever cut.
 *
 * What *does* stop a patch is the terrain underneath changing to something that
 * has no patches declared — dirt worn into grass simply stops at the sand.
 */

/**
 * How many art pixels across one cell of the noise grid.
 *
 * This is the size of a clump. Small values approach per-pixel noise and look
 * like dithering; large ones give a few enormous continents of dirt and read as
 * a second terrain rather than as wear.
 */
const NOISE_CELL = 5;

/** Hash channel, kept clear of the ones the lattice and the props use. */
const CHANNEL_PATCH = 0x7a1c;

/** Smoothstep, so cells blend into each other instead of meeting in creases. */
const smooth = (t) => t * t * (3 - 2 * t);

/** How many samples to estimate the noise distribution from. */
const CALIBRATION_SAMPLES = 4096;

/**
 * ⚠️ **Coverage has to be calibrated, not used as a threshold directly.**
 *
 * Interpolating between four uniform random corners does not give a uniform
 * result — it piles up around the middle, the way the average of four dice
 * does. So `noise < 0.18` is nowhere near 18% of pixels: measured on the real
 * board it came out at **1.6%**, an order of magnitude short of what the
 * terrain asked for, and the first version of this shipped that.
 *
 * Rather than fight the distribution, this measures it: sample the noise,
 * sort it, and let coverage pick a **quantile**. Then "0.18" means what it says
 * — 18% of the ground is worn through — for every terrain, whatever the noise
 * happens to look like at that scale.
 *
 * Sampled at fixed positions rather than random ones so the calibration is
 * itself deterministic and the board cannot shimmer between redraws.
 */
function calibrate(seed, cell) {
    const samples = new Float64Array(CALIBRATION_SAMPLES);
    const side = Math.sqrt(CALIBRATION_SAMPLES) | 0;
    // Spread over a region much larger than one noise cell, and deliberately
    // not a multiple of it, so the sample is not taken from the same phase of
    // every cell.
    const stride = cell * 3 + 1;
    for (let i = 0; i < CALIBRATION_SAMPLES; i++) {
        const x = (i % side) * stride;
        const y = ((i / side) | 0) * stride;
        samples[i] = patchNoise(x, y, seed, cell);
    }
    samples.sort();
    return (coverage) => {
        if (coverage <= 0) return -Infinity;   // nothing is below this
        if (coverage >= 1) return Infinity;    // everything is
        return samples[Math.floor(coverage * (CALIBRATION_SAMPLES - 1))];
    };
}

/**
 * Smooth noise in [0, 1) at an absolute art-pixel position.
 *
 * Value noise: hash the corners of the coarse cell this pixel falls in, then
 * interpolate. Cheap, stable, and continuous across every boundary the board
 * has, because it never asks which subtile it is in.
 */
export function patchNoise(px, py, seed, cell = NOISE_CELL) {
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
 * The alpha masks that say where each patch substrate shows through.
 *
 * One mask per distinct patch substrate, at **art-pixel** resolution — so 232
 * square on the 8px art set. The renderer scales it up with smoothing off,
 * which is both faster than drawing thousands of little rectangles and the only
 * way to keep the patch edges on the pixel grid.
 *
 * @param {Array<string|null>} grid A resolved lattice from `resolveLattice`.
 * @param {number} seed The save's terrain seed.
 * @returns {{width: number, height: number, masks: Record<string, Uint8ClampedArray>}}
 *   Each mask is one byte per art pixel: 255 where that substrate shows, 0
 *   where it does not. Empty `masks` when no terrain on the board has patches.
 */
export function buildPatchMasks(grid, seed = 0) {
    const artPx = subtileArtPx();
    const size = LATTICE_SIZE * artPx;
    const coverageScale = tuning('patchCoverage');
    const cell = Math.max(2, Math.round(NOISE_CELL * tuning('patchScale')));

    // Which subtiles want patches at all, resolved once rather than per pixel.
    // Most boards have large runs of terrain with none, and the per-pixel noise
    // is by far the expensive part.
    const wants = new Array(grid.length);
    const substrates = new Set();
    let any = false;
    for (let i = 0; i < grid.length; i++) {
        const patch = grid[i] ? patchOf(grid[i]) : null;
        if (!patch || patch.coverage <= 0) { wants[i] = null; continue; }
        wants[i] = patch;
        substrates.add(patch.substrate);
        any = true;
    }
    if (!any) return { width: size, height: size, masks: {} };

    const masks = {};
    for (const substrate of substrates) {
        masks[substrate] = new Uint8ClampedArray(size * size);
    }

    // One calibration for the whole board — the noise has the same statistics
    // everywhere, so every terrain's coverage can be read off the same curve.
    const thresholdFor = calibrate(seed, cell);
    const thresholds = new Map();

    for (let py = 0; py < size; py++) {
        const sy = (py / artPx) | 0;
        for (let px = 0; px < size; px++) {
            const patch = wants[sy * LATTICE_SIZE + ((px / artPx) | 0)];
            if (!patch) continue;

            // Below the threshold is worn through, and the threshold is the
            // quantile that actually yields the requested fraction — see
            // `calibrate`. Cached per coverage value, since a board has only a
            // handful of distinct ones.
            const wanted = patch.coverage * coverageScale;
            if (!thresholds.has(wanted)) thresholds.set(wanted, thresholdFor(wanted));
            if (patchNoise(px, py, seed, cell) < thresholds.get(wanted)) {
                masks[patch.substrate][py * size + px] = 255;
            }
        }
    }

    return { width: size, height: size, masks };
}

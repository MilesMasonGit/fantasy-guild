// Fantasy Guild — Patches of one substrate showing through another.

import { hash01 } from './TerrainLattice.js';
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
 *
 * ⚠️ Which is why this reads the **art-pixel** map rather than the subtile
 * lattice. Gated per subtile, dirt speckled straight across the beaches fringed
 * onto a forest's edge: the subtile was still forest, so the patch had no idea
 * the ground beneath it had become sand. Per pixel it stops where the sand
 * starts, because it is asking the same question the renderer answers.
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
 * The noise field, kept between repaints.
 *
 * ⚠️ It depends on the **seed and the clump size only** — not on the terrain —
 * so recomputing it whenever a Token moves was fifty thousand evaluations of
 * four hashes each to arrive at exactly the number it arrived at last time.
 * About 4ms of a repaint, spent reproducing a constant.
 *
 * Held as one field for the whole board rather than only the patched parts:
 * which parts are patched changes with the terrain, and a cache that had to be
 * invalidated whenever the board changed would not be a cache.
 */
let noiseCache = { key: null, field: null, quantiles: null };

function noiseField(size, seed, cell) {
    const key = `${size}|${seed}|${cell}`;
    if (noiseCache.key === key) return noiseCache;

    const field = new Float32Array(size * size);
    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            field[py * size + px] = patchNoise(px, py, seed, cell);
        }
    }

    // Calibration comes off the field itself now, rather than from a second
    // set of samples taken at made-up coordinates — it is the real
    // distribution of the real board, and it is already in memory.
    const step = Math.max(1, Math.floor(field.length / CALIBRATION_SAMPLES));
    const sample = [];
    for (let i = 0; i < field.length; i += step) sample.push(field[i]);
    sample.sort((a, b) => a - b);

    noiseCache = { key, field, quantiles: sample };
    return noiseCache;
}

/**
 * ⚠️ **Coverage has to be calibrated, not used as a threshold directly.**
 *
 * Interpolating between four uniform random corners does not give a uniform
 * result — it piles up around the middle, the way the average of four dice
 * does. So `noise < 0.18` is nowhere near 18% of pixels: measured on the real
 * board it came out at **1.6%**, an order of magnitude short of what the
 * terrain asked for, and the first version of this shipped that.
 *
 * Rather than fight the distribution, this measures it: coverage picks a
 * **quantile** of the sorted noise. Then "0.18" means what it says — 18% of the
 * ground is worn through — for every terrain, whatever the noise happens to
 * look like at that scale.
 */
function thresholdFrom(quantiles, coverage) {
    if (coverage <= 0) return -Infinity;   // nothing is below this
    if (coverage >= 1) return Infinity;    // everything is
    return quantiles[Math.floor(coverage * (quantiles.length - 1))];
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
 * @param {object} artPixels A resolved art-pixel map from `resolveArtPixels`.
 * @param {number} seed The save's terrain seed.
 * @returns {{width: number, height: number, masks: Record<string, Uint8ClampedArray>}}
 *   Each mask is one byte per art pixel: 255 where that substrate shows, 0
 *   where it does not. Empty `masks` when no terrain on the board has patches.
 */
export function buildPatchMasks(artPixels, seed = 0) {
    const { size, palette, at } = artPixels;
    const coverageScale = tuning('patchCoverage');
    const cell = Math.max(2, Math.round(NOISE_CELL * tuning('patchScale')));

    // Which terrains want patches at all, resolved once per palette entry
    // rather than once per pixel — the per-pixel noise is the expensive part.
    const wants = palette.map(id => {
        const patch = patchOf(id);
        return patch && patch.coverage > 0 ? patch : null;
    });
    const substrates = new Set(wants.filter(Boolean).map(p => p.substrate));
    if (substrates.size === 0) return { width: size, height: size, masks: {} };

    const masks = {};
    for (const substrate of substrates) {
        masks[substrate] = new Uint8ClampedArray(size * size);
    }

    // One noise field and one calibration for the whole board, both cached
    // across repaints — see `noiseField`.
    const { field, quantiles } = noiseField(size, seed, cell);
    const thresholds = new Map();

    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            const terrain = at[py * size + px];
            const patch = terrain >= 0 ? wants[terrain] : null;
            if (!patch) continue;

            // Below the threshold is worn through, and the threshold is the
            // quantile that actually yields the requested fraction — see
            // `calibrate`. Cached per coverage value, since a board has only a
            // handful of distinct ones.
            const wanted = patch.coverage * coverageScale;
            if (!thresholds.has(wanted)) {
                thresholds.set(wanted, thresholdFrom(quantiles, wanted));
            }
            if (field[py * size + px] < thresholds.get(wanted)) {
                masks[patch.substrate][py * size + px] = 255;
            }
        }
    }

    return { width: size, height: size, masks };
}

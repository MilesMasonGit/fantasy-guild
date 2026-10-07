// patches of one substrate showing through another

import { hash01 } from './TerrainLattice.js';
import { patchOf } from '../../config/registries/terrainRegistry.js';
import { tuning } from '../../config/playmatTuning.js';

/**
 * Clumps of bare earth worn through the grass: a second substrate showing through a first inside
 * one terrain, with no edge involved.
 *
 * Clumps, not speckle: the shape comes from smooth value noise on a coarse grid, interpolated,
 * because independent per-pixel noise gives dithering.
 *
 * The noise is sampled from absolute art-pixel coordinates, so a clump runs across subtile and tile
 * boundaries without lining anything up. What stops a patch is the terrain underneath changing to
 * one with no patches declared.
 *
 * ⚠️ Reads the art-pixel map, not the subtile lattice: gated per subtile, dirt speckled across the
 * beaches fringed onto a forest's edge, because the subtile was still forest. Per pixel it stops
 * where the sand starts.
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
 * ⚠️ It depends on the seed and the clump size only, not on the terrain, so recomputing it whenever
 * a Token moves is wasted work. Held for the whole board rather than only the patched parts: which
 * parts are patched changes with the terrain, and a cache that had to be invalidated whenever the
 * board changed would not be a cache.
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

    const step = Math.max(1, Math.floor(field.length / CALIBRATION_SAMPLES));
    const sample = [];
    for (let i = 0; i < field.length; i += step) sample.push(field[i]);
    sample.sort((a, b) => a - b);

    noiseCache = { key, field, quantiles: sample };
    return noiseCache;
}

/**
 * ⚠️ Coverage has to be calibrated, not used as a threshold directly.
 *
 * Interpolating between uniform random corners does not give a uniform result: it piles up around
 * the middle, so `noise < 0.18` is nowhere near 18% of pixels. Instead coverage picks a quantile of
 * the sorted noise, so 0.18 means 18% of the ground for every terrain.
 */
function thresholdFrom(quantiles, coverage) {
    if (coverage <= 0) return -Infinity;
    if (coverage >= 1) return Infinity;
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
 * One mask per distinct patch substrate, at art-pixel resolution. The renderer scales it up with
 * smoothing off, which keeps the patch edges on the pixel grid and is faster than drawing many
 * small rectangles.
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

    // Which terrains want patches at all, resolved once per palette entry rather than once per
    // pixel: the per-pixel noise is the expensive part.
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

    const { field, quantiles } = noiseField(size, seed, cell);
    const thresholds = new Map();

    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            const terrain = at[py * size + px];
            const patch = terrain >= 0 ? wants[terrain] : null;
            if (!patch) continue;

            // The threshold is the calibrated quantile (see `calibrate`), cached per coverage
            // value.
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

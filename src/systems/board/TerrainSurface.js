// what every art pixel of the ground should look like

import { LATTICE_SIZE, subtileArtPx, variantAt } from './TerrainLattice.js';
import { buildBandMasks } from './TerrainBands.js';
import { buildPatchMasks } from './TerrainPatches.js';
import { buildToneMap } from './TerrainTones.js';
import { getTerrain, substrateVariants } from '../../config/registries/terrainRegistry.js';

/**
 * One answer per art pixel: which substrate, which variant of it, and whether it is tinted.
 *
 * ⚠️ A single buffer rather than one canvas pass per feature: the features all answer the same
 * question (what is at this pixel), and a pass each, with a clip() call per boundary pixel, cost
 * far too much per repaint. A wandering coastline is just a different value in the buffer.
 *
 * Kept as data, not drawing, so it can be tested.
 *
 * `resolveArtPixels` has already done the ragged boundaries and the beaches, so the terrain index
 * here is what the player ends up seeing.
 */

/**
 * @param {object} artPixels A resolved map from `resolveArtPixels`.
 * @param {number} seed The save's terrain seed.
 * @returns {{
 *   size: number, substrates: string[],
 *   substrateAt: Int16Array, variantAt: Int16Array, tintAt: Int16Array,
 *   tints: Array<{tint: string, amount: number}>
 * }} Per art pixel: which substrate to sample (-1 for bare table), which
 *   variant of it, and which tint to apply (-1 for none).
 */
export function buildSurface(artPixels, seed = 0) {
    const { size, palette, at } = artPixels;
    const artPx = subtileArtPx();

    const bands = buildBandMasks(artPixels, seed);
    const patches = buildPatchMasks(artPixels, seed);
    const toneMap = buildToneMap(artPixels);

    // Tables resolved to integers once: the inner loop runs once per art pixel, so a registry
    // lookup or string compare in it is expensive.

    const substrates = [];
    const substrateIndex = new Map();
    const substrateIdFor = (id) => {
        if (!id) return -1;
        let i = substrateIndex.get(id);
        if (i === undefined) {
            i = substrates.length;
            substrates.push(id);
            substrateIndex.set(id, i);
        }
        return i;
    };

    /** The substrate each terrain's plain ground uses. */
    const baseSubstrate = palette.map(id => substrateIdFor(getTerrain(id)?.substrate));

    const tints = [];
    const tintFor = new Map();
    const tintIdFor = (appearance) => {
        if (!appearance) return -1;
        const key = `${appearance.tint}|${appearance.amount}`;
        let i = tintFor.get(key);
        if (i === undefined) {
            i = tints.length;
            tints.push(appearance);
            tintFor.set(key, i);
        }
        return i;
    };

    const substrateAt = new Int16Array(size * size).fill(-1);
    const variants = new Int16Array(size * size);
    const tintAt = new Int16Array(size * size).fill(-1);

    const patchMasks = Object.entries(patches.masks)
        .map(([id, mask]) => ({ substrate: substrateIdFor(id), mask }));

    const bandMasks = bands.bands.map(({ terrainId, mask, appearance }) => ({
        terrain: palette.indexOf(terrainId),
        tint: tintIdFor(appearance),
        mask
    })).filter(b => b.terrain >= 0 && b.tint >= 0);

    // The variant is a property of the subtile, not of the pixel, so it is chosen once per subtile.
    const variantTables = substrates.map(id => {
        const count = substrateVariants(id);
        const table = new Int16Array(LATTICE_SIZE * LATTICE_SIZE);
        for (let sy = 0; sy < LATTICE_SIZE; sy++) {
            for (let sx = 0; sx < LATTICE_SIZE; sx++) {
                table[sy * LATTICE_SIZE + sx] = variantAt(sx, sy, count, seed);
            }
        }
        return table;
    });

    for (let i = 0; i < at.length; i++) {
        const terrain = at[i];
        if (terrain < 0) continue;
        substrateAt[i] = baseSubstrate[terrain];
    }

    // ⚠️ Three things want to colour a pixel, and the order they are applied in is the precedence
    // rule: tone (the terrain's overall wash, the weakest claim), band (a local edge effect), patch
    // (different ground entirely, so it drops the colouring with it).
    if (toneMap.tones.length) {
        const offset = tints.length;
        for (const tone of toneMap.tones) tints.push(tone);
        for (let i = 0; i < at.length; i++) {
            const t = toneMap.toneAt[i];
            if (t >= 0) tintAt[i] = offset + t;
        }
    }

    for (const { terrain, tint, mask } of bandMasks) {
        for (let i = 0; i < mask.length; i++) {
            if (mask[i] && at[i] === terrain) tintAt[i] = tint;
        }
    }
    for (const { substrate, mask } of patchMasks) {
        for (let i = 0; i < mask.length; i++) {
            if (!mask[i]) continue;
            substrateAt[i] = substrate;
            tintAt[i] = -1;          // bare earth is not shallow water
        }
    }

    // Subtile by subtile, so the variant is looked up once per subtile and the pixel index is a
    // counter rather than two divisions per pixel.
    for (let sy = 0; sy < LATTICE_SIZE; sy++) {
        for (let sx = 0; sx < LATTICE_SIZE; sx++) {
            const subtile = sy * LATTICE_SIZE + sx;
            for (let ty = 0; ty < artPx; ty++) {
                let i = (sy * artPx + ty) * size + sx * artPx;
                for (let tx = 0; tx < artPx; tx++, i++) {
                    const substrate = substrateAt[i];
                    if (substrate >= 0) variants[i] = variantTables[substrate][subtile];
                }
            }
        }
    }

    return { size, substrates, substrateAt, variantAt: variants, tintAt, tints };
}

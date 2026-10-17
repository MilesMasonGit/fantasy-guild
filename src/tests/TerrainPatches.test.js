import { describe, it, expect, afterEach } from 'vitest';
import { patchNoise, buildWearMask } from '../systems/board/TerrainPatches.js';
import { resolveArtPixels, CELL_PX } from '../systems/board/TerrainLattice.js';
import { LOOKS, wearOf } from '../config/registries/terrainRegistry.js';
import { setTuning, resetTuning } from '../config/playmatTuning.js';
import { groundWith, flat } from './fixtures/ground.js';

/**
 * Wear: a second sheet showing through a look in clumps (earth through grass, gravel through
 * rock), placed by smooth noise and calibrated so a coverage means that share of the ground.
 */

afterEach(() => resetTuning());

/** The ground of one look everywhere: meadow needs no biome to own the grass. */
const lookGround = (lookId, seed = 5) => {
    const terrain = LOOKS[lookId].terrain;
    const biomes = lookId === 'meadow' ? null : { main: lookId, terrains: { [lookId]: terrain } };
    return groundWith(40, 24, flat(terrain), { seed, biomes });
};

const share = (mask) => mask.reduce((n, v) => n + (v ? 1 : 0), 0) / mask.length;

describe('The noise makes clumps, not speckle', () => {
    it('stays in range and is the same every time', () => {
        for (let i = 0; i < 200; i++) {
            const v = patchNoise(i * 3, i * 7, 42);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
            expect(patchNoise(i * 3, i * 7, 42)).toBe(v);
        }
    });

    it('⭐ changes gently between neighbouring pixels', () => {
        let total = 0;
        let n = 0;
        for (let y = 0; y < 60; y++) {
            for (let x = 0; x < 60; x++) {
                total += Math.abs(patchNoise(x, y, 9, 10) - patchNoise(x + 1, y, 9, 10));
                n++;
            }
        }
        expect(total / n).toBeLessThan(0.12);
    });

    it('does not notice the cell lines', () => {
        const edge = CELL_PX * 4;
        expect(Math.abs(patchNoise(edge - 1, 20, 3, 10) - patchNoise(edge, 20, 3, 10))).toBeLessThan(0.2);
    });

    it('differs between seeds', () => {
        expect(patchNoise(10, 10, 1)).not.toBe(patchNoise(10, 10, 2));
    });
});

describe('⭐ The wear noise is read from cached corners', () => {
    it('gives exactly the reference noise\'s answer at every pixel', () => {
        // The fast path hashes each noise corner once instead of four times a pixel; it must not
        // change a single pixel of the wear.
        for (const lookId of ['meadow', 'mountain']) {
            const ground = groundWith(20, 12, flat(LOOKS[lookId].terrain), {
                seed: 77, biomes: lookId === 'meadow' ? null : { main: lookId, terrains: { [lookId]: LOOKS[lookId].terrain } }
            });
            const pixels = resolveArtPixels(ground);
            const { mask, thresholds, cell } = buildWearMask(pixels, ground);
            let on = 0;
            const wrong = [];
            for (let i = 0; i < mask.length; i++) {
                const x = i % pixels.width;
                const y = (i - x) / pixels.width;
                const want = patchNoise(x, y, 77, cell) < thresholds[pixels.at[i]] ? 1 : 0;
                if (mask[i] !== want) wrong.push(`${x},${y}`);
                on += want;
            }
            expect(wrong.slice(0, 5), `${lookId}: ${wrong.length} pixels differ`).toEqual([]);
            expect(on).toBeGreaterThan(0);
        }
    });
});

describe('⚠️ Coverage means what it says', () => {
    it('⭐ each look wears through about the share it asks (calibrated)', () => {
        const wearing = Object.keys(LOOKS).filter(id => wearOf(id));
        expect(wearing.sort()).toEqual(['forest', 'meadow', 'mountain']);
        for (const id of wearing) {
            const ground = lookGround(id);
            const { mask } = buildWearMask(resolveArtPixels(ground), ground);
            const asked = wearOf(id).coverage;
            const got = share(mask);
            expect(got, `${id} asked ${asked}, got ${got.toFixed(3)}`).toBeGreaterThan(asked * 0.6);
            expect(got, `${id} asked ${asked}, got ${got.toFixed(3)}`).toBeLessThan(asked * 1.4);
        }
    });

    it('scales with the coverage slider, and zero means none', () => {
        const at = () => {
            const ground = lookGround('meadow');
            const { mask } = buildWearMask(resolveArtPixels(ground), ground);
            return mask ? share(mask) : 0;
        };
        const base = at();
        setTuning('patchCoverage', 0);
        expect(at()).toBe(0);
        setTuning('patchCoverage', 2);
        expect(at()).toBeGreaterThan(base);
    });

    it('⭐ wears about a tenth of a meadow, and a little less of a forest', () => {
        const got = (id) => {
            const ground = lookGround(id);
            return share(buildWearMask(resolveArtPixels(ground), ground).mask);
        };
        expect(wearOf('meadow').coverage).toBe(0.1);
        expect(got('meadow')).toBeGreaterThan(0.07);
        expect(got('meadow')).toBeLessThan(0.13);
        expect(wearOf('forest').coverage).toBeLessThan(wearOf('meadow').coverage);
    });

    it('⭐ with "Wear in the middle" up, wears more in the middle and less at the edges, about as much in all', () => {
        const parts = () => {
            let middle = 0;
            let middleN = 0;
            let edge = 0;
            let edgeN = 0;
            let total = 0;
            let n = 0;
            for (const seed of [41, 42, 43, 44]) {
                const ground = groundWith(60, 36, flat('grass'), { seed, biomes: null });
                const pixels = resolveArtPixels(ground);
                const { mask } = buildWearMask(pixels, ground);
                for (let i = 0; i < mask.length; i++) {
                    const x = i % pixels.width;
                    const y = (i - x) / pixels.width;
                    const dx = Math.abs(x / pixels.width - 0.5);
                    const dy = Math.abs(y / pixels.height - 0.5);
                    if (dx < 0.2 && dy < 0.2) { middle += mask[i]; middleN++; }
                    if (dx > 0.4 || dy > 0.4) { edge += mask[i]; edgeN++; }
                    total += mask[i];
                    n++;
                }
            }
            return { middle: middle / middleN, edge: edge / edgeN, all: total / n };
        };
        const even = parts();
        setTuning('wearMiddle', 0.8);
        const leaning = parts();
        expect(leaning.middle).toBeGreaterThan(even.middle * 1.3);
        expect(leaning.edge).toBeLessThan(even.edge * 0.7);
        expect(leaning.all).toBeGreaterThan(even.all * 0.7);
        expect(leaning.all).toBeLessThan(even.all * 1.3);
    });

    it('grows its clumps with the clump size (mat units)', () => {
        // Bigger clumps at the same coverage leave fewer edges between worn and unworn ground.
        const edges = () => {
            const ground = lookGround('forest');
            const pixels = resolveArtPixels(ground);
            const { mask } = buildWearMask(pixels, ground);
            let n = 0;
            for (let i = 1; i < mask.length; i++) if (i % pixels.width && mask[i] !== mask[i - 1]) n++;
            return n;
        };
        setTuning('wearClump', 8);
        const small = edges();
        setTuning('wearClump', 60);
        expect(edges()).toBeLessThan(small / 2);
    });
});

describe('Wear stays on the ground that wears', () => {
    it('wears nothing on the coast or the sea', () => {
        for (const id of ['coast', 'sea']) {
            expect(wearOf(id), id).toBeNull();
            const ground = lookGround(id);
            expect(buildWearMask(resolveArtPixels(ground), ground).mask, id).toBeNull();
        }
    });

    it('⭐ never crosses onto the sand: not the beach rim, not a coast\'s own sand', () => {
        // Gated per pixel on the drawn ground, after the beach is cut: the September regression
        // was dirt speckled across a beach because the gate was the cell, still forest.
        for (const fill of [
            (c) => (c < 6 ? 'water' : 'grass'),
            (c) => (c < 6 ? 'water' : (c < 12 ? 'sand' : 'grass')),
            (c, r) => (c < 6 ? 'water' : (c + r < 20 ? 'sand' : 'rock'))
        ]) {
            const ground = groundWith(24, 14, fill);
            const pixels = resolveArtPixels(ground);
            const { mask } = buildWearMask(pixels, ground);
            const sand = pixels.palette.indexOf('sand');
            let onSand = 0;
            let worn = 0;
            for (let i = 0; i < mask.length; i++) {
                if (!mask[i]) continue;
                worn++;
                if (pixels.at[i] === sand) onSand++;
            }
            expect(worn).toBeGreaterThan(0);
            expect(onSand, 'wear on the sand').toBe(0);
        }
    });

    it('is a mask the size of the plan, and the same every time', () => {
        const ground = lookGround('meadow', 31);
        const pixels = resolveArtPixels(ground);
        const a = buildWearMask(pixels, ground).mask;
        expect(a.length).toBe(pixels.width * pixels.height);
        expect(Array.from(buildWearMask(pixels, ground).mask)).toEqual(Array.from(a));
    });
});

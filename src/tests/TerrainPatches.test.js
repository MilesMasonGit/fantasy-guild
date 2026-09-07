import { describe, it, expect, afterEach } from 'vitest';
import { patchNoise, buildPatchMasks } from '../systems/board/TerrainPatches.js';
import { LATTICE_SIZE, subtileArtPx } from '../systems/board/TerrainLattice.js';
import { patchOf, TERRAIN_TYPES } from '../config/registries/terrainRegistry.js';
import { setTuning, resetTuning } from '../config/playmatTuning.js';

/**
 * Patches — a second substrate worn through a first.
 *
 * The test that matters here is the coverage one. The first version used the
 * authored coverage directly as a noise threshold, which sounds right and is
 * not: interpolating four uniform corners piles the result up around the middle,
 * so "0.18" produced **1.6%** on the real board. It looked plausible in code,
 * produced a picture, and was an order of magnitude wrong.
 */

afterEach(() => resetTuning());

const artPx = () => subtileArtPx();
const size = () => LATTICE_SIZE * artPx();
const flat = (terrainId) => new Array(LATTICE_SIZE * LATTICE_SIZE).fill(terrainId);

/** What fraction of the eligible ground a mask actually covers. */
function coveredFraction(terrainId, seed = 5) {
    const grid = flat(terrainId);
    const { masks } = buildPatchMasks(grid, seed);
    const substrate = patchOf(terrainId)?.substrate;
    const mask = masks[substrate];
    if (!mask) return 0;
    let on = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i]) on++;
    return on / mask.length;
}

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
        // This is what separates a clump from dithering. Independent per-pixel
        // noise would average about a third of the range between neighbours;
        // interpolated noise moves a small fraction of it.
        let total = 0;
        let n = 0;
        for (let y = 0; y < 60; y++) {
            for (let x = 0; x < 60; x++) {
                total += Math.abs(patchNoise(x, y, 9) - patchNoise(x + 1, y, 9));
                n++;
            }
        }
        expect(total / n).toBeLessThan(0.12);
    });

    it('does not notice subtile or tile boundaries', () => {
        // Sampled from absolute coordinates, so there is nothing to line up.
        // A clump runs across a boundary without knowing it is there.
        const edge = artPx() * 4;   // a subtile boundary
        expect(Math.abs(patchNoise(edge - 1, 20, 3) - patchNoise(edge, 20, 3)))
            .toBeLessThan(0.2);
    });

    it('differs between seeds', () => {
        expect(patchNoise(10, 10, 1)).not.toBe(patchNoise(10, 10, 2));
    });
});

describe('⚠️ Coverage means what it says', () => {
    it('⭐ wears through roughly the fraction the terrain asked for', () => {
        // THE regression test. Not an exact match — the noise is continuous and
        // the sample is finite — but it must be the right order of magnitude,
        // which the first version was not.
        for (const [id, terrain] of Object.entries(TERRAIN_TYPES)) {
            if (!terrain.patch) continue;
            const asked = terrain.patch.coverage;
            const got = coveredFraction(id);
            expect(got, `${id} asked ${asked}, got ${got.toFixed(3)}`)
                .toBeGreaterThan(asked * 0.6);
            expect(got, `${id} asked ${asked}, got ${got.toFixed(3)}`)
                .toBeLessThan(asked * 1.4);
        }
    });

    it('scales with the tuning slider, and zero means none', () => {
        const base = coveredFraction('meadow');
        setTuning('patchCoverage', 0);
        expect(coveredFraction('meadow')).toBe(0);
        setTuning('patchCoverage', 2);
        expect(coveredFraction('meadow')).toBeGreaterThan(base);
    });
});

describe('Patches stay where they belong', () => {
    it('puts nothing on terrain that declares none', () => {
        for (const id of Object.keys(TERRAIN_TYPES)) {
            if (patchOf(id)) continue;
            expect(buildPatchMasks(flat(id), 5).masks, id).toEqual({});
        }
    });

    it('puts nothing on unpainted ground', () => {
        const empty = new Array(LATTICE_SIZE * LATTICE_SIZE).fill(null);
        expect(buildPatchMasks(empty, 5).masks).toEqual({});
    });

    it('⭐ stops at the edge of the terrain that grew it', () => {
        // Half the board grass, half sand. Dirt worn into the grass must not
        // continue into the sand — the noise itself has no idea a boundary is
        // there, so this is the mask being gated by terrain, not by the noise.
        const grid = flat('shore');
        for (let sy = 0; sy < LATTICE_SIZE; sy++) {
            for (let sx = 0; sx < Math.floor(LATTICE_SIZE / 2); sx++) {
                grid[sy * LATTICE_SIZE + sx] = 'meadow';
            }
        }
        const { masks } = buildPatchMasks(grid, 5);
        const mask = masks.dirt;
        const s = size();
        const boundaryPx = Math.floor(LATTICE_SIZE / 2) * artPx();

        let beyond = 0;
        let within = 0;
        for (let py = 0; py < s; py++) {
            for (let px = 0; px < s; px++) {
                if (!mask[py * s + px]) continue;
                if (px >= boundaryPx) beyond++; else within++;
            }
        }
        expect(within).toBeGreaterThan(0);
        expect(beyond, 'dirt bled onto the sand').toBe(0);
    });

    it('reports a mask the size of the board in art pixels', () => {
        const built = buildPatchMasks(flat('meadow'), 5);
        expect(built.width).toBe(size());
        expect(built.height).toBe(size());
        expect(built.masks.dirt.length).toBe(size() * size());
    });

    it('is identical every time', () => {
        const a = buildPatchMasks(flat('meadow'), 77).masks.dirt;
        const b = buildPatchMasks(flat('meadow'), 77).masks.dirt;
        expect(Array.from(a)).toEqual(Array.from(b));
    });
});

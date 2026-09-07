import { describe, it, expect, afterEach } from 'vitest';
import { buildBandMasks } from '../systems/board/TerrainBands.js';
import {
    resolveArtPixels, resolveLattice, edgeStrips, LATTICE_SIZE, subtileArtPx
} from '../systems/board/TerrainLattice.js';
import { TERRAIN_TYPES, bandOf } from '../config/registries/terrainRegistry.js';
import { setTuning, resetTuning } from '../config/playmatTuning.js';

/**
 * Shore bands, and the per-art-pixel terrain map they are measured on.
 *
 * The map has to agree with what the renderer actually paints, and the band has
 * to be caused by the right neighbour. Both were got wrong first time — the
 * second one visibly, with wet sand appearing where the beach met the forest.
 */

afterEach(() => resetTuning());

const flat = (terrainId) => new Array(LATTICE_SIZE * LATTICE_SIZE).fill(terrainId);

/** Sea on the left, beach in the middle, forest on the right. */
function coastGrid() {
    const grid = new Array(LATTICE_SIZE * LATTICE_SIZE);
    const third = Math.floor(LATTICE_SIZE / 3);
    for (let sy = 0; sy < LATTICE_SIZE; sy++) {
        for (let sx = 0; sx < LATTICE_SIZE; sx++) {
            grid[sy * LATTICE_SIZE + sx] =
                sx < third ? 'ocean' : (sx < third * 2 ? 'shore' : 'forest');
        }
    }
    return grid;
}

describe('The per-art-pixel terrain map', () => {
    it('covers the board at art resolution, with a palette of what is on it', () => {
        const { size, palette, at } = resolveArtPixels(coastGrid(), 5);
        expect(size).toBe(LATTICE_SIZE * subtileArtPx());
        expect(at.length).toBe(size * size);
        expect([...palette].sort()).toEqual(['forest', 'ocean', 'shore']);
    });

    it('leaves unpainted ground unpainted', () => {
        const { at } = resolveArtPixels(new Array(LATTICE_SIZE * LATTICE_SIZE).fill(null), 5);
        expect(at.every(v => v === -1)).toBe(true);
    });

    it('⭐ agrees with the strips the renderer paints from', () => {
        // The map and the canvas both apply `edgeStrips`. If they ever drift,
        // bands would sit beside the coastline instead of on it — and that is
        // precisely the class of bug P3 shipped, where the data was right and
        // the drawing was not.
        const grid = coastGrid();
        const seed = 9;
        const { size, palette, at } = resolveArtPixels(grid, seed);

        let checked = 0;
        for (let sy = 0; sy < LATTICE_SIZE - 1; sy++) {
            for (let sx = 0; sx < LATTICE_SIZE - 1; sx++) {
                const here = grid[sy * LATTICE_SIZE + sx];
                for (const axis of ['v', 'h']) {
                    const there = axis === 'v'
                        ? grid[sy * LATTICE_SIZE + sx + 1]
                        : grid[(sy + 1) * LATTICE_SIZE + sx];
                    for (const s of edgeStrips(sx, sy, axis, here, there, seed)) {
                        for (let y = s.y; y < s.y + s.h; y++) {
                            for (let x = s.x; x < s.x + s.w; x++) {
                                if (x < 0 || y < 0 || x >= size || y >= size) continue;
                                expect(palette[at[y * size + x]]).toBe(s.terrainId);
                                checked++;
                            }
                        }
                    }
                }
            }
        }
        expect(checked).toBeGreaterThan(100);
    });
});

describe('Bands appear only where a terrain asks for one', () => {
    it('gives nothing to terrain with no band declared', () => {
        for (const id of Object.keys(TERRAIN_TYPES)) {
            if (bandOf(id)) continue;
            expect(buildBandMasks(flat(id), 5).bands, id).toEqual([]);
        }
    });

    it('gives nothing on a board of one terrain — there is no edge to band', () => {
        expect(buildBandMasks(flat('ocean'), 5).bands).toEqual([]);
    });

    it('bands the ocean and the shore on a coast', () => {
        const named = buildBandMasks(coastGrid(), 5).bands.map(b => b.terrainId).sort();
        expect(named).toEqual(['ocean', 'shore']);
    });

    it('paints a band only onto its own terrain', () => {
        const grid = coastGrid();
        const { size, palette, at } = resolveArtPixels(grid, 5);
        for (const { terrainId, mask } of buildBandMasks(grid, 5).bands) {
            for (let i = 0; i < mask.length; i++) {
                if (mask[i]) expect(palette[at[i]]).toBe(terrainId);
            }
        }
        expect(size).toBeGreaterThan(0);
    });
});

describe('⚠️ A band is caused by a neighbour, not by having an edge', () => {
    /** What each band's pixels actually sit next to, across the boundary. */
    function touches(grid, seed, terrainId) {
        const { size, palette, at } = resolveArtPixels(grid, seed);
        const band = buildBandMasks(grid, seed).bands.find(b => b.terrainId === terrainId);
        const found = new Set();
        if (!band) return found;
        for (let y = 1; y < size - 1; y++) {
            for (let x = 1; x < size - 1; x++) {
                const i = y * size + x;
                if (!band.mask[i]) continue;
                for (const j of [i - 1, i + 1, i - size, i + size]) {
                    if (at[j] !== at[i]) found.add(palette[at[j]] ?? 'unpainted');
                }
            }
        }
        return found;
    }

    it('⭐ wet sand appears against water and nothing else', () => {
        // THE regression test. `shore` bands against `ocean` only. Without
        // `against`, this came out touching forest across 486 pixels — a wet
        // beach where it met the woods, because a band was a property of having
        // an edge rather than of what was on the other side of it.
        expect([...touches(coastGrid(), 5, 'shore')]).toEqual(['ocean']);
    });

    it('⭐ water never meets anything but sand, because of the beach', () => {
        // The fringe's whole purpose. Ocean declares no `against`, so it bands
        // against whatever is there — and after fringing, what is there is
        // always shore, because a beach is written onto every neighbour first.
        //
        // ⚠️ This test used to expect ocean beside forest and had to be
        // rewritten when the beach landed. That is the right way round: the
        // guarantee got stronger, so the assertion did.
        expect([...touches(coastGrid(), 5, 'ocean')]).toEqual(['shore']);

        const seaMeetsWood = new Array(LATTICE_SIZE * LATTICE_SIZE);
        for (let sy = 0; sy < LATTICE_SIZE; sy++) {
            for (let sx = 0; sx < LATTICE_SIZE; sx++) {
                seaMeetsWood[sy * LATTICE_SIZE + sx] =
                    sx < LATTICE_SIZE / 2 ? 'ocean' : 'forest';
            }
        }
        // Sea laid directly against forest, with no sand authored anywhere.
        expect([...touches(seaMeetsWood, 5, 'ocean')]).toEqual(['shore']);
    });

    it('does not band against bare table — a map running out is not a shore', () => {
        // Ocean in one corner, nothing around it.
        const grid = new Array(LATTICE_SIZE * LATTICE_SIZE).fill(null);
        for (let sy = 0; sy < 8; sy++) {
            for (let sx = 0; sx < 8; sx++) grid[sy * LATTICE_SIZE + sx] = 'ocean';
        }
        expect(buildBandMasks(grid, 5).bands).toEqual([]);
    });
});

describe('Width and stability', () => {
    it('widens with the tuning slider, and zero turns it off', () => {
        const count = (mult) => {
            setTuning('bandWidth', mult);
            const band = buildBandMasks(coastGrid(), 5).bands.find(b => b.terrainId === 'ocean');
            if (!band) return 0;
            let n = 0;
            for (let i = 0; i < band.mask.length; i++) if (band.mask[i]) n++;
            return n;
        };
        const normal = count(1);
        expect(count(0)).toBe(0);
        expect(count(2)).toBeGreaterThan(normal);
    });

    it('stays within a reasonable distance of the water', () => {
        // A band that grew without limit would flood the terrain rather than
        // edge it. Ocean is four pixels wide by default.
        const grid = coastGrid();
        const band = buildBandMasks(grid, 5).bands.find(b => b.terrainId === 'ocean');
        const { size, palette, at } = resolveArtPixels(grid, 5);
        let total = 0;
        let banded = 0;
        for (let i = 0; i < band.mask.length; i++) {
            if (palette[at[i]] === 'ocean') total++;
            if (band.mask[i]) banded++;
        }
        expect(banded / total).toBeLessThan(0.6);
        expect(size).toBeGreaterThan(0);
    });

    it('is identical every time', () => {
        const a = buildBandMasks(coastGrid(), 31).bands.map(b => Array.from(b.mask).join(''));
        const b = buildBandMasks(coastGrid(), 31).bands.map(b2 => Array.from(b2.mask).join(''));
        expect(a).toEqual(b);
    });
});

describe('⭐ Beaches — a fringe written onto the neighbour', () => {
    /** Sea on the left, forest on the right, and no sand authored anywhere. */
    function seaAndWood() {
        const grid = new Array(LATTICE_SIZE * LATTICE_SIZE);
        for (let sy = 0; sy < LATTICE_SIZE; sy++) {
            for (let sx = 0; sx < LATTICE_SIZE; sx++) {
                grid[sy * LATTICE_SIZE + sx] =
                    sx < LATTICE_SIZE / 2 ? 'ocean' : 'forest';
            }
        }
        return grid;
    }

    it('puts sand between water and land that was never authored', () => {
        const { palette, fringes } = resolveArtPixels(seaAndWood(), 5);
        expect(palette).toContain('shore');
        expect(fringes.map(f => f.terrainId)).toEqual(['shore']);
    });

    it('⭐ leaves water touching nothing but sand', () => {
        // The guarantee the owner asked for: water never meets grass directly.
        const { size, palette, at } = resolveArtPixels(seaAndWood(), 5);
        const ocean = palette.indexOf('ocean');
        const shore = palette.indexOf('shore');
        for (let y = 1; y < size - 1; y++) {
            for (let x = 1; x < size - 1; x++) {
                const i = y * size + x;
                if (at[i] !== ocean) continue;
                for (const j of [i - 1, i + 1, i - size, i + size]) {
                    if (at[j] === ocean || at[j] < 0) continue;
                    expect(palette[at[j]], `water touching ${palette[at[j]]}`).toBe(palette[shore]);
                }
            }
        }
        expect(shore).toBeGreaterThanOrEqual(0);
    });

    it('never eats into the water itself', () => {
        const plain = resolveArtPixels(seaAndWood(), 5, false);
        const fringed = resolveArtPixels(seaAndWood(), 5);
        const oceanBefore = plain.palette.indexOf('ocean');
        const oceanAfter = fringed.palette.indexOf('ocean');
        let before = 0;
        let after = 0;
        for (let i = 0; i < plain.at.length; i++) {
            if (plain.at[i] === oceanBefore) before++;
            if (fringed.at[i] === oceanAfter) after++;
        }
        expect(after).toBe(before);
    });

    it('does not fringe onto bare table', () => {
        const grid = new Array(LATTICE_SIZE * LATTICE_SIZE).fill(null);
        for (let sy = 0; sy < 6; sy++) {
            for (let sx = 0; sx < 6; sx++) grid[sy * LATTICE_SIZE + sx] = 'ocean';
        }
        const { at, palette, fringes } = resolveArtPixels(grid, 5);
        expect(fringes).toEqual([]);
        expect(palette).not.toContain('shore');
        expect(at.some(v => v >= 0)).toBe(true);
    });

    it('widens with the tuning slider, and zero removes the beach', () => {
        const sand = (mult) => {
            setTuning('fringeWidth', mult);
            const { at, palette } = resolveArtPixels(seaAndWood(), 5);
            const shore = palette.indexOf('shore');
            if (shore < 0) return 0;
            let n = 0;
            for (let i = 0; i < at.length; i++) if (at[i] === shore) n++;
            return n;
        };
        const normal = sand(1);
        expect(sand(0)).toBe(0);
        expect(sand(3)).toBeGreaterThan(normal);
    });

    it('can be turned off entirely, leaving the map as the strips drew it', () => {
        const withFringe = resolveArtPixels(seaAndWood(), 5);
        const without = resolveArtPixels(seaAndWood(), 5, false);
        expect(without.fringes).toEqual([]);
        expect(without.palette).not.toContain('shore');
        expect(withFringe.palette).toContain('shore');
    });
});

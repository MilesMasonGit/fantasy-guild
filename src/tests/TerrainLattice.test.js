import { describe, it, expect, afterEach } from 'vitest';
import {
    PLAN_PIXEL_U, CELL_PX, planSize, hash01, edgeAmplitude, edgeProfile, edgeStrips,
    resolveArtPixels, distanceFromSeeds
} from '../systems/board/TerrainLattice.js';
import { TERRAIN_CELL, terrainGrid } from '../systems/atlas/TerrainMap.js';
import { resetTuning } from '../config/playmatTuning.js';
import { regionGround } from '../systems/atlas/regionGround.js';
import { groundWith, regionWith, flat } from './fixtures/ground.js';

/**
 * The ground's pixel map over a Region's terrain cells: one pixel per 2 mat units, the cell
 * boundaries wiggled, the beach cut where water meets land (the beach itself is pinned in
 * `TerrainBands.test.js`).
 */

afterEach(() => resetTuning());

const SHIPPED = Object.freeze({ w: 1760, h: 1126 });
const { cols: COLS, rows: ROWS } = terrainGrid(SHIPPED);

/** Blocks of grass, rock, sand and water, a few cells each, so boundaries of every pair exist. */
const patchwork = (seed) => (c, r) =>
    ['grass', 'rock', 'sand', 'water'][Math.floor(hash01(Math.floor(c / 3), Math.floor(r / 2), seed) * 4)];

describe('The plan is laid over the cell map', () => {
    it('is one pixel per 2 mat units, 16 pixels to a terrain cell', () => {
        expect(PLAN_PIXEL_U).toBe(2);
        expect(CELL_PX).toBe(16);
        expect(CELL_PX * PLAN_PIXEL_U).toBe(TERRAIN_CELL);
    });

    it('covers the shipped mat in 880 × 563 pixels, under its 55 × 36 cells', () => {
        expect(planSize(SHIPPED)).toEqual({ width: 880, height: 563 });
        expect([COLS, ROWS]).toEqual([55, 36]);
        // The last row of cells runs past the mat's edge; the plan stops at the edge.
        expect(COLS * CELL_PX).toBeGreaterThanOrEqual(880);
        expect(ROWS * CELL_PX).toBeGreaterThanOrEqual(563);
    });
});

describe('Stable noise', () => {
    it('is in [0, 1) and the same every time', () => {
        for (let i = 0; i < 300; i++) {
            const v = hash01(i, i * 7, 99);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
            expect(hash01(i, i * 7, 99)).toBe(v);
        }
    });
});

describe('Edge frontiers', () => {
    it('gives one displacement per pixel along a cell side, all within the amplitude', () => {
        for (const axis of ['v', 'h']) {
            const profile = edgeProfile(3, 4, axis, 99);
            expect(profile).toHaveLength(CELL_PX);
            for (const value of profile) expect(Math.abs(value)).toBeLessThanOrEqual(edgeAmplitude());
        }
    });

    it('keeps the swing under half a cell, so two boundaries of one cell never cross', () => {
        expect(edgeAmplitude()).toBeLessThan(CELL_PX / 2);
    });

    it('⭐ has no step at a junction: two neighbouring boundaries meet at one depth', () => {
        // The junction contract, re-based from the 29 × 29 lattice onto the Region's 55 × 36 cells.
        // Both segments meeting at a junction read the same hash of it, so they agree exactly; a
        // tolerance here would hide a visible 1-pixel step in the coastline.
        const steps = [];
        let junctions = 0;
        for (const seed of [0, 1, 7, 12345, 99999]) {
            for (let cy = 0; cy < ROWS - 1; cy++) {
                for (let cx = 0; cx < COLS - 1; cx++) {
                    const down = edgeProfile(cx, cy, 'v', seed);
                    const nextDown = edgeProfile(cx, cy + 1, 'v', seed);
                    if (down[CELL_PX - 1] !== nextDown[0]) steps.push(`v ${cx},${cy} seed ${seed}`);
                    const across = edgeProfile(cx, cy, 'h', seed);
                    const nextAcross = edgeProfile(cx + 1, cy, 'h', seed);
                    if (across[CELL_PX - 1] !== nextAcross[0]) steps.push(`h ${cx},${cy} seed ${seed}`);
                    junctions += 2;
                }
            }
        }
        expect(junctions).toBe(5 * 2 * (COLS - 1) * (ROWS - 1));
        expect(steps.slice(0, 5), `${steps.length} junctions step`).toEqual([]);
    });

    it('⭐ uses the whole amplitude, so the coast really wanders', () => {
        const seen = new Set();
        for (let cy = 0; cy < ROWS - 1; cy++) {
            for (const v of edgeProfile(5, cy, 'v', 4242)) seen.add(v);
            for (const v of edgeProfile(cy, 5, 'h', 4242)) seen.add(v);
        }
        expect(Math.min(...seen)).toBe(-edgeAmplitude());
        expect(Math.max(...seen)).toBe(edgeAmplitude());
        expect(seen.size).toBeGreaterThanOrEqual(edgeAmplitude() + 2);
    });

    it('does not give every boundary the same frontier', () => {
        const shapes = new Set();
        for (let cy = 0; cy < ROWS - 1; cy++) shapes.add(edgeProfile(5, cy, 'v', 4242).join(','));
        expect(shapes.size).toBeGreaterThan(ROWS / 2);
    });

    it('is stable, differs between seeds, and keeps the two axes independent', () => {
        expect(edgeProfile(3, 4, 'v', 77)).toEqual(edgeProfile(3, 4, 'v', 77));
        expect(edgeProfile(3, 4, 'v', 77)).not.toEqual(edgeProfile(3, 4, 'v', 78));
        expect(edgeProfile(3, 4, 'v', 77)).not.toEqual(edgeProfile(3, 4, 'h', 77));
    });
});

describe('⚠️ Edge strips', () => {
    const strips = (axis) => edgeStrips(3, 4, axis, 'grass', 'sand', 4242);

    it('come only where two terrains meet', () => {
        expect(strips('v').length).toBeGreaterThan(0);
        expect(edgeStrips(3, 4, 'v', 'grass', 'grass', 4242)).toEqual([]);
    });

    it('⭐ every strip lies inside the cell it is painted into', () => {
        const outside = [];
        let strips = 0;
        for (const axis of ['v', 'h']) {
            for (let cy = 0; cy < ROWS - 1; cy++) {
                for (let cx = 0; cx < COLS - 1; cx++) {
                    for (const s of edgeStrips(cx, cy, axis, 'grass', 'sand', 7)) {
                        strips++;
                        const left = s.intoCx * CELL_PX;
                        const top = s.intoCy * CELL_PX;
                        if (s.x < left || s.y < top || s.x + s.w > left + CELL_PX || s.y + s.h > top + CELL_PX) {
                            outside.push(`${cx},${cy}${axis}`);
                        }
                    }
                }
            }
        }
        expect(strips).toBeGreaterThan(10000);
        expect(outside.slice(0, 5), `${outside.length} strips outside their cell`).toEqual([]);
    });

    it('paints into the neighbour it takes ground from, never into its own cell', () => {
        for (const axis of ['v', 'h']) {
            for (const s of strips(axis)) {
                const ownCell = s.terrainId === 'grass' ? [3, 4] : (axis === 'v' ? [4, 4] : [3, 5]);
                expect([s.intoCx, s.intoCy]).not.toEqual(ownCell);
            }
        }
    });

    it('lets each terrain take ground from the other along one boundary', () => {
        const seen = new Set();
        for (let cy = 0; cy < ROWS - 1; cy++) {
            for (const s of edgeStrips(3, cy, 'v', 'grass', 'sand', 99)) seen.add(s.terrainId);
        }
        expect([...seen].sort()).toEqual(['grass', 'sand']);
    });
});

describe('⭐ The pixel map', () => {
    it('covers the plan, with the stored map\'s legend as its palette', () => {
        const ground = groundWith(20, 12, patchwork(3));
        const pixels = resolveArtPixels(ground, false);
        expect([pixels.width, pixels.height]).toEqual([20 * CELL_PX, 12 * CELL_PX]);
        expect(pixels.at.length).toBe(pixels.width * pixels.height);
        expect(pixels.palette.slice(0, 4)).toEqual(['grass', 'rock', 'sand', 'water']);
    });

    it('stops at the mat\'s edge where the last row of cells runs past it', () => {
        const ground = regionGround(regionWith(COLS, ROWS, patchwork(4)), SHIPPED);
        const pixels = resolveArtPixels(ground);
        expect([pixels.width, pixels.height]).toEqual([880, 563]);
    });

    it('⭐ every cell\'s pixels are its terrain except within the edge swing of a boundary', () => {
        // Without the beach, the only thing that moves ground across a cell line is the wiggled
        // edge: a pixel that is not its cell's terrain is within the swing of a side whose
        // neighbour has that terrain.
        const swing = edgeAmplitude();
        for (const seed of [1, 2, 3]) {
            const cols = 20;
            const rows = 12;
            const fill = patchwork(seed);
            const ground = groundWith(cols, rows, fill, { seed });
            const { width, palette, at } = resolveArtPixels(ground, false);
            const cellAt = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows ? null : fill(c, r));
            let moved = 0;
            for (let i = 0; i < at.length; i++) {
                const x = i % width;
                const y = (i - x) / width;
                const cx = Math.floor(x / CELL_PX);
                const cy = Math.floor(y / CELL_PX);
                const got = palette[at[i]];
                if (got === fill(cx, cy)) continue;
                moved++;
                const lx = x - cx * CELL_PX;
                const ly = y - cy * CELL_PX;
                const fromSide = (lx < swing && cellAt(cx - 1, cy) === got)
                    || (CELL_PX - 1 - lx < swing && cellAt(cx + 1, cy) === got)
                    || (ly < swing && cellAt(cx, cy - 1) === got)
                    || (CELL_PX - 1 - ly < swing && cellAt(cx, cy + 1) === got);
                expect(fromSide, `pixel ${x},${y} is ${got} in a ${fill(cx, cy)} cell`).toBe(true);
            }
            expect(moved, 'the edges never wiggled').toBeGreaterThan(100);
        }
    });

    it('agrees with the strips, which are the edge geometry', () => {
        const fill = patchwork(9);
        const ground = groundWith(20, 12, fill, { seed: 9 });
        const { width, height, palette, at } = resolveArtPixels(ground, false);
        let checked = 0;
        for (let cy = 0; cy < 12; cy++) {
            for (let cx = 0; cx < 20; cx++) {
                for (const axis of ['v', 'h']) {
                    const nx = axis === 'v' ? cx + 1 : cx;
                    const ny = axis === 'v' ? cy : cy + 1;
                    if (nx >= 20 || ny >= 12) continue;
                    for (const s of edgeStrips(cx, cy, axis, fill(cx, cy), fill(nx, ny), 9)) {
                        for (let y = s.y; y < s.y + s.h; y++) {
                            for (let x = s.x; x < s.x + s.w; x++) {
                                if (x >= width || y >= height) continue;
                                // A later strip at a corner may paint over an earlier one; the
                                // pixel is then one of the two terrains meeting there.
                                expect([fill(cx, cy), fill(nx, ny), ...cornerTerrains(fill, cx, cy, 20, 12)])
                                    .toContain(palette[at[y * width + x]]);
                                checked++;
                            }
                        }
                    }
                }
            }
        }
        expect(checked).toBeGreaterThan(100);
    });

    it('is one terrain everywhere on a ground of one terrain', () => {
        const { palette, at } = resolveArtPixels(groundWith(10, 6, flat('rock')));
        expect(new Set(Array.from(at, i => palette[i]))).toEqual(new Set(['rock']));
    });
});

/** The terrains of the cells round a corner a strip may share with another boundary's strip. */
function cornerTerrains(fill, cx, cy, cols, rows) {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const c = cx + dx;
            const r = cy + dy;
            if (c >= 0 && r >= 0 && c < cols && r < rows) out.push(fill(c, r));
        }
    }
    return out;
}

describe('Distances', () => {
    /** The full two-pass transform, as a reference for the bounded walk. */
    const full = (seeds, w, h) => distanceFromSeeds(seeds, w, h);

    it('⭐ the bounded walk agrees with the full transform inside its bound', () => {
        // The walk starts only from seeds on the edge of their region (an interior seed is never
        // the last seed on a shortest path), which is what keeps it cheap on a mostly-land map.
        // Checked with few seeds and with mostly seeds, the two ways it finds the edge.
        const w = 37;
        const h = 23;
        for (const share of [0.08, 0.5, 0.92]) {
            const seeds = new Uint8Array(w * h);
            for (let i = 0; i < seeds.length; i++) {
                seeds[i] = hash01(Math.floor((i % w) / 4), Math.floor(i / w / 3), 31) < share ? 1 : 0;
            }
            const limit = 18;
            const bounded = distanceFromSeeds(seeds, w, h, limit);
            const reference = full(seeds, w, h);
            for (let i = 0; i < seeds.length; i++) {
                if (reference[i] < limit) expect(bounded[i], `pixel ${i} at share ${share}`).toBe(reference[i]);
                else expect(bounded[i]).toBeGreaterThanOrEqual(limit);
            }
        }
    });

    it('measures 3 a side step and 4 a diagonal one', () => {
        const seeds = new Uint8Array(5 * 5);
        seeds[12] = 1;
        const d = distanceFromSeeds(seeds, 5, 5, 30);
        expect([d[12], d[13], d[18], d[14], d[24]]).toEqual([0, 3, 4, 6, 8]);
    });
});

import { describe, it, expect, afterEach } from 'vitest';
import { propsForGround } from '../systems/board/TerrainProps.js';
import { resolveArtPixels, CELL_PX } from '../systems/board/TerrainLattice.js';
import { LOOKS, PROP_PX, PROP_SHEETS, PROP_SHEET_CELLS, propsOf } from '../config/registries/terrainRegistry.js';
import { setTuning, resetTuning } from '../config/playmatTuning.js';
import { groundWith, flat } from './fixtures/ground.js';

/**
 * Scatter: small flat bits (L-6 A) cut from the owner's 4 × 4 prop sheets, one prop pixel to a
 * ground pixel, seeded and scattered, never on a lattice, never standing off its own ground.
 * Data, not drawing, so it can be asserted on.
 */

afterEach(() => resetTuning());

const lookGround = (lookId, seed = 5, cols = 40, rows = 24) => {
    const terrain = LOOKS[lookId].terrain;
    const biomes = lookId === 'meadow' ? null : { main: lookId, terrains: { [lookId]: terrain } };
    return groundWith(cols, rows, flat(terrain), { seed, biomes });
};
const propsOn = (ground) => propsForGround(ground, resolveArtPixels(ground));

/** Forest down to a strip of sea on the left: the beach is cut into the forest's cells. */
const woodBySea = (seed = 11) => groundWith(30, 16, (c) => (c < 4 ? 'water' : 'grass'), { seed });

describe('Scatter grows only where a look asks for it', () => {
    it('scatters on the meadow, the forest, the mountain and the coast; never on the sea', () => {
        for (const id of ['meadow', 'forest', 'mountain', 'coast']) {
            expect(propsOn(lookGround(id)).length, id).toBeGreaterThan(0);
        }
        expect(propsOf('sea')).toBeNull();
        expect(propsOn(lookGround('sea'))).toEqual([]);
    });

    it('cuts every prop from a real sheet: a cell of its 4 × 4 grid', () => {
        for (const id of ['meadow', 'forest', 'mountain', 'coast']) {
            const allowed = propsOf(id).props.map(p => p.sheet);
            for (const p of propsOn(lookGround(id))) {
                expect(PROP_SHEETS).toContain(p.sheet);
                expect(allowed).toContain(p.sheet);
                expect(p.index).toBeGreaterThanOrEqual(0);
                expect(p.index).toBeLessThan(PROP_SHEET_CELLS * PROP_SHEET_CELLS);
                expect(Number.isInteger(p.index)).toBe(true);
            }
        }
    });

    it('uses every sheet a look names, and many cells of them', () => {
        const props = propsOn(lookGround('forest'));
        expect(new Set(props.map(p => p.sheet)).size).toBe(propsOf('forest').props.length);
        expect(new Set(props.map(p => `${p.sheet}:${p.index}`)).size).toBeGreaterThan(16);
    });

    it('is thicker in the forest than on the meadow, and follows the density slider', () => {
        const meadow = propsOn(lookGround('meadow')).length;
        expect(propsOn(lookGround('forest')).length).toBeGreaterThan(meadow * 1.3);
        setTuning('propDensity', 0);
        expect(propsOn(lookGround('meadow'))).toEqual([]);
        setTuning('propDensity', 3);
        expect(propsOn(lookGround('meadow')).length).toBeGreaterThan(meadow * 2);
    });
});

describe('⭐ Scattered, not planted on a lattice', () => {
    it('puts props at many places within their cells', () => {
        const spots = new Set(propsOn(lookGround('forest')).map(p => `${p.footX % CELL_PX},${p.footY % CELL_PX}`));
        expect(spots.size).toBeGreaterThan(20);
    });

    it('⭐ keeps every foot on the cell that grew it', () => {
        for (const p of propsOn(lookGround('forest'))) {
            expect(p.footX).toBeGreaterThanOrEqual(p.cx * CELL_PX);
            expect(p.footX).toBeLessThan((p.cx + 1) * CELL_PX);
            expect(p.footY).toBeGreaterThanOrEqual(p.cy * CELL_PX);
            expect(p.footY).toBeLessThan((p.cy + 1) * CELL_PX);
        }
    });

    it('draws one prop pixel per ground pixel, its foot at the bottom middle, inside the mat', () => {
        const ground = lookGround('forest');
        const { width, height } = resolveArtPixels(ground);
        expect(PROP_PX).toBe(16);
        for (const p of propsOn(ground)) {
            expect(p.x).toBe(p.footX - PROP_PX / 2);
            expect(p.y).toBe(p.footY - (PROP_PX - 1));
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.x + PROP_PX).toBeLessThanOrEqual(width);
            expect(p.footY).toBeLessThan(height);
        }
    });

    it('follows the scatter slider: zero plants every prop at its cell\'s middle', () => {
        setTuning('propScatter', 0);
        for (const p of propsOn(lookGround('forest'))) {
            expect(p.footX % CELL_PX).toBe(CELL_PX / 2);
            expect(p.footY % CELL_PX).toBe(CELL_PX / 2);
        }
    });
});

describe('⭐ Depth: what stands lower is drawn on top', () => {
    it('comes back to front, in a total order', () => {
        const props = propsOn(lookGround('forest'));
        for (let i = 1; i < props.length; i++) {
            const a = props[i - 1];
            const b = props[i];
            expect(a.footY < b.footY || (a.footY === b.footY && a.footX < b.footX)).toBe(true);
        }
    });
});

describe('⭐ No prop stands with its foot off its own ground or on water', () => {
    it('drops the props the beach rim took the ground from', () => {
        const ground = woodBySea();
        const pixels = resolveArtPixels(ground);
        const kept = propsForGround(ground, pixels);
        setTuning('beachWidth', 0);
        const noBeach = propsForGround(ground, resolveArtPixels(ground));
        expect(kept.length).toBeGreaterThan(0);
        expect(kept.length).toBeLessThan(noBeach.length);
    });

    it('⭐ leaves every foot, and both ends of its base, on its own look', () => {
        for (const seed of [11, 12, 13]) {
            const ground = woodBySea(seed);
            const pixels = resolveArtPixels(ground);
            for (const p of propsForGround(ground, pixels)) {
                for (const x of [p.footX - 5, p.footX, p.footX + 5]) {
                    const t = pixels.palette[pixels.at[p.footY * pixels.width + x]];
                    expect(t, `prop ${p.sheet} at ${p.footX},${p.footY}`).toBe('grass');
                    expect(ground.looks[t]).toBe(p.look);
                }
            }
        }
    });
});

describe('Stability', () => {
    it('is identical every time, and differs between seeds', () => {
        expect(propsOn(lookGround('forest', 4242))).toEqual(propsOn(lookGround('forest', 4242)));
        expect(propsOn(lookGround('forest', 1))).not.toEqual(propsOn(lookGround('forest', 2)));
    });
});

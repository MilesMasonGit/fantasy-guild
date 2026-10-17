import { describe, it, expect, afterEach } from 'vitest';
import { propsForGround, groupSizes, BLOCK_CELLS } from '../systems/board/TerrainProps.js';
import { resolveArtPixels, CELL_PX } from '../systems/board/TerrainLattice.js';
import { LOOKS, PROP_PX, PROP_SHEETS, PROP_SHEET_CELLS, propsOf } from '../config/registries/terrainRegistry.js';
import { tuning, setTuning, resetTuning } from '../config/playmatTuning.js';
import { groundWith, flat } from './fixtures/ground.js';

/**
 * Scatter: small flat bits (L-6 A) cut from the owner's 4 × 4 prop sheets, one prop pixel to a
 * ground pixel, seeded, standing in small groups of one kind with open ground between, never on a
 * lattice, never standing off its own ground. Data, not drawing, so it can be asserted on.
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

/** The same with the sea's edge halfway across a group's block, where groups stand near it. */
const woodByWideSea = (seed = 11) => groundWith(30, 16, (c) => (c < 6 ? 'water' : 'grass'), { seed });

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

    it('⭐ says which cell each foot is in, and keeps every group\'s centre inside its block', () => {
        const blockPx = BLOCK_CELLS * CELL_PX;
        const blocksX = Math.ceil(40 / BLOCK_CELLS);
        for (const p of propsOn(lookGround('forest'))) {
            expect(p.footX).toBeGreaterThanOrEqual(p.cx * CELL_PX);
            expect(p.footX).toBeLessThan((p.cx + 1) * CELL_PX);
            expect(p.footY).toBeGreaterThanOrEqual(p.cy * CELL_PX);
            expect(p.footY).toBeLessThan((p.cy + 1) * CELL_PX);
            const bx = p.group % blocksX;
            const by = Math.floor(p.group / blocksX);
            expect(Math.floor(p.gx / blockPx), `group ${p.group}`).toBe(bx);
            expect(Math.floor(p.gy / blockPx), `group ${p.group}`).toBe(by);
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

    it('follows the scatter slider: zero plants every group\'s centre at its block\'s middle', () => {
        // Rewritten when the props became groups: the slider now places a group in its block,
        // as it placed a single prop in its cell.
        setTuning('propScatter', 0);
        const blockPx = BLOCK_CELLS * CELL_PX;
        const props = propsOn(lookGround('forest'));
        expect(props.length).toBeGreaterThan(0);
        for (const p of props) {
            expect(p.gx % blockPx).toBe(blockPx / 2);
            expect(p.gy % blockPx).toBe(blockPx / 2);
        }
    });
});

/** The props of each group, by group. */
const byGroup = (props) => {
    const out = new Map();
    for (const p of props) {
        if (!out.has(p.group)) out.set(p.group, []);
        out.get(p.group).push(p);
    }
    return [...out.values()];
};

describe('⭐ Props stand in groups of one kind, with open ground between', () => {
    it('⭐ gathers half the group size up to the group size, all from one row of one sheet', () => {
        const groups = byGroup(propsOn(lookGround('forest')));
        const { least, most } = groupSizes();
        expect([least, most]).toEqual([3, 6]);
        expect(groups.length).toBeGreaterThan(10);
        // Only the mat's edge can cut a group short on ground of one look.
        let whole = 0;
        for (const members of groups) {
            expect(members.length).toBeLessThanOrEqual(most);
            if (members.length >= least) whole++;
            expect(new Set(members.map(p => p.sheet)).size).toBe(1);
            expect(new Set(members.map(p => Math.floor(p.index / PROP_SHEET_CELLS))).size).toBe(1);
        }
        expect(whole / groups.length).toBeGreaterThan(0.8);
    });

    it('⭐ stands every member near its group\'s centre, and leaves most of the ground open', () => {
        const ground = lookGround('meadow');
        const props = propsOn(ground);
        const spread = tuning('propGroupSpread') / 2;
        const reach = spread * Math.sqrt(groupSizes().most) + spread;
        for (const p of props) {
            expect(Math.hypot(p.footX - p.gx, p.footY - p.gy), `prop of group ${p.group}`).toBeLessThanOrEqual(reach + 1);
        }
        // Open ground: most blocks (a Token square each) have no group at all.
        const blocks = Math.ceil(40 / BLOCK_CELLS) * Math.ceil(24 / BLOCK_CELLS);
        expect(byGroup(props).length / blocks).toBeLessThan(0.5);
    });

    it('carries about as many props as the look\'s density says, gathered', () => {
        for (const id of ['meadow', 'forest']) {
            let got = 0;
            let cells = 0;
            for (const seed of [1, 2, 3, 4, 5, 6]) {
                got += propsOn(lookGround(id, seed)).length;
                cells += 40 * 24;
            }
            const asked = propsOf(id).density * cells;
            expect(got, `${id}: asked ${asked}`).toBeGreaterThan(asked * 0.6);
            expect(got, `${id}: asked ${asked}`).toBeLessThan(asked * 1.3);
        }
    });

    it('follows the group size slider: 1 scatters singly, more gathers more to a group', () => {
        setTuning('propGroupSize', 1);
        const singles = byGroup(propsOn(lookGround('forest')));
        expect(singles.every(members => members.length === 1)).toBe(true);
        setTuning('propGroupSize', 8);
        const big = byGroup(propsOn(lookGround('forest')));
        const mean = big.reduce((n, m) => n + m.length, 0) / big.length;
        expect(mean).toBeGreaterThan(5);
    });

    it('follows the spread slider: wider groups stand further from their centres', () => {
        const meanReach = () => {
            const props = propsOn(lookGround('forest'));
            return props.reduce((n, p) => n + Math.hypot(p.footX - p.gx, p.footY - p.gy), 0) / props.length;
        };
        setTuning('propGroupSpread', 6);
        const tight = meanReach();
        setTuning('propGroupSpread', 24);
        expect(meanReach()).toBeGreaterThan(tight * 2);
    });

    it('⭐ grows a group only from its own ground: never from a beach cut into a forest\'s cells', () => {
        for (const seed of [11, 12, 13, 14]) {
            const ground = woodByWideSea(seed);
            const pixels = resolveArtPixels(ground);
            for (const p of propsForGround(ground, pixels)) {
                const t = pixels.palette[pixels.at[p.gy * pixels.width + p.gx]];
                expect(ground.looks[t], `group at ${p.gx},${p.gy}`).toBe(p.look);
            }
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
        // Rewritten when the props became groups: the sea now stops in the middle of a group's
        // block, so groups reach the beach; summed over seeds so no one layout decides it.
        let kept = 0;
        let noBeach = 0;
        for (const seed of [11, 12, 13, 14, 15, 16]) {
            const ground = woodByWideSea(seed);
            kept += propsForGround(ground, resolveArtPixels(ground)).length;
            setTuning('beachWidth', 0);
            noBeach += propsForGround(ground, resolveArtPixels(ground)).length;
            resetTuning();
        }
        expect(kept).toBeGreaterThan(0);
        expect(kept).toBeLessThan(noBeach);
    });

    it('⭐ leaves every foot, and both ends of its base, on its own look', () => {
        for (const seed of [11, 12, 13, 14, 15, 16]) {
            const ground = (seed % 2 ? woodBySea : woodByWideSea)(seed);
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

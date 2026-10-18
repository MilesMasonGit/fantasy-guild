import { describe, it, expect, vi } from 'vitest';
import { budget, ROLE } from '../systems/atlas/Budget.js';
import {
    layout, campBand, COMFORT_GAP, CAMP_BAND, NOOK_BAND, RARE_KEEP, NEAR_WATER, HIDE_BAND, AFFINITY
} from '../systems/atlas/Layout.js';
import { seedFromText } from '../systems/atlas/seededRandom.js';
import { TERRAIN, cellIndex, decodeTerrain, islandsOf, shoreDistance } from '../systems/atlas/TerrainMap.js';
import { affinityRule, kindOf } from '../systems/atlas/layoutInputs.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * The placement rounds (`place1.py`, `place2.py` in `docs/active/research/ground_gen/`):
 * natural clumps, kinds where they belong, rarer further out, and camps and treasures with a
 * reason. Each rule is measured over many seeds on the shipped mat with standard bodies; the
 * kinds come from the game's own seam (`layoutInputs.affinityRule`), which reads the words of
 * these made-up ids as it reads real ones. Every rule here failed on the layout before them,
 * except the guards (no kind to lean to, the kind table, the result's order).
 */

const MAT = Object.freeze({ w: 1760, h: 1126 });
const CROWDING = Object.freeze({ hitboxPct: 80, overlapPct: 40 });
const ART = 64;
const options = (seed, extra = {}) => ({ seed, mat: MAT, crowding: CROWDING, artRadius: () => ART, affinity: affinityRule(), ...extra });
const SEEDS = Array.from({ length: 24 }, (_, i) => seedFromText(`place-${i}`));

const base = (id, points, nodes, extra = {}) => ({ id, kind: 'base', biome: id, points, nodes, ...extra });
const mod = (id, ...effects) => ({ id, kind: 'modifier', effects });
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
const share = (list, test) => list.filter(test).length / list.length;

/** Each node's distance to its nearest other node. */
const nearest = (nodes) => nodes.map(a => Math.sqrt(Math.min(...nodes.filter(b => b !== a).map(b => d2(a, b)))));

/** Groups of nodes chained within `link` of each other. */
function clusters(nodes, link) {
    const seen = new Set();
    const out = [];
    for (const n of nodes) {
        if (seen.has(n)) continue;
        const group = [n];
        seen.add(n);
        for (let k = 0; k < group.length; k++) {
            for (const m of nodes) {
                if (!seen.has(m) && d2(group[k], m) <= link * link) {
                    seen.add(m);
                    group.push(m);
                }
            }
        }
        out.push(group);
    }
    return out;
}

/** The stored ground read back: its cells, which are water, and the islands the water surrounds. */
function groundOfResult(result) {
    const map = decodeTerrain(result.terrain);
    const wet = map.legend.indexOf(TERRAIN.WATER);
    const water = map.cells.map(k => (k === wet ? 1 : 0));
    const cellOf = (p) => cellIndex(map, p.x, p.y, map.cell);
    return { map, water, cellOf, islands: islandsOf(map, water, cellOf(result.hall)) };
}

describe('natural clumps: uneven groves, tight in the middle and looser at the rim, a few alone', () => {
    const summary = budget([base('plain', 40, [{ typeId: 'oak_tree', weight: 1 }])], { cap: 128 });
    const results = SEEDS.map(seed => layout(summary, options(seed)));

    it('groves come in uneven sizes, small and large', () => {
        const sizes = results.flatMap(r => clusters(r.nodes, 1.3 * COMFORT_GAP).map(g => g.length)).filter(n => n > 1);
        // Today's layout grew one grove per eight nodes, all alike in size.
        expect(share(sizes, n => n <= 4)).toBeGreaterThan(0.25);
        expect(share(sizes, n => n >= 8)).toBeGreaterThan(0.1);
    });

    it('nodes stand tight in places and loose in others, never closer than the game allows', () => {
        const gaps = results.flatMap(r => nearest(r.nodes));
        expect(share(gaps, g => g < 0.8 * COMFORT_GAP)).toBeGreaterThan(0.02);
        expect(share(gaps, g => g > 1.2 * COMFORT_GAP)).toBeGreaterThan(0.25);
        const minGap = 2 * Math.round(ART * CROWDING.hitboxPct / 100) * (1 - CROWDING.overlapPct / 100);
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(minGap - 1e-6);
    });

    it('a grove is tighter in its middle than at its rim', () => {
        let inner = [];
        let outer = [];
        for (const r of results) {
            for (const g of clusters(r.nodes, 1.3 * COMFORT_GAP)) {
                if (g.length < 6) continue;
                const mx = mean(g.map(n => n.x));
                const my = mean(g.map(n => n.y));
                const rms = Math.sqrt(mean(g.map(n => (n.x - mx) ** 2 + (n.y - my) ** 2)));
                const near = nearest(g);
                g.forEach((n, i) => (Math.sqrt((n.x - mx) ** 2 + (n.y - my) ** 2) < 0.7 * rms ? inner : outer).push(near[i]));
            }
        }
        expect(mean(inner)).toBeLessThan(0.95 * mean(outer));
    });

    it('about one node in eight stands alone between the groves', () => {
        const alone = results.flatMap(r => nearest(r.nodes).map(g => g > 1.6 * COMFORT_GAP));
        expect(share(alone, Boolean)).toBeGreaterThan(0.04);
        expect(share(alone, Boolean)).toBeLessThan(0.2);
    });
});

describe('kinds where they belong', () => {
    it('berry bushes grow by inland water', () => {
        const summary = budget([base('meadow', 24, [{ typeId: 'oak_tree', weight: 2 }, { typeId: 'red_bush', weight: 1 }])], { cap: 128 });
        const byWater = (affinity) => {
            const flags = [];
            for (const seed of SEEDS) {
                const result = layout(summary, options(seed, { affinity }));
                const { map, water, cellOf } = groundOfResult(result);
                const dist = shoreDistance(map, water);
                for (const n of result.nodes.filter(m => m.typeId === 'red_bush')) flags.push(dist[cellOf(n)] <= NEAR_WATER + 1);
            }
            return share(flags, Boolean);
        };
        expect(byWater(affinityRule())).toBeGreaterThan(0.7);
        expect(byWater(null)).toBeLessThan(0.5);
    });

    // Distance from each `who` to the nearest `to`, averaged, with the kinds on and off.
    const meanDistance = (summary, who, to, affinity) => mean(SEEDS.flatMap(seed => {
        const result = layout(summary, options(seed, { affinity }));
        const targets = result.nodes.filter(n => n.typeId === to);
        return result.nodes.filter(n => n.typeId === who).map(n => Math.sqrt(Math.min(...targets.map(t => d2(n, t)))));
    }));

    it('stone of a grassy biome leans to the rock another biome brings', () => {
        const summary = budget([
            base('mountain', 16, [{ typeId: 'copper_ore', weight: 1 }]),
            base('yellowstone', 48, [{ typeId: 'fir_tree', weight: 2 }, { typeId: 'stone_outcrop', weight: 1 }])
        ], { cap: 128 });
        expect(summary.ground.main).toBe('yellowstone');
        expect(meanDistance(summary, 'stone_outcrop', 'copper_ore', affinityRule()))
            .toBeLessThan(0.7 * meanDistance(summary, 'stone_outcrop', 'copper_ore', null));
    });

    it('trees of a rocky biome lean to the grass another biome brings', () => {
        const summary = budget([
            base('mountain', 48, [{ typeId: 'copper_ore', weight: 2 }, { typeId: 'pine_tree', weight: 1 }]),
            base('meadow', 16, [{ typeId: 'apple_tree', weight: 1 }])
        ], { cap: 128 });
        expect(summary.ground.main).toBe('mountain');
        expect(meanDistance(summary, 'pine_tree', 'apple_tree', affinityRule()))
            .toBeLessThan(0.8 * meanDistance(summary, 'pine_tree', 'apple_tree', null));
    });

    it('a kind with nothing to lean to places exactly as with no kinds at all', () => {
        // Stone on a Region with no rock, trees on their own grass, no bushes.
        const summary = budget([base('yellowstone', 30, [{ typeId: 'fir_tree', weight: 2 }, { typeId: 'stone_outcrop', weight: 1 }])], { cap: 128 });
        for (const seed of SEEDS.slice(0, 6)) {
            const result = layout(summary, options(seed));
            expect(result.unplaced).toEqual([]);
            expect(result).toEqual(layout(summary, options(seed, { affinity: null })));
        }
    });

    it('a Token\'s kind comes from the words of its id, else of its sprite', () => {
        expect(kindOf('token_copper_ore_vein')).toBe(AFFINITY.ROCK);
        expect(kindOf('token_stone_outcrop')).toBe(AFFINITY.ROCK);
        expect(kindOf('token_quartz_deposit')).toBe(AFFINITY.ROCK);
        expect(kindOf('token_redberry_bush')).toBe(AFFINITY.WATER);
        expect(kindOf('token_oak_tree')).toBe(AFFINITY.GRASS);
        expect(kindOf('token_fir_forest')).toBe(AFFINITY.GRASS);
        expect(kindOf('token_coast')).toBeNull();
        expect(kindOf('token_goblin_camp')).toBeNull();
        registerTokenTypes({
            atlas_t_shrub: { id: 'atlas_t_shrub', name: 'Shrub', sprite: 't_bush_blue', tokenType: 'resource', size: 1, uses: 5, requiresHero: true, config: null }
        });
        expect(kindOf('atlas_t_shrub')).toBe(AFFINITY.WATER);
        // A word only counts whole: not the prototype's own properties.
        expect(kindOf('token_constructor')).toBeNull();
    });
});

describe('rarer further out', () => {
    it('a species the budget gives only one or two of, beside more common ones, grows at the mat\'s edge', () => {
        const summary = budget([base('forest', 32, [
            { typeId: 'oak_tree', weight: 20 }, { typeId: 'red_bush', weight: 10 }, { typeId: 'maple_tree', weight: 2 }
        ])], { cap: 128 });
        expect(summary.entries.find(e => e.typeId === 'maple_tree').count).toBe(2);
        for (const seed of SEEDS) {
            const maples = layout(summary, options(seed)).nodes.filter(n => n.typeId === 'maple_tree');
            expect(maples).toHaveLength(2);
            for (const m of maples) expect(campBand(m, ART, MAT), `seed ${seed}`).toBeGreaterThanOrEqual(RARE_KEEP);
        }
    });

    it('when no species is more common, none is sent to the edge', () => {
        const summary = budget([base('few', 5, [
            { typeId: 'a_tree', weight: 2 }, { typeId: 'b_tree', weight: 2 }, { typeId: 'c_tree', weight: 1 }
        ])], { cap: 128 });
        const bands = SEEDS.flatMap(seed => layout(summary, options(seed)).nodes.map(n => campBand(n, ART, MAT)));
        expect(share(bands, b => b < RARE_KEEP)).toBeGreaterThan(0.3);
    });
});

describe('camps and treasures with a reason', () => {
    const camped = (nodes) => budget([
        base('forest', 40, nodes), mod('camp', { kind: 'threat', typeId: 'camp', count: 1 })
    ], { cap: 128 });
    /** A camp's own spacing from a standard node at the comfortable gap. */
    const campGap = 1.5 * COMFORT_GAP;

    it('a camp stands in the outer band, tucked into a grove of the commonest tree wrapped round its side facing the Hall', () => {
        const summary = camped([{ typeId: 'oak_tree', weight: 6 }, { typeId: 'red_bush', weight: 2 }]);
        const inner = [];
        for (const seed of SEEDS) {
            const result = layout(summary, options(seed));
            const camp = result.nodes.find(n => n.role === ROLE.CAMP);
            const band = campBand(camp, ART, MAT);
            expect(band).toBeGreaterThanOrEqual(NOOK_BAND[0]);
            expect(band).toBeLessThanOrEqual(NOOK_BAND[1]);
            const hx = result.hall.x - camp.x;
            const hy = result.hall.y - camp.y;
            const toHall = Math.sqrt(hx * hx + hy * hy);
            const wrap = result.nodes.filter(n => n.role === ROLE.NODE && d2(n, camp) <= (1.75 * campGap) ** 2);
            expect(wrap.length, `seed ${seed}`).toBeGreaterThanOrEqual(5);
            expect(share(wrap, n => n.typeId === 'oak_tree')).toBeGreaterThan(0.85);
            // On the Hall's side of the camp (a little past square to it); another grove may stand behind.
            inner.push(share(wrap, n => ((n.x - camp.x) * hx + (n.y - camp.y) * hy) / toHall >= -20));
        }
        expect(mean(inner)).toBeGreaterThan(0.95);
        expect(Math.min(...inner)).toBeGreaterThan(0.75);
    });

    it('with no tree, the commonest species wraps the camp', () => {
        const summary = camped([{ typeId: 'copper_ore', weight: 3 }, { typeId: 'coal_ore', weight: 1 }]);
        for (const seed of SEEDS.slice(0, 8)) {
            const result = layout(summary, options(seed));
            const camp = result.nodes.find(n => n.role === ROLE.CAMP);
            expect(campBand(camp, ART, MAT)).toBeGreaterThanOrEqual(CAMP_BAND);
            const wrap = result.nodes.filter(n => n.role === ROLE.NODE && d2(n, camp) <= (1.75 * campGap) ** 2);
            expect(share(wrap, n => n.typeId === 'copper_ore')).toBeGreaterThan(0.8);
            expect(wrap.length).toBeGreaterThanOrEqual(5);
        }
    });

    it('a treasure stands on a lake\'s island when there is one, and no node takes the island', () => {
        const summary = budget([
            base('lakeland', 26, [{ typeId: 'oak_tree', weight: 2 }, { typeId: 'red_bush', weight: 1 }], { biome: 'meadow', inland: 'lake' }),
            mod('chest', { kind: 'treasure', typeId: 'chest', count: 1 })
        ], { cap: 128 });
        let isles = 0;
        for (let k = 0; k < 80; k++) {
            const result = layout(summary, options(seedFromText(`isle-${k}`)));
            const { islands, cellOf } = groundOfResult(result);
            if (!islands.some(i => i.length >= 2)) continue;
            isles++;
            const chest = result.nodes.find(n => n.role === ROLE.TREASURE);
            const isle = islands.find(i => i.includes(cellOf(chest)));
            expect(isle, `isle-${k}`).toBeDefined();
            expect(result.nodes.filter(n => n.role === ROLE.NODE && isle.includes(cellOf(n)))).toEqual([]);
        }
        expect(isles).toBeGreaterThan(5);
    });

    it('with no island, a treasure hides away from the Hall, among the groves', () => {
        const summary = budget([
            base('forest', 40, [{ typeId: 'oak_tree', weight: 6 }, { typeId: 'red_bush', weight: 2 }]),
            mod('chest', { kind: 'treasure', typeId: 'chest', count: 1 })
        ], { cap: 128 });
        const screens = [];
        for (const seed of SEEDS) {
            const result = layout(summary, options(seed));
            const chest = result.nodes.find(n => n.role === ROLE.TREASURE);
            expect(campBand(chest, ART, MAT)).toBeGreaterThanOrEqual(HIDE_BAND);
            screens.push(result.nodes.filter(n => n.role === ROLE.NODE && d2(n, chest) < 240 * 240).length);
        }
        expect(mean(screens)).toBeGreaterThan(2);
    });
});

describe('islands on the ground grid (islandsOf)', () => {
    it('finds dry land the water surrounds, a diagonal joining it, never the edge\'s or the Hall\'s', () => {
        // 7 × 6 cells: a lake with a two-cell island, a lone dry cell joined to the shore only
        // diagonally (still the shore), and dry land at the edge beyond the lake.
        const rows = [
            '.......',
            '.~~~~~.',
            '.~##~~.',
            '.~~~~#~',
            '.~~~~~~',
            '.......'
        ];
        const grid = { cols: 7, rows: 6 };
        const water = Uint8Array.from(rows.join('').split('').map(ch => (ch === '~' ? 1 : 0)));
        expect(islandsOf(grid, water, 0)).toEqual([[16, 17]]);
        // The Hall's own land is never an island.
        expect(islandsOf(grid, water, 16)).toEqual([]);
        expect(islandsOf(grid, new Uint8Array(42), 0)).toEqual([]);
    });
});

describe('the result', () => {
    it('lists every Token in budget order, whatever order it was placed in', () => {
        const summary = budget([
            // The camps' wraps are placed first, and the rare maple before the bushes.
            base('forest', 40, [{ typeId: 'oak_tree', weight: 20 }, { typeId: 'red_bush', weight: 10 }, { typeId: 'maple_tree', weight: 1 }]),
            mod('camp', { kind: 'threat', typeId: 'camp', count: 2 }),
            mod('chest', { kind: 'treasure', typeId: 'chest', count: 1 })
        ], { cap: 128 });
        const want = summary.entries.flatMap(e => Array.from({ length: e.count }, () => `${e.role}|${e.typeId}`));
        for (const seed of SEEDS.slice(0, 8)) {
            const result = layout(summary, options(seed));
            expect(result.unplaced).toEqual([]);
            expect(result.nodes.map(n => `${n.role}|${n.typeId}`)).toEqual(want);
            expect(layout(summary, options(seed))).toEqual(result);
        }
    });
});

import { describe, it, expect } from 'vitest';
import { budget, ROLE } from '../systems/atlas/Budget.js';
import { layout, HALL_CLEARING, SHORE_CELLS } from '../systems/atlas/Layout.js';
import {
    TERRAIN, DEFAULT_TERRAIN, TERRAIN_CELL, MAX_WATER_SHARE, FOLLOW_REACH,
    terrainAt, terrainGrid, carveWater, shoreDistance, encodeTerrain
} from '../systems/atlas/TerrainMap.js';
import { mulberry32, seedFromText, nextSeed } from '../systems/atlas/seededRandom.js';

/**
 * The terrain grid a generated Region stands on (owner, 2026-10-09): one terrain per cell, the
 * ground following the nodes, water where no dry-land Token may stand. Content-free: synthetic ids
 * and hand-given geometry, as in `AtlasLayout.test.js`.
 */

const MAT = Object.freeze({ w: 1760, h: 1126 });
const CROWDING = Object.freeze({ hitboxPct: 80, overlapPct: 40 });
const artRadius = () => 64;
const options = (seed, extra = {}) => ({ seed, mat: MAT, crowding: CROWDING, artRadius, ...extra });

const base = (id, points, nodes, extra = {}) => ({ id, kind: 'base', biome: id, points, nodes, ...extra });
const mod = (id, ...effects) => ({ id, kind: 'modifier', effects });

const forest = base('forest', 40, [{ typeId: 'oak', weight: 3 }, { typeId: 'berry', weight: 1 }]);
const mountain = base('mountain', 36, [{ typeId: 'copper', weight: 1 }, { typeId: 'coal', weight: 1 }]);
const coast = base('coast', 12, [{ typeId: 'fishing_spot', weight: 1 }]);
const camp = mod('camp', { kind: 'threat', typeId: 'goblin_camp', count: 2 });
const ruins = mod('ruins', { kind: 'treasure', typeId: 'ruins', count: 2 });

const SEEDS = Array.from({ length: 10 }, (_, i) => seedFromText(`terrain-${i}`));
const RECIPES = {
    'Forest': [forest, camp],
    'Forest + Mountain': [forest, mountain, camp, ruins],
    'Coast': [coast, camp, ruins],
    'Coast + Forest + Mountain': [coast, forest, mountain, camp, ruins]
};

const terrainOfBiome = (summary, biome) => summary.ground.terrains[biome] || DEFAULT_TERRAIN;
const waterShare = (map) => [...map.cells].filter(ch => map.legend[parseInt(ch, 36)] === TERRAIN.WATER).length / map.cells.length;

describe('the terrain map', () => {
    it('is the same for the same ingredients and seed, and changes with the seed', () => {
        for (const [label, slots] of Object.entries(RECIPES)) {
            const summary = budget(slots, { cap: 128 });
            const a = layout(summary, options(SEEDS[0]));
            const b = layout(summary, options(SEEDS[0]));
            expect(b.terrain).toEqual(a.terrain);
            const rerolled = layout(summary, options(nextSeed(SEEDS[0]))).terrain.cells;
            // One biome and no water is one ground, whatever the seed.
            if (label === 'Forest') expect(rerolled).toBe(a.terrain.cells);
            else expect(rerolled).not.toBe(a.terrain.cells);
        }
    });

    it('covers the mat in whole cells, one terrain each, stored compactly', () => {
        const result = layout(budget(RECIPES['Coast + Forest + Mountain'], { cap: 128 }), options(SEEDS[1]));
        const { cols, rows } = terrainGrid(MAT);
        expect(result.terrain).toMatchObject({ cell: TERRAIN_CELL, cols, rows });
        expect(cols * TERRAIN_CELL).toBeGreaterThanOrEqual(MAT.w);
        expect(rows * TERRAIN_CELL).toBeGreaterThanOrEqual(MAT.h);
        expect(result.terrain.cells).toHaveLength(cols * rows);
        expect(result.terrain.legend.slice(0, 4)).toEqual(['grass', 'rock', 'sand', 'water']);
        const used = new Set([...result.terrain.cells].map(ch => result.terrain.legend[parseInt(ch, 36)]));
        expect([...used].sort()).toEqual(['grass', 'rock', 'sand', 'water']);
    });

    it('every placed Token records its biome, and the cell under it has that biome\'s terrain', () => {
        for (const [label, slots] of Object.entries(RECIPES)) {
            const summary = budget(slots, { cap: 128 });
            for (const seed of SEEDS) {
                const result = layout(summary, options(seed));
                expect(result.unplaced, label).toEqual([]);
                for (const n of result.nodes) {
                    const want = terrainOfBiome(summary, n.biome);
                    expect(terrainAt(result.terrain, n.x, n.y), `${label}: ${n.role} ${n.typeId} (${n.biome})`).toBe(want);
                    if (n.role === ROLE.NODE) {
                        expect(n.biome).toBe(summary.entries.find(e => e.typeId === n.typeId).biome);
                    }
                }
            }
        }
    });

    it('small Tokens of two biomes packed close still each stand on their own ground', () => {
        // Packed to the game's own gap (31 u for two small bodies), a node's nearest neighbour can
        // be nearer the centre of its cell than it is. A narrow mat and a big budget force that.
        const small = () => 32;
        const narrow = { w: 760, h: 1126 };
        const summary = budget([base('forest', 1000, [{ typeId: 'sapling', weight: 1 }]), base('mountain', 1000, [{ typeId: 'pebble', weight: 1 }])], { cap: 512 });
        for (const seed of SEEDS.slice(0, 5)) {
            const result = layout(summary, options(seed, { artRadius: small, mat: narrow }));
            expect(result.nodes.length).toBeGreaterThan(200);
            for (const n of result.nodes) expect(terrainAt(result.terrain, n.x, n.y)).toBe(terrainOfBiome(summary, n.biome));
        }
    });

    it('water cells never receive a dry-land Token', () => {
        for (const label of ['Coast', 'Coast + Forest + Mountain']) {
            const summary = budget(RECIPES[label], { cap: 128 });
            for (const seed of SEEDS) {
                const result = layout(summary, options(seed));
                expect(waterShare(result.terrain)).toBeGreaterThan(0);
                for (const n of result.nodes) expect(terrainAt(result.terrain, n.x, n.y)).not.toBe(TERRAIN.WATER);
            }
        }
    });

    it('a full Region at a cap of 256 still keeps every Token off the water', () => {
        const full = base('coastal_wilds', 1000, [
            { typeId: 'fishing_spot', weight: 1 }, { typeId: 'oak', weight: 2 }, { typeId: 'copper', weight: 2 }
        ], { biome: 'coast' });
        const summary = budget([full, camp, ruins], { cap: 256 });
        for (const seed of SEEDS.slice(0, 5)) {
            const result = layout(summary, options(seed));
            expect(result.unplaced).toEqual([]);
            expect(result.nodes).toHaveLength(128);
            for (const n of result.nodes) expect(terrainAt(result.terrain, n.x, n.y)).not.toBe(TERRAIN.WATER);
        }
    });

    it('the Hall\'s clearing is always dry land', () => {
        const summary = budget(RECIPES.Coast, { cap: 128 });
        for (const seed of SEEDS) {
            const result = layout(summary, options(seed));
            for (let y = TERRAIN_CELL / 2; y < MAT.h; y += TERRAIN_CELL) {
                for (let x = TERRAIN_CELL / 2; x < MAT.w; x += TERRAIN_CELL) {
                    const d2 = (x - result.hall.x) * (x - result.hall.x) + (y - result.hall.y) * (y - result.hall.y);
                    if (d2 < HALL_CLEARING * HALL_CLEARING) expect(terrainAt(result.terrain, x, y)).not.toBe(TERRAIN.WATER);
                }
            }
        }
    });

    it('water comes only from maps that bring it, about as much as they bring', () => {
        const share = (slots) => {
            const summary = budget(slots, { cap: 128 });
            return SEEDS.map(seed => waterShare(layout(summary, options(seed)).terrain)).reduce((a, b) => a + b) / SEEDS.length;
        };
        expect(share(RECIPES.Forest)).toBe(0);
        expect(share(RECIPES['Forest + Mountain'])).toBe(0);
        const coastAlone = share(RECIPES.Coast);
        expect(coastAlone).toBeGreaterThan(0.2);
        expect(coastAlone).toBeLessThan(0.36);
        // A Coast blended with a Forest brings half the water.
        const hybrid = share([coast, forest]);
        expect(hybrid).toBeGreaterThan(coastAlone * 0.35);
        expect(hybrid).toBeLessThan(coastAlone * 0.65);
    });

    it('never floods more than the most a mat may hold', () => {
        const flood = base('flood', 10, [{ typeId: 'reed', weight: 1 }], { water: 1 });
        const result = layout(budget([flood], { cap: 128 }), options(SEEDS[2]));
        expect(waterShare(result.terrain)).toBeLessThanOrEqual(MAX_WATER_SHARE + 0.02);
    });

    it('a Coast\'s own nodes stand on the shore', () => {
        const summary = budget([coast, forest], { cap: 128 });
        for (const seed of SEEDS) {
            const result = layout(summary, options(seed));
            const { cols, rows } = result.terrain;
            const water = Uint8Array.from([...result.terrain.cells].map(ch => (result.terrain.legend[parseInt(ch, 36)] === TERRAIN.WATER ? 1 : 0)));
            const dist = shoreDistance({ cols, rows }, water);
            const spots = result.nodes.filter(n => n.typeId === 'fishing_spot');
            const near = spots.filter(n => dist[Math.floor(n.y / TERRAIN_CELL) * cols + Math.floor(n.x / TERRAIN_CELL)] <= SHORE_CELLS + 3);
            expect(near.length / spots.length).toBeGreaterThanOrEqual(0.8);
        }
    });

    it('the ground follows the nodes: a cell takes the nearest node\'s terrain in reach, else the main biome\'s', () => {
        const summary = budget(RECIPES['Forest + Mountain'], { cap: 128 });
        for (const seed of SEEDS.slice(0, 4)) {
            const result = layout(summary, options(seed));
            const nodes = result.nodes.filter(n => n.role === ROLE.NODE);
            const ownCells = new Set(nodes.map(n => `${Math.floor(n.x / TERRAIN_CELL)},${Math.floor(n.y / TERRAIN_CELL)}`));
            let followed = 0;
            for (let r = 0; r < result.terrain.rows; r++) {
                for (let c = 0; c < result.terrain.cols; c++) {
                    if (ownCells.has(`${c},${r}`)) continue;
                    const x = (c + 0.5) * TERRAIN_CELL;
                    const y = (r + 0.5) * TERRAIN_CELL;
                    let best = null;
                    let bestD = FOLLOW_REACH * FOLLOW_REACH;
                    for (const n of nodes) {
                        const d = (x - n.x) * (x - n.x) + (y - n.y) * (y - n.y);
                        if (d < bestD || (d === bestD && !best)) { best = n; bestD = d; }
                    }
                    const want = best ? terrainOfBiome(summary, best.biome) : terrainOfBiome(summary, summary.ground.main);
                    if (best) followed++;
                    expect(terrainAt(result.terrain, x, y)).toBe(want);
                }
            }
            expect(followed).toBeGreaterThan(0);
        }
    });

    describe('the terrain seam (per-Token terrain needs come later)', () => {
        it('by default lets a Token stand anywhere dry', () => {
            const seen = new Set();
            const terrainAllows = (typeId, terrain) => { seen.add(terrain); return terrain !== TERRAIN.WATER; };
            const summary = budget(RECIPES['Coast + Forest + Mountain'], { cap: 128 });
            const withSeam = layout(summary, options(SEEDS[3], { terrainAllows }));
            expect(withSeam).toEqual(layout(summary, options(SEEDS[3])));
            expect([...seen].sort()).toEqual(['grass', 'rock', 'sand', 'water']);
        });

        it('is asked with the terrain the Token would stand on, and its no is final', () => {
            const calls = [];
            const terrainAllows = (typeId, terrain) => {
                calls.push([typeId, terrain]);
                if (typeId === 'goblin_camp' && terrain === TERRAIN.ROCK) return false;
                return terrain !== TERRAIN.WATER;
            };
            const summary = budget(RECIPES['Forest + Mountain'], { cap: 128 });
            for (const seed of SEEDS.slice(0, 5)) {
                const result = layout(summary, options(seed, { terrainAllows }));
                expect(result.unplaced).toEqual([]);
                for (const n of result.nodes.filter(n => n.typeId === 'goblin_camp')) {
                    expect(terrainAt(result.terrain, n.x, n.y)).not.toBe(TERRAIN.ROCK);
                }
            }
            // A node is judged on its own biome's ground: copper on rock, oak on grass.
            expect(calls.some(([t, g]) => t === 'copper' && g === 'rock')).toBe(true);
            expect(calls.some(([t, g]) => t === 'oak' && g === 'grass')).toBe(true);
            expect(calls.some(([t, g]) => t === 'copper' && g === 'grass')).toBe(false);
        });

        it('a Token whose terrain is refused everywhere is reported, not forced', () => {
            const terrainAllows = (typeId, terrain) => typeId !== 'oak' && terrain !== TERRAIN.WATER;
            const result = layout(budget([forest], { cap: 128 }), options(SEEDS[4], { terrainAllows }));
            expect(result.unplaced.filter(u => u.typeId === 'oak')).toHaveLength(30);
            expect(result.nodes.some(n => n.typeId === 'oak')).toBe(false);
        });
    });
});

describe('TerrainMap pieces', () => {
    it('carves water along one edge, about the share asked, sparing what must stay dry', () => {
        const grid = { cols: 40, rows: 20 };
        const water = carveWater(grid, 0.25, mulberry32(5));
        const share = water.reduce((n, v) => n + v, 0) / water.length;
        expect(share).toBeGreaterThan(0.15);
        expect(share).toBeLessThan(0.35);
        const kept = carveWater(grid, 0.25, mulberry32(5), (i) => i % 2 === 0);
        expect(kept.every((v, i) => !(v && i % 2 === 0))).toBe(true);
        expect(carveWater(grid, 0, mulberry32(5)).every(v => v === 0)).toBe(true);
    });

    it('measures each cell\'s distance to the water in side steps', () => {
        const grid = { cols: 4, rows: 1 };
        expect([...shoreDistance(grid, Uint8Array.from([1, 0, 0, 0]))]).toEqual([0, 1, 2, 3]);
        expect([...shoreDistance(grid, Uint8Array.from([0, 0, 0, 0]))]).toEqual([-1, -1, -1, -1]);
    });

    it('encodes any terrain content names, and reads a point back', () => {
        const grid = { cols: 3, rows: 2 };
        const map = encodeTerrain(grid, ['grass', 'mud', 'water', 'rock', 'sand', 'mud']);
        expect(map.legend).toEqual(['grass', 'rock', 'sand', 'water', 'mud']);
        expect(map.cells).toBe('043124');
        expect(terrainAt(map, 40, 10)).toBe('mud');
        expect(terrainAt(map, 70, 40)).toBe('mud');
        expect(terrainAt(map, -5, 9999)).toBe('rock');
    });
});

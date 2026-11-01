import { describe, it, expect } from 'vitest';
import { budget } from '../systems/atlas/Budget.js';
import { layout, HALL_CLEARING } from '../systems/atlas/Layout.js';
import { layoutOptions, kindOf } from '../systems/atlas/layoutInputs.js';
import { AFFINITY } from '../systems/atlas/Layout.js';
import { planStone, readStone, sampleStone, stoneFieldAt, STONE_SHAPE } from '../systems/atlas/StoneShapes.js';
import { TERRAIN, TERRAIN_CELL, terrainAt, decodeTerrain, terrainGrid, cellCentre, allowsTerrain, needsText } from '../systems/atlas/TerrainMap.js';
import { regionGround } from '../systems/atlas/regionGround.js';
import { mulberry32 } from '../systems/atlas/seededRandom.js';
import { getLook, DEFAULT_LOOK } from '../config/registries/terrainRegistry.js';

/**
 * ⭐ Stone terrain: a feature of a Region's ground, as water is. Outcrops of bare
 * rock are made with the layout from its seed, stored with the terrain map, and the cells they
 * cover are `stone`: never on the water, never in the Hall's clearing. Ore and stone grow on it;
 * nothing else of the map's does. A budget with no Stone lays out exactly as before.
 */

const MAT = { w: 1920, h: 1040 };
const CLEAR = { x: 960, y: 520, r: HALL_CLEARING + 2 * TERRAIN_CELL };

const recipe = (extra = {}) => ({
    id: 'fixture_stone', kind: 'base', biome: 'forest', points: 24,
    nodes: [{ typeId: 'token_oak_tree', weight: 3 }, { typeId: 'token_copper_ore_vein', weight: 2 }, { typeId: 'token_redberry_bush', weight: 1 }],
    ...extra
});
const laidOut = (r, seed) => {
    const summary = budget([r], { cap: 128 });
    return { summary, result: layout(summary, layoutOptions(summary, seed)) };
};
const stoneCellsOf = (terrain) => {
    const map = decodeTerrain(terrain);
    const i = map.legend.indexOf(TERRAIN.STONE);
    const out = [];
    if (i < 0) return out;
    map.cells.forEach((v, k) => { if (v === i) out.push(k); });
    return out;
};

describe('the Stone\'s shapes', () => {
    it('none asked, none made, and nothing drawn from the generator', () => {
        let draws = 0;
        const random = () => { draws++; return 0.5; };
        expect(planStone({ outcrops: 0, ridge: false }, random, MAT, CLEAR)).toBeNull();
        expect(planStone(null, random, MAT, CLEAR)).toBeNull();
        expect(draws).toBe(0);
    });

    it('outcrops keep clear of the Hall and of each other; the same seed makes the same', () => {
        const a = planStone({ outcrops: 5 }, mulberry32(7), MAT, CLEAR);
        const b = planStone({ outcrops: 5 }, mulberry32(7), MAT, CLEAR);
        expect(a).toEqual(b);
        expect(a.shapes.length).toBeGreaterThanOrEqual(3);
        for (const s of a.shapes) {
            expect(s.k).toBe(STONE_SHAPE.OUTCROP);
            expect(Math.hypot(s.x - CLEAR.x, s.y - CLEAR.y)).toBeGreaterThan(CLEAR.r + s.rx);
        }
        const stone = readStone(a);
        expect(stoneFieldAt(stone, CLEAR.x, CLEAR.y)).toBeLessThan(0);
        expect(stoneFieldAt(stone, a.shapes[0].x, a.shapes[0].y)).toBeGreaterThan(0);
    });

    it('a ridge crosses the whole mat and misses the Hall', () => {
        for (let seed = 1; seed <= 20; seed++) {
            const record = planStone({ ridge: true }, mulberry32(seed), MAT, CLEAR);
            const ridge = record.shapes[0];
            expect(ridge.k).toBe(STONE_SHAPE.RIDGE);
            const grid = terrainGrid(MAT);
            const cells = sampleStone(readStone(record), grid, TERRAIN_CELL);
            expect(cells.reduce((n, v) => n + v, 0)).toBeGreaterThan(Math.min(grid.cols, grid.rows));
            const hall = Math.floor(CLEAR.y / TERRAIN_CELL) * grid.cols + Math.floor(CLEAR.x / TERRAIN_CELL);
            expect(cells[hall]).toBe(0);
        }
    });

    it('a stored record that is not one reads as none', () => {
        expect(readStone(null)).toBeNull();
        expect(readStone({ v: 99, shapes: [] })).toBeNull();
        expect(readStone({ v: 1, salt: 3, shapes: [{ k: 'outcrop', x: 1, y: 1, rx: 0, ry: 5 }] }).shapes).toEqual([]);
    });
});

describe('⭐ a layout with Stone', () => {
    it('⭐ marks Stone cells, never on the water nor in the Hall\'s clearing, and stores the outcrops', () => {
        for (const seed of [1, 2, 3, 4, 5]) {
            const { result } = laidOut(recipe({ stone: { outcrops: 4 } }), seed);
            const stone = stoneCellsOf(result.terrain);
            expect(stone.length, `seed ${seed}`).toBeGreaterThan(10);
            expect(result.terrain.stone.shapes.length).toBeGreaterThan(0);
            expect(result.terrain.legend).toContain(TERRAIN.STONE);
            const grid = { cols: result.terrain.cols, rows: result.terrain.rows };
            for (const i of stone) {
                const c = cellCentre(grid, i);
                expect(Math.hypot(c.x - CLEAR.x, c.y - CLEAR.y)).toBeGreaterThanOrEqual(HALL_CLEARING);
            }
            expect(result.unplaced).toEqual([]);
        }
    });

    it('⭐ only ore and stone grow on it, and they lean to it', () => {
        let onStone = 0;
        let rockNodes = 0;
        for (const seed of [11, 12, 13, 14, 15, 16]) {
            const { result } = laidOut(recipe({ points: 40, stone: { outcrops: 10, ridge: true } }), seed);
            for (const n of result.nodes) {
                const ground = terrainAt(result.terrain, n.x, n.y);
                if (kindOf(n.typeId) === AFFINITY.ROCK) {
                    rockNodes++;
                    if (ground === TERRAIN.STONE) onStone++;
                } else {
                    expect(ground, `${seed} ${n.typeId}`).not.toBe(TERRAIN.STONE);
                }
            }
        }
        expect(onStone / rockNodes).toBeGreaterThan(0.5);
    });

    it('⭐ a budget with no Stone lays out exactly as before: none asked is none drawn', () => {
        for (const seed of [21, 22, 23]) {
            const plain = laidOut(recipe(), seed).result;
            const none = laidOut(recipe({ stone: { outcrops: 0, ridge: false } }), seed).result;
            expect(none).toEqual(plain);
            expect(plain.terrain.legend).toEqual(['grass', 'rock', 'sand', 'water']);
            expect(plain.terrain).not.toHaveProperty('stone');
            expect(budget([recipe()], { cap: 128 }).ground).not.toHaveProperty('stone');
        }
    });

    it('draws as the Stone look, a feature of any biome\'s ground', () => {
        const { summary, result } = laidOut(recipe({ stone: { outcrops: 4 } }), 31);
        const ground = regionGround({ seed: 31, ground: summary.ground, terrain: result.terrain }, MAT);
        expect(ground.terrains).toContain(TERRAIN.STONE);
        expect(ground.looks[TERRAIN.STONE]).toBe('stone');
        expect(getLook('stone').terrain).toBe(TERRAIN.STONE);
        expect(DEFAULT_LOOK[TERRAIN.STONE]).toBe('stone');
    });
});

describe('standing on Stone', () => {
    it('a Token that names Stone stands there; one that names nothing stands on any dry ground, Stone too', () => {
        expect(allowsTerrain(['stone'], TERRAIN.STONE)).toBe(true);
        expect(allowsTerrain(['stone'], TERRAIN.GRASS)).toBe(false);
        expect(allowsTerrain(['rock'], TERRAIN.STONE)).toBe(false);
        expect(allowsTerrain([], TERRAIN.STONE)).toBe(true);
        expect(needsText(['stone'])).toBe('Needs stone.');
    });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as StarterCamp from '../systems/atlas/StarterCamp.js';
import { HALL_CLEARING } from '../systems/atlas/Layout.js';
import { TERRAIN, TERRAIN_CELL, terrainAt, decodeTerrain } from '../systems/atlas/TerrainMap.js';
import { readStone, STONE_SHAPE } from '../systems/atlas/StoneShapes.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { setStarterCampForTests, resetStarterCampForTests } from '../config/registries/starterCampRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ The Starter Camp has a small patch of Stone ground (owner, 2026-11-01), so a mine that stands
 * only on Stone can still be built and moved at home: under the camp's Tokens that stand on Stone
 * (its mines), else under its mining nodes, else a step out from the Hall where nothing stands.
 * Never in the Hall's clearing, never on the pond, never under a Token that neither mines nor stands
 * on Stone.
 */

const MAT = Object.freeze({ w: 1760, h: 1126 });
const HALL = { typeId: StarterCamp.GUILD_HALL_TYPE, x: 880, y: 563 };
const TYPES = {
    token_mine: { standsOn: ['stone'] },
    token_vein: { config: { skill: 'mining' } },
    token_tree: { config: { skill: 'forestry' } }
};
const typeOf = (id) => TYPES[id] || null;
const stoneCells = (terrain) => {
    const map = decodeTerrain(terrain);
    return [...map.cells].filter(i => map.legend[i] === TERRAIN.STONE).length;
};
const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

beforeEach(() => resetMatTuning());
afterEach(() => {
    resetStarterCampForTests();
    resetMatTuning();
});

describe('⭐ the Starter Camp\'s Stone patch', () => {
    it('⭐ lies under the camp\'s mines first, small, out of the Hall\'s clearing', () => {
        const mine = { typeId: 'token_mine', x: 1360, y: 760 };
        const standing = [HALL, mine, { typeId: 'token_vein', x: 400, y: 900 }, { typeId: 'token_tree', x: 300, y: 300 }];
        const terrain = StarterCamp.starterCampTerrain(standing, MAT, 7, { typeOf });
        expect(terrainAt(terrain, mine.x, mine.y)).toBe(TERRAIN.STONE);
        expect(terrainAt(terrain, 400, 900)).not.toBe(TERRAIN.STONE);
        const n = stoneCells(terrain);
        expect(n).toBeGreaterThan(12);
        expect(n).toBeLessThan(80);
        const { shapes } = readStone(terrain.stone);
        expect(shapes).toHaveLength(1);
        expect(shapes[0].k).toBe(STONE_SHAPE.OUTCROP);
        // A mine by the clearing's edge: the patch stops at the clearing.
        const near = StarterCamp.starterCampTerrain([HALL, { typeId: 'token_mine', x: HALL.x + 260, y: HALL.y }], MAT, 7, { typeOf });
        expect(stoneCells(near)).toBeGreaterThan(4);
        for (const t of [terrain, near]) {
            for (let a = -HALL_CLEARING; a <= HALL_CLEARING; a += TERRAIN_CELL) {
                expect(terrainAt(t, HALL.x + a, HALL.y)).not.toBe(TERRAIN.STONE);
                expect(terrainAt(t, HALL.x, HALL.y + a)).not.toBe(TERRAIN.STONE);
            }
        }
    });

    it('with no mine, lies under the camp\'s mining nodes, never under a tree beside them', () => {
        const veins = [{ typeId: 'token_vein', x: 1300, y: 700 }, { typeId: 'token_vein', x: 1420, y: 700 }, { typeId: 'token_vein', x: 1360, y: 840 }];
        const tree = { typeId: 'token_tree', x: 1360, y: 760 };
        const terrain = StarterCamp.starterCampTerrain([HALL, ...veins, tree], MAT, 7, { typeOf });
        expect(stoneCells(terrain)).toBeGreaterThan(8);
        expect(terrainAt(terrain, tree.x, tree.y)).toBe(TERRAIN.GRASS);
        const [shape] = readStone(terrain.stone).shapes;
        expect(dist(shape, { x: 1360, y: 747 })).toBeLessThan(2);
    });

    it('with neither, lies a step out from the Hall where it keeps off every Token; the same for the same camp', () => {
        const standing = [HALL, { typeId: 'token_tree', x: 300, y: 300 }];
        const terrain = StarterCamp.starterCampTerrain(standing, MAT, 3, { typeOf });
        expect(stoneCells(terrain)).toBeGreaterThan(12);
        const [shape] = readStone(terrain.stone).shapes;
        expect(dist(shape, HALL)).toBeGreaterThan(HALL_CLEARING);
        expect(StarterCamp.starterCampTerrain(standing, MAT, 3, { typeOf })).toEqual(terrain);
    });

    it('never on the pond: water wins', () => {
        for (let seed = 1; seed <= 12; seed++) {
            const terrain = StarterCamp.starterCampTerrain([HALL, { typeId: 'token_mine', x: 420, y: 563 }], MAT, seed, { typeOf });
            const map = decodeTerrain(terrain);
            expect(map.water.shapes.length).toBe(1);
            const water = [...map.cells].filter(i => map.legend[i] === TERRAIN.WATER).length;
            expect(water).toBeGreaterThan(3);
        }
    });

    it('⭐ a new game opens with it under the camp\'s copper mine', () => {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        EngineBootstrap.createDefaultGameData();
        const region = Atlas.activeRegion();
        expect(stoneCells(region.terrain)).toBeGreaterThan(8);
        const mine = BoardState.tokens().find(t => t.typeId === 'token_copper_mine');
        const [shape] = readStone(region.terrain.stone).shapes;
        expect(dist(shape, mine)).toBeLessThan(TERRAIN_CELL * 6);
    });
});

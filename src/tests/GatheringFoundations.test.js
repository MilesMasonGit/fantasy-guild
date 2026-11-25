import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as Growth from '../systems/board/Growth.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as Flags from '../systems/board/Flags.js';
import * as Shop from '../systems/board/Shop.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import * as Camps from '../systems/board/Camps.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { TERRAIN, terrainGrid, encodeTerrain, terrainAt } from '../systems/atlas/TerrainMap.js';
import { createRegionRecord } from '../state/StateSchema.js';
import { problemText } from '../ui/components/board/problemMark.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Gathering foundations** (brief 860 R3; `concept_gathering_foundations.md`). Each gathering
 * skill has its own Foundation, bought like the Wood and Stone Foundations and built by a
 * Construction hero into that skill's sources:
 * - **Excavation** stands on Stone and digs a vein of the ore its Prospecting Map names, the map
 *   spent on the build;
 * - **Nursery** stands on any dry land and becomes a Forest of a chosen species, paid in its seeds,
 *   which plants and regrows its own trees (R2);
 * - **Farmland** stands on grass and becomes a Field, an Orchard or a Herb Garden;
 * - **Dock** stands on the shore and builds the Fishing Hut, the spot building and the Bait Shed.
 * A Foundation keeps its own ground once a build is chosen: an Excavation set to dig a vein (a
 * vein names no ground of its own) still stands only on Stone.
 *
 * The test Region's ground, on the shipped 1920 × 1040 mat (60 × 33 cells of 32 u):
 *
 *     cols  0–9   water
 *     cols 10–19  grass (col 10 is the shore)
 *     cols 20–39  Stone
 *     cols 40–59  grass
 *
 * Each test point lies further from every other ground than a drop is ever nudged (160 u), so a
 * refused drop is refused rather than shifted onto ground next door.
 */

const WOOD = 'gf_wood';
const MAP = 'gf_copper_map';
const SEED = 'gf_oak_seed';
const material = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wood_oak', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({
    [WOOD]: material(WOOD, 'GF Wood'),
    [MAP]: material(MAP, 'GF Copper Prospecting Map'),
    [SEED]: material(SEED, 'GF Oak Seed')
});

const sold = { price: [{ itemId: WOOD, quantity: 5 }], section: 'general' };
const foundation = (id, name, kind, standsOn) => ({
    id, name, rarity: 'common', theme: 'fixture', uses: 1, shop: sold,
    foundation: { kind, skill: 'construction' }, ...(standsOn ? { standsOn } : {})
});
const node = { rarity: 'common', theme: 'fixture', size: 1, uses: null, requiresHero: false, config: null, tokenType: 'buff', sprite: 's_nature' };
const mining = { skill: 'mining', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [{ itemId: 'item_stone', chance: 100, minQty: 1, maxQty: 1 }] };
const felling = { skill: 'forestry', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [] };

registerTokenTypes({
    gf_excavation: foundation('gf_excavation', 'GF Excavation', 'excavation', ['stone']),
    gf_nursery: foundation('gf_nursery', 'GF Nursery', 'nursery'),
    gf_farmland: foundation('gf_farmland', 'GF Farmland', 'farmland', ['grass']),
    gf_dock: foundation('gf_dock', 'GF Dock', 'dock', ['shore']),

    // A vein names no ground of its own: the map's veins stand where the map put them.
    gf_vein: {
        id: 'gf_vein', name: 'GF Copper Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', size: 1,
        uses: null, endChance: 100, requiresHero: true, staysPut: true, config: mining,
        respawn: { mode: 'refill', afterMs: 5000 }
    },

    gf_forest: {
        ...node, id: 'gf_forest', name: 'GF Oak Forest', tokenType: 'spawner',
        spawner: { spawns: [{ typeId: 'gf_tree', weight: 1 }], allowance: 2, intervalMs: 1000, upkeep: [], withinReach: true }
    },
    gf_tree: { ...node, id: 'gf_tree', name: 'GF Oak Tree', tokenType: 'resource', uses: 2, staysPut: true, requiresHero: true, config: felling, respawn: { mode: 'regrow', into: 'gf_stump' } },
    gf_stump: { ...node, id: 'gf_stump', name: 'GF Oak Stump', tokenType: 'resource', staysPut: true, grows: { into: 'gf_tree', afterMs: 20000, needsNearby: ['gf_forest'] } },

    gf_orchard: {
        ...node, id: 'gf_orchard', name: 'GF Apple Orchard', tokenType: 'spawner',
        spawner: { spawns: [{ typeId: 'gf_apple', weight: 1 }], allowance: 2, intervalMs: 1000, upkeep: [], withinReach: true }
    },
    gf_apple: { ...node, id: 'gf_apple', name: 'GF Apple Tree', tokenType: 'resource', uses: 2, staysPut: true, requiresHero: true, config: { ...felling, skill: 'farming' }, respawn: { mode: 'refill', afterMs: 30000, needsNearby: ['gf_orchard'] } },

    gf_hut: { ...node, id: 'gf_hut', name: 'GF Fishing Hut', tokenType: 'camp', camp: { skill: 'fishing' } },
    gf_bait_shed: {
        ...node, id: 'gf_bait_shed', name: 'GF Bait Shed', tokenType: 'station', requiresHero: true,
        config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 12000, xp: 0, inputs: [], outputs: [] },
        statements: [{ id: 'stm_gf_bait_shed', keyword: KEYWORD.STATION, payload: { skill: 'fishing' } }]
    },
    gf_chum: { ...node, id: 'gf_chum', name: 'GF Chum Station', spotRate: { percent: 100 } }
});

const build = (id, kind, tokenId, inputs = []) => ({
    id, name: id, levelRequirement: 1, foundationKinds: [kind], inputs,
    outputs: [{ tokenId, chance: 100, minQty: 1, maxQty: 1 }], durationMs: 2000, xp: 1
});
registerRecipePools({
    construction: [
        build('gf_dig_copper', 'excavation', 'gf_vein', [{ itemId: MAP, quantity: 1 }]),
        build('gf_plant_oaks', 'nursery', 'gf_forest', [{ itemId: SEED, quantity: 3 }]),
        build('gf_plant_orchard', 'farmland', 'gf_orchard'),
        build('gf_build_hut', 'dock', 'gf_hut'),
        build('gf_build_bait_shed', 'dock', 'gf_bait_shed'),
        build('gf_build_chum', 'dock', 'gf_chum')
    ]
});

const GRID = terrainGrid({ w: 1920, h: 1040 });
function terrainOfCell(col) {
    if (col <= 9) return TERRAIN.WATER;
    if (col >= 20 && col <= 39) return TERRAIN.STONE;
    return TERRAIN.GRASS;
}
const GROUND = encodeTerrain(GRID, Array.from({ length: GRID.cols * GRID.rows }, (_, i) => terrainOfCell(i % GRID.cols)));
/** The same mat all Stone: where an older save's Excavation stood before its Region's ground was redrawn. */
const ALL_STONE = encodeTerrain(GRID, Array.from({ length: GRID.cols * GRID.rows }, () => TERRAIN.STONE));

const SHORE = { x: 336, y: 560 };
const STONE = { x: 976, y: 560 };
const GRASS = { x: 1712, y: 560 };

function standOn(map) {
    const region = createRegionRecord('region_7');
    region.kind = 'settled';
    region.terrain = map;
    GameState.state.atlas = { activeRegionId: region.id, nextRegionNumber: 8, regions: { [region.id]: region }, seed: null };
}

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(typeId, point) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    const res = Placement.placeTokenAt(instance, point);
    expect(res.success, `${typeId} placed at ${point.x},${point.y}: ${res.reason}`).toBe(true);
    return instance;
}

/** Try to put a fresh Token of `typeId` at `point`: the placement's answer, the Token left off if refused. */
function tryPut(typeId, point) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return { ...Placement.placeTokenAt(instance, point), instance };
}

/** A Foundation at `point` set to `recipeId`, the builder ordered onto it. */
function building(typeId, recipeId, point) {
    const f = put(typeId, point);
    expect(StationRecipe.setSelectedRecipe(f, recipeId)).toBe(true);
    Orders.orderAt('h1', point);
    return f;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const onMat = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);
const at = (point) => BoardState.tokensAtPoint(point.x, point.y)[0] ?? null;

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    TileModifiers.init();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    SpawnerSystem.resetAlerts();
    Growth.resetGrowthAlerts();
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [hero('h1', { construction: 5, mining: 5, forestry: 5, farming: 5, fishing: 5 })];
    // A board the old-save pass has already seen, so it does not adopt these tests' trees.
    GameState.state.board.groveTethers = 1;
    standOn(GROUND);
});

afterEach(() => {
    TriggerSystem.teardown();
    TileModifiers.teardown();
    vi.restoreAllMocks();
});

describe('the test ground is what it says', () => {
    it('shore grass, Stone and inland grass where the points are', () => {
        expect(terrainAt(GROUND, SHORE.x, SHORE.y)).toBe(TERRAIN.GRASS);
        expect(terrainAt(GROUND, SHORE.x - 32, SHORE.y)).toBe(TERRAIN.WATER);
        expect(terrainAt(GROUND, STONE.x, STONE.y)).toBe(TERRAIN.STONE);
        expect(terrainAt(GROUND, GRASS.x, GRASS.y)).toBe(TERRAIN.GRASS);
    });
});

describe('each gathering Foundation stands on its own ground, and is refused elsewhere', () => {
    const cases = [
        ['an Excavation', 'gf_excavation', [STONE], [[GRASS, 'Needs stone.'], [SHORE, 'Needs stone.']]],
        ['a Farmland', 'gf_farmland', [GRASS, SHORE], [[STONE, 'Needs grass.']]],
        ['a Dock', 'gf_dock', [SHORE], [[GRASS, 'Needs the shore.'], [STONE, 'Needs the shore.']]],
        ['a Nursery', 'gf_nursery', [GRASS, STONE, SHORE], []]
    ];
    for (const [label, typeId, good, bad] of cases) {
        it(`${label} goes down on its ground and nowhere else`, () => {
            for (const point of good) {
                const res = tryPut(typeId, point);
                expect(res.success, `${typeId} at ${point.x}`).toBe(true);
                BoardState.removeToken(res.instance.id);
            }
            for (const [point, reason] of bad) {
                const res = tryPut(typeId, point);
                expect(res.success, `${typeId} at ${point.x}`).toBe(false);
                expect(res.reason).toBe(reason);
            }
            expect(onMat(typeId)).toHaveLength(0);
        });
    }

    it('bought at the Shop like the Wood and Stone Foundations: a drop off its ground charges nothing', () => {
        InventoryManager.addItem(WOOD, 10);
        const refused = Shop.buyAt('gf_excavation', GRASS);
        expect(refused.success).toBe(false);
        expect(refused.reason).toBe('Needs stone.');
        expect(InventoryManager.getItemCount(WOOD)).toBe(10);
        expect(onMat('gf_excavation')).toHaveLength(0);

        const bought = Shop.buyAt('gf_excavation', STONE);
        expect(bought.success).toBe(true);
        expect(InventoryManager.getItemCount(WOOD)).toBe(5);
        expect(BoardState.originOf(bought.instance)).toBe('placed');
        expect(Shop.canRefund(bought.instance.id).ok).toBe(true);
    });
});

describe('⭐ a Foundation keeps its own ground once a build is chosen', () => {
    it('an Excavation set to dig a vein (which names no ground) still may not be dragged off Stone', () => {
        const f = put('gf_excavation', STONE);
        StationRecipe.setSelectedRecipe(f, 'gf_dig_copper');
        const res = Placement.placeTokenAt(f, GRASS, { excludeId: f.id });
        expect(res.success).toBe(false);
        expect(res.reason).toBe('Needs stone.');
        expect({ x: f.x, y: f.y }).toEqual(STONE);
        expect(Placement.placeTokenAt(f, { x: STONE.x, y: STONE.y + 96 }, { excludeId: f.id }).success).toBe(true);
    });

    it('nor may a drag preview show it landing on grass', () => {
        const f = put('gf_excavation', STONE);
        StationRecipe.setSelectedRecipe(f, 'gf_dig_copper');
        expect(MatPlacement.findSpot('gf_excavation', GRASS, { excludeId: f.id, siteOf: 'gf_vein' })).toBeNull();
        const anywhere = MatPlacement.findSpotAnywhere('gf_excavation', GRASS, { excludeId: f.id, siteOf: 'gf_vein' });
        expect(terrainAt(GROUND, anywhere.x, anywhere.y)).toBe(TERRAIN.STONE);
    });

    it('a Farmland set to plant an Orchard stays on grass; a Dock set to build a Hut stays on the shore', () => {
        const farm = put('gf_farmland', GRASS);
        StationRecipe.setSelectedRecipe(farm, 'gf_plant_orchard');
        expect(Placement.placeTokenAt(farm, STONE, { excludeId: farm.id })).toMatchObject({ success: false, reason: 'Needs grass.' });

        const dock = put('gf_dock', SHORE);
        StationRecipe.setSelectedRecipe(dock, 'gf_build_hut');
        expect(Placement.placeTokenAt(dock, GRASS, { excludeId: dock.id })).toMatchObject({ success: false, reason: 'Needs the shore.' });
    });

    it('a Nursery set to plant a Forest goes anywhere dry, as a Forest does', () => {
        const f = put('gf_nursery', GRASS);
        StationRecipe.setSelectedRecipe(f, 'gf_plant_oaks');
        expect(Placement.placeTokenAt(f, STONE, { excludeId: f.id }).success).toBe(true);
        expect(Placement.placeTokenAt(f, SHORE, { excludeId: f.id }).success).toBe(true);
    });

    it('an Excavation found off Stone (its Region redrawn under it) holds its build, says why and spends nothing', () => {
        standOn(ALL_STONE);
        InventoryManager.addItem(MAP, 1);
        const f = building('gf_excavation', 'gf_dig_copper', GRASS);
        standOn(GROUND);
        expect(terrainAt(GROUND, f.x, f.y)).toBe(TERRAIN.GRASS);

        run(5000);
        expect(BoardState.getTokenById(f.id)).toBeTruthy();
        expect(onMat('gf_vein')).toHaveLength(0);
        expect(InventoryManager.getItemCount(MAP)).toBe(1);
        expect(WorkCheck.fixableReason(f.id, f).reason).toBe(ALERT.BUILD_SITE);
        expect(problemText({ kind: ALERT.BUILD_SITE }, f.id)).toBe('Needs stone.');
    });
});

describe('an Excavation digs a vein of the ore its Prospecting Map names', () => {
    it('with the map in the Bank it becomes the vein where it stands, on Stone, and the map is spent', () => {
        InventoryManager.addItem(MAP, 1);
        const f = building('gf_excavation', 'gf_dig_copper', STONE);
        run(2500);
        expect(BoardState.getTokenById(f.id)).toBeNull();
        const [vein] = onMat('gf_vein');
        expect(vein).toBeTruthy();
        expect({ x: vein.x, y: vein.y }).toEqual({ x: f.x, y: f.y });
        expect(terrainAt(GROUND, vein.x, vein.y)).toBe(TERRAIN.STONE);
        expect(InventoryManager.getItemCount(MAP)).toBe(0);
    });

    it('without the map it waits for one and builds nothing', () => {
        const f = building('gf_excavation', 'gf_dig_copper', STONE);
        run(4000);
        expect(BoardState.getTokenById(f.id)).toBeTruthy();
        expect(onMat('gf_vein')).toHaveLength(0);
        expect(WorkCheck.fixableReason(f.id, f).reason).toBe(ALERT.INPUTS);
    });

    it('the dug vein runs out by chance and refills like a map vein', () => {
        InventoryManager.addItem(MAP, 1);
        building('gf_excavation', 'gf_dig_copper', STONE);
        run(2500);
        const [vein] = onMat('gf_vein');
        // The builder stays on: a sure end (100 %) rests it after its first swing.
        for (let t = 0; t < 10000 && !Respawn.isResting(vein); t += 100) BoardRunner.tick(100);
        expect(Respawn.isResting(vein)).toBe(true);
        expect(Respawn.isComingBack(vein)).toBe(true);
        run(5100);
        expect(Respawn.isResting(BoardState.getTokenById(vein.id))).toBe(false);
    });
});

describe('a Nursery becomes a Forest of the chosen species, which owns its trees (R2)', () => {
    it('paid in its seeds, it plants its allowance in reach, every tree its own', () => {
        InventoryManager.addItem(SEED, 3);
        const f = building('gf_nursery', 'gf_plant_oaks', GRASS);
        run(2500);
        expect(BoardState.getTokenById(f.id)).toBeNull();
        expect(InventoryManager.getItemCount(SEED)).toBe(0);
        const [forest] = onMat('gf_forest');
        expect(forest).toBeTruthy();
        Flags.furl('h1');
        run(5000);
        const trees = onMat('gf_tree');
        expect(trees).toHaveLength(2);
        expect(trees.every(t => t.tether === forest.id)).toBe(true);
    });

    it('without its seeds it waits and builds nothing', () => {
        const f = building('gf_nursery', 'gf_plant_oaks', GRASS);
        run(4000);
        expect(BoardState.getTokenById(f.id)).toBeTruthy();
        expect(onMat('gf_forest')).toHaveLength(0);
        expect(WorkCheck.fixableReason(f.id, f).reason).toBe(ALERT.INPUTS);
    });

    it('its felled tree’s Stump regrows; once the Forest is demolished, its Stumps never do', () => {
        InventoryManager.addItem(SEED, 3);
        building('gf_nursery', 'gf_plant_oaks', GRASS);
        run(2500);
        const [forest] = onMat('gf_forest');
        Flags.furl('h1');
        run(5000);
        const [tree] = onMat('gf_tree');
        const where = { x: tree.x, y: tree.y };
        tree.usesRemaining = 0;
        expect(Respawn.restInstead(tree)).toBe(true);
        run(100);
        expect(at(where).typeId).toBe('gf_stump');
        expect(at(where).tether).toBe(forest.id);
        run(20100);
        expect(at(where).typeId).toBe('gf_tree');

        BoardState.removeToken(forest.id);
        TileModifiers.rebuildAround([forest]);
        const again = at(where);
        again.usesRemaining = 0;
        expect(Respawn.restInstead(again)).toBe(true);
        run(60000);
        expect(at(where).typeId).toBe('gf_stump');
    });
});

describe('a Farmland becomes an Orchard, which plants its own fruit trees', () => {
    it('on grass, an Orchard and then its allowance of fruit trees, each its own', () => {
        const f = building('gf_farmland', 'gf_plant_orchard', GRASS);
        run(2500);
        expect(BoardState.getTokenById(f.id)).toBeNull();
        const [orchard] = onMat('gf_orchard');
        expect(orchard).toBeTruthy();
        Flags.furl('h1');
        run(5000);
        const apples = onMat('gf_apple');
        expect(apples).toHaveLength(2);
        expect(apples.every(t => t.tether === orchard.id)).toBe(true);
    });
});

describe('a Dock builds Fishing’s buildings at the water’s edge', () => {
    for (const [recipeId, typeId] of [['gf_build_hut', 'gf_hut'], ['gf_build_bait_shed', 'gf_bait_shed'], ['gf_build_chum', 'gf_chum']]) {
        it(`${typeId} stands where the Dock stood, on the shore`, () => {
            const f = building('gf_dock', recipeId, SHORE);
            run(2500);
            expect(BoardState.getTokenById(f.id)).toBeNull();
            const [built] = onMat(typeId);
            expect(built).toBeTruthy();
            expect({ x: built.x, y: built.y }).toEqual({ x: f.x, y: f.y });
        });
    }

    it('the Hut it builds is a Fishing camp', () => {
        building('gf_dock', 'gf_build_hut', SHORE);
        run(2500);
        const [hut] = onMat('gf_hut');
        expect(Camps.campOfInstance(hut)).toMatchObject({ skill: 'fishing' });
    });
});

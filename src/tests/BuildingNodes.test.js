import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import { nudgeReach } from '../systems/board/MatPlacement.js';
import { STANDARD_REACH_U } from '../config/registries/reachRegistry.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import { ALERT, BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { TERRAIN, terrainGrid, encodeTerrain, terrainAt } from '../systems/atlas/TerrainMap.js';
import { createRegionRecord } from '../state/StateSchema.js';
import { recipeRowOf } from '../ui/components/board/recipeRows.js';
import { problemOf, problemText } from '../ui/components/board/problemMark.js';
import { placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Building nodes anywhere** (brief 330 W4; the owner's per-skill table in
 * `concept_world_map.md`, "Building nodes anywhere"). A node is built on a Foundation, and where
 * the Foundation stands is where the node goes:
 * - a metal mine needs its prospecting map in the recipe and stands only on Stone terrain;
 * - a quarry stands on Stone; a clay or sand pit at the water's edge (the shore);
 * - a planted Forest, a Field, an Orchard or an herb bed goes anywhere dry (Farmland);
 * - an Arcane node only within reach of an Arcane node ("Stands near");
 * - a creature's banner builds its camp, the same as the wild one;
 * - a built node otherwise runs at the same speed as a wild one.
 * A Foundation set to build a node it may not stand under holds with the reason, pays nothing and
 * never moves the node elsewhere; dragging it onto the wrong ground is refused with that reason.
 *
 * The test Region's ground, on the shipped 1920 × 1040 mat (60 × 33 cells of 32 u):
 *
 *     cols  0–9   water
 *     cols 10–19  grass (col 10 is the shore)
 *     cols 20–29  Stone
 *     cols 30–59  grass
 */

registerItems({
    bn_copper_map: { id: 'bn_copper_map', name: 'BN Copper Prospecting Map', type: 'material', stackable: true },
    bn_goblin_banner: { id: 'bn_goblin_banner', name: 'BN Goblin Banner', type: 'material', stackable: true }
});

const node = { rarity: 'common', theme: 'fixture', size: 1, uses: null, requiresHero: false, config: null, tokenType: 'buff' };
registerTokenTypes({
    bn_wood_foundation: { id: 'bn_wood_foundation', name: 'BN Wood Foundation', rarity: 'common', theme: 'fixture', uses: 1, foundation: { kind: 'wood', skill: 'construction' } },
    bn_farmland: { id: 'bn_farmland', name: 'BN Farmland', rarity: 'common', theme: 'fixture', uses: 1, foundation: { kind: 'farmland', skill: 'construction' } },
    bn_mine: { ...node, id: 'bn_mine', name: 'BN Copper Mine', standsOn: ['stone'] },
    bn_quarry: { ...node, id: 'bn_quarry', name: 'BN Quarry', standsOn: ['stone'] },
    bn_clay_pit: { ...node, id: 'bn_clay_pit', name: 'BN Clay Pit', standsOn: ['shore'] },
    bn_sapling: { ...node, id: 'bn_sapling', name: 'BN Sapling', tokenType: 'resource', uses: 1 },
    bn_forest: {
        ...node, id: 'bn_forest', name: 'BN Oak Forest', tokenType: 'spawner',
        spawner: { spawns: [{ typeId: 'bn_sapling', weight: 1 }], allowance: 3, intervalMs: 20000, upkeep: [], withinReach: true }
    },
    bn_leyline: { ...node, id: 'bn_leyline', name: 'BN Leyline' },
    bn_crystal: { ...node, id: 'bn_crystal', name: 'BN Crystal Growth', standsNear: ['bn_leyline'] },
    bn_vein: {
        id: 'bn_vein', name: 'BN Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', size: 1, uses: null,
        requiresHero: true,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [{ itemId: 'item_stone', chance: 100, minQty: 1, maxQty: 1 }] }
    }
});

const build = (id, name, kind, tokenId, inputs = []) => ({
    id, name, levelRequirement: 1, foundationKinds: [kind], inputs,
    outputs: [{ tokenId, chance: 100, minQty: 1, maxQty: 1 }], durationMs: 2000, xp: 1
});

registerRecipePools({
    construction: [
        build('bn_build_mine', 'Build Copper Mine', 'wood', 'bn_mine', [{ itemId: 'bn_copper_map', quantity: 1 }]),
        build('bn_build_quarry', 'Build Quarry', 'wood', 'bn_quarry'),
        build('bn_build_clay_pit', 'Build Clay Pit', 'wood', 'bn_clay_pit'),
        build('bn_grow_crystal', 'Grow Crystal', 'wood', 'bn_crystal'),
        build('bn_build_vein', 'Build Vein', 'wood', 'bn_vein'),
        build('bn_build_camp', 'Build Goblin Camp', 'wood', 'token_goblin_camp', [{ itemId: 'bn_goblin_banner', quantity: 1 }]),
        build('bn_plant_forest', 'Plant Oak Forest', 'farmland', 'bn_forest')
    ]
});

const GRID = terrainGrid({ w: 1920, h: 1040 });
function terrainOfCell(col) {
    if (col <= 9) return TERRAIN.WATER;
    if (col >= 20 && col <= 29) return TERRAIN.STONE;
    return TERRAIN.GRASS;
}
const MAP = encodeTerrain(GRID, Array.from({ length: GRID.cols * GRID.rows }, (_, i) => terrainOfCell(i % GRID.cols)));

const SHORE = { x: 336, y: 560 };
const STONE = { x: 816, y: 560 };
const GRASS = { x: 1456, y: 560 };

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
    expect(res.success, `${typeId} placed at ${point.x},${point.y}`).toBe(true);
    return instance;
}

/** A Foundation at `point` set to `recipeId`, a builder ordered onto it. */
function foundationBuilding(recipeId, point, typeId = 'bn_wood_foundation') {
    const f = put(typeId, point);
    expect(StationRecipe.setSelectedRecipe(f, recipeId)).toBe(true);
    Orders.orderAt('h1', point);
    return f;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

/**
 * Order the builder onto `instance` and tick until its first cycle has begun (the walk there done).
 * Returns a counter of the cycles it completes from then on.
 */
function workUntilStarted(instance) {
    Orders.orderAt('h1', { x: instance.x, y: instance.y });
    for (let t = 0; t < 30000 && !(instance.cycleElapsedMs > 0); t += 100) BoardRunner.tick(100);
    expect(instance.cycleElapsedMs).toBe(100);
    let done = 0;
    EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p?.instanceId === instance.id) done++; });
    return () => done;
}
const onMat = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);

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
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [hero('h1', { construction: 5, mining: 5 })];
    standOn(MAP);
});

describe('the test ground is what it says', () => {
    it('shore grass, Stone and inland grass where the points are', () => {
        expect(terrainAt(MAP, SHORE.x, SHORE.y)).toBe(TERRAIN.GRASS);
        expect(terrainAt(MAP, SHORE.x - 32, SHORE.y)).toBe(TERRAIN.WATER);
        expect(terrainAt(MAP, STONE.x, STONE.y)).toBe(TERRAIN.STONE);
        expect(terrainAt(MAP, GRASS.x, GRASS.y)).toBe(TERRAIN.GRASS);
    });
});

describe('a metal mine: its prospecting map, on Stone only', () => {
    it('on Stone, with the map in the Bank, the Foundation becomes the mine where it stands and the map is spent', () => {
        InventoryManager.addItem('bn_copper_map', 1);
        const f = foundationBuilding('bn_build_mine', STONE);
        run(2500);
        expect(BoardState.getTokenById(f.id)).toBeNull();
        const [mine] = onMat('bn_mine');
        expect(mine).toBeTruthy();
        expect({ x: mine.x, y: mine.y }).toEqual({ x: f.x, y: f.y });
        expect(InventoryManager.getItemCount('bn_copper_map')).toBe(0);
    });

    it('without the map it waits for it, and builds nothing', () => {
        const f = foundationBuilding('bn_build_mine', STONE);
        run(4000);
        expect(BoardState.getTokenById(f.id)).toBeTruthy();
        expect(onMat('bn_mine')).toHaveLength(0);
        expect(WorkCheck.fixableReason(f.id, f).reason).toBe(ALERT.INPUTS);
    });

    it('on grass it holds with "Needs stone.", spends nothing and never puts the mine on Stone elsewhere', () => {
        InventoryManager.addItem('bn_copper_map', 1);
        const f = foundationBuilding('bn_build_mine', GRASS);
        run(5000);
        expect(BoardState.getTokenById(f.id)).toBeTruthy();
        expect(onMat('bn_mine')).toHaveLength(0);
        expect(InventoryManager.getItemCount('bn_copper_map')).toBe(1);
        expect(WorkCheck.fixableReason(f.id, f).reason).toBe(ALERT.BUILD_SITE);
        const problem = problemOf({ alert: ALERT.BUILD_SITE });
        expect(problem?.kind).toBe(ALERT.BUILD_SITE);
        expect(problemText(problem, f.id)).toBe('Needs stone.');
    });

    it('a Foundation set to build a mine, dragged onto grass, flies back saying it needs stone', () => {
        const f = put('bn_wood_foundation', STONE);
        StationRecipe.setSelectedRecipe(f, 'bn_build_mine');
        const flashed = [];
        const off = EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, (p) => flashed.push(p));
        const res = Placement.placeTokenAt(f, GRASS, { excludeId: f.id });
        off();
        expect(res.success).toBe(false);
        expect(res.reason).toBe('Needs stone.');
        expect(flashed.map(p => [p.title, p.rulesText])).toEqual([['Drop Rejected: BN Wood Foundation', 'Needs stone.']]);
        expect({ x: f.x, y: f.y }).toEqual(STONE);

        const back = Placement.placeTokenAt(f, { x: STONE.x, y: STONE.y + 96 }, { excludeId: f.id });
        expect(back.success).toBe(true);
    });

    it('a Foundation with nothing chosen stands anywhere dry, as before', () => {
        const f = put('bn_wood_foundation', STONE);
        expect(Placement.placeTokenAt(f, GRASS, { excludeId: f.id }).success).toBe(true);
    });

    it('the recipe row says where the mine needs to stand, red off Stone', () => {
        const onGrass = put('bn_wood_foundation', GRASS);
        const onStone = put('bn_wood_foundation', STONE);
        const recipe = StationRecipe.poolFor(getTokenType('bn_wood_foundation')).find(r => r.id === 'bn_build_mine');
        const site = (f) => recipeRowOf(recipe, 1, f.id).requirements.find(r => r.key === 'site');
        expect(site(onGrass)).toMatchObject({ met: false, tip: 'Needs stone.' });
        expect(site(onStone)).toMatchObject({ met: true });
        expect(site(onStone).name).toBe('Stone');
    });
});

describe('a quarry stands on Stone', () => {
    it('builds on Stone and holds on grass', () => {
        const ok = foundationBuilding('bn_build_quarry', STONE);
        run(2500);
        expect(BoardState.getTokenById(ok.id)).toBeNull();
        expect(onMat('bn_quarry')).toHaveLength(1);

        const held = foundationBuilding('bn_build_quarry', GRASS);
        run(5000);
        expect(BoardState.getTokenById(held.id)).toBeTruthy();
        expect(onMat('bn_quarry')).toHaveLength(1);
        expect(WorkCheck.fixableReason(held.id, held).reason).toBe(ALERT.BUILD_SITE);
    });
});

describe('a clay or sand pit stands near water (the shore)', () => {
    it('builds at the water’s edge and holds inland with "Needs the shore."', () => {
        const ok = foundationBuilding('bn_build_clay_pit', SHORE);
        run(2500);
        expect(BoardState.getTokenById(ok.id)).toBeNull();
        expect(onMat('bn_clay_pit')).toHaveLength(1);

        const held = foundationBuilding('bn_build_clay_pit', GRASS);
        run(5000);
        expect(onMat('bn_clay_pit')).toHaveLength(1);
        expect(problemText({ kind: ALERT.BUILD_SITE }, held.id)).toBe('Needs the shore.');
    });
});

describe('a planted Forest goes anywhere dry (Farmland)', () => {
    for (const [label, point] of [['grass', GRASS], ['Stone', STONE], ['the shore', SHORE]]) {
        it(`builds on ${label}`, () => {
            const f = foundationBuilding('bn_plant_forest', point, 'bn_farmland');
            run(2500);
            expect(BoardState.getTokenById(f.id)).toBeNull();
            expect(onMat('bn_forest')).toHaveLength(1);
        });
    }
});

describe('an Arcane node stands within reach of an Arcane node', () => {
    it('holds with no Leyline in reach and builds beside one', () => {
        const f = foundationBuilding('bn_grow_crystal', GRASS);
        run(4000);
        expect(onMat('bn_crystal')).toHaveLength(0);
        expect(WorkCheck.fixableReason(f.id, f).reason).toBe(ALERT.BUILD_SITE);
        expect(problemText({ kind: ALERT.BUILD_SITE }, f.id)).toBe('Needs a BN Leyline nearby.');

        placeAt('bn_leyline', GRASS.x + 120, GRASS.y);
        run(3000);
        expect(BoardState.getTokenById(f.id)).toBeNull();
        expect(onMat('bn_crystal')).toHaveLength(1);
    });

    it('a built crystal may move only within reach of a Leyline', () => {
        const leyline = placeAt('bn_leyline', GRASS.x + 120, GRASS.y);
        const crystal = put('bn_crystal', GRASS);
        // Further from the Leyline than the standard reach plus the furthest a drop is nudged, so
        // no nudge can carry it into reach.
        const farGrass = { x: leyline.x - (STANDARD_REACH_U + nudgeReach() + 32), y: leyline.y };
        expect(terrainAt(MAP, farGrass.x, farGrass.y)).toBe(TERRAIN.GRASS);
        const away = Placement.placeTokenAt(crystal, farGrass, { excludeId: crystal.id });
        expect(away.success).toBe(false);
        expect(away.reason).toBe('Needs a BN Leyline nearby.');
        expect(Placement.placeTokenAt(crystal, { x: leyline.x, y: leyline.y + 120 }, { excludeId: crystal.id }).success).toBe(true);
    });

    it('a crystal dropped where no Leyline stands at all flies back with the reason', () => {
        const crystal = BoardState.createTokenInstance('bn_crystal', null);
        const res = Placement.placeTokenAt(crystal, GRASS);
        expect(res.success).toBe(false);
        expect(res.reason).toBe('Needs a BN Leyline nearby.');
    });
});

describe('a creature’s banner builds its camp, the same as the wild one', () => {
    it('spends the banner and stands a camp with the wild camp’s clock', () => {
        expect(getTokenType('token_goblin_camp')?.spawner).toBeTruthy();
        InventoryManager.addItem('bn_goblin_banner', 1);
        const f = foundationBuilding('bn_build_camp', GRASS);
        run(2500);
        const [camp] = onMat('token_goblin_camp');
        expect(camp).toBeTruthy();
        expect(camp.builtFrom).toBeTruthy();
        expect(InventoryManager.getItemCount('bn_goblin_banner')).toBe(0);
        const def = getTokenType('token_goblin_camp');
        expect(SpawnerSystem.intervalOf(def, camp)).toBe(SpawnerSystem.intervalOf(def));
        expect(BoardState.getTokenById(f.id)).toBeNull();
    });
});

describe('a built node runs at the same speed as a wild one', () => {
    it('a built Forest keeps the authored spawn interval', () => {
        const f = foundationBuilding('bn_plant_forest', GRASS, 'bn_farmland');
        run(2500);
        const [built] = onMat('bn_forest');
        const wild = placeAt('bn_forest', GRASS.x, 200);
        const def = getTokenType('bn_forest');
        expect(BoardState.getTokenById(f.id)).toBeNull();
        expect(SpawnerSystem.intervalOf(def)).toBe(20000);
        const handler = TimedChanges.HANDLERS.find(h => h.id === 'spawner');
        expect(handler.dueMs(built, def)).toBe(20000);
        expect(handler.dueMs(wild, def)).toBe(20000);
    });

    it('a built vein works on its authored cycle', () => {
        const f = foundationBuilding('bn_build_vein', STONE);
        run(2500);
        const [vein] = onMat('bn_vein');
        expect(vein?.builtFrom).toBeTruthy();
        expect(BoardState.getTokenById(f.id)).toBeNull();

        const cycles = workUntilStarted(vein);
        run(1800);
        expect(cycles()).toBe(0);
        run(200);
        expect(cycles()).toBe(1);
    });
});

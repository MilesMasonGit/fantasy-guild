import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as Growth from '../systems/board/Growth.js';
import * as Fields from '../systems/board/Fields.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { flagStatusLine } from '../ui/components/board/flagText.js';
import { idleMomentOf } from '../ui/components/board/heroSpeech.js';
import { skipHint } from '../ui/components/board/boardConstants.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * A farmer at a Field (brief 230 S4): they harvest a ripe Field cycle by cycle until its load is
 * gone; the last cycle sows it again for a seed and the farmer lets go, waiting silently for it to
 * ripen ("Waiting for Test Field", not idle), and harvests it again the moment it is ripe. Without
 * a seed the Field stops, says so, and the farmer is idle as before (nothing is on its way). An
 * area flag with two Fields works the ripe one while the other grows. A Beehive's double chance
 * reaches a Field's harvest like any work.
 */

const SEED = 'fixture_fh_seed';
const WHEAT_ITEM = 'fixture_fh_wheat';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({ [SEED]: item(SEED, 'Test Wheat Seed'), [WHEAT_ITEM]: item(WHEAT_ITEM, 'Test Wheat') });

const WHEAT = 'fh_recipe_wheat';
const SEEDY = 'fh_recipe_seedy';
registerRecipePools({
    farming: [{
        id: WHEAT, name: 'Test Wheat', levelRequirement: 1, durationMs: 1000, xp: 2, stationKinds: ['field'],
        inputs: [{ itemId: SEED, quantity: 1 }],
        outputs: [{ itemId: WHEAT_ITEM, chance: 100, minQty: 1, maxQty: 1 }],
        crop: { growMs: 20000, load: 3 }
    }, {
        // Every harvest drops a seed as well.
        id: SEEDY, name: 'Test Seedy Wheat', levelRequirement: 1, durationMs: 1000, xp: 2, stationKinds: ['field'],
        inputs: [{ itemId: SEED, quantity: 1 }],
        outputs: [{ itemId: WHEAT_ITEM, chance: 100, minQty: 1, maxQty: 1 }, { itemId: SEED, chance: 100, minQty: 1, maxQty: 1 }],
        crop: { growMs: 20000, load: 1 }
    }]
});

const harvest = { skill: 'farming', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] };
const fieldType = (id, name, extra = {}) => ({
    id, name, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_farmland', requiresHero: true,
    config: harvest, field: {}, statements: [{ id: `stm_${id}`, keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }],
    ...extra
});
registerTokenTypes({
    fh_field: fieldType('fh_field', 'Test Field'),
    fh_sickle_field: fieldType('fh_sickle_field', 'Test Sickle Field', { needsTool: { kind: 'sickle', minTier: 1 } }),
    fh_farmstead: {
        id: 'fh_farmstead', name: 'Test Farmstead', tokenType: 'camp', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_nature', requiresHero: false, config: null, camp: { skill: 'farming', reach: 320 }
    },
    fh_beehive: {
        id: 'fh_beehive', name: 'Test Beehive', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        statements: [{ id: 'stm_fh_bees', keyword: 'provides', to: { mode: 'id', value: 'fh_field' }, reach: 'nearby',
            payload: { type: EFFECT_TYPES.DOUBLE_DROP, bucket: 'flat', value: 100, category: WHEAT_ITEM } }]
    }
});

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 10, skills: out, hp: { current: 100, max: 100 } };
}

function put(typeId, x, y) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    const res = Placement.placeTokenAt(instance, { x, y });
    expect(res?.success, res?.reason).not.toBe(false);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const wheat = () => InventoryManager.getItemCount(WHEAT_ITEM) + SpriteLayer.countOnBoard(WHEAT_ITEM);
const FIELD = { x: 800, y: 500 };

beforeAll(() => { Flags.init(); TimedChanges.init(); });
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    BoardRunner.init();
    Flags.init();
    TileModifiers.clearAll();
    Growth.resetGrowthAlerts();
    GameState.state.heroes = [hero('farmer', { farming: 10 }), hero('miner', { mining: 10 })];
    GameState.state.inventory.maxSlots = 50;
});

/** A Field sown with wheat and grown ripe (one seed spent), a farmer flagged on it. */
function ripeField({ seeds = 0, typeId = 'fh_field', at = FIELD, farmer = true } = {}) {
    InventoryManager.addItem(SEED, 1 + seeds);
    const field = put(typeId, at.x, at.y);
    expect(StationRecipe.setSelectedRecipe(field, WHEAT)).toBe(true);
    run(20200);
    expect(Fields.stageOf(field)).toBe(Fields.STAGE.RIPE);
    if (farmer) Orders.orderAt('farmer', { x: at.x, y: at.y });
    return field;
}

describe('⭐ a farmer harvests the load, the last cycle sows again, and they wait for it', () => {
    it('three harvests, three wheat; sown again for a seed; the farmer waits silently, then harvests again', () => {
        const field = ripeField({ seeds: 1 });
        const cycles = [];
        const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p.instanceId === field.id) cycles.push(p.heroId); });
        run(3500);
        off();
        expect(cycles).toEqual(['farmer', 'farmer', 'farmer']);
        expect(wheat()).toBe(3);
        expect(Fields.stageOf(field)).toBe(Fields.STAGE.GROWING);
        expect(InventoryManager.getItemCount(SEED)).toBe(0);

        // Let go of the growing Field, waiting for it: not idle, nothing said.
        expect(Flags.statusOf('farmer').state).toBe('idle');
        expect(Flags.waitingOf('farmer')).toEqual({ instanceId: field.id, kind: 'node' });
        expect(flagStatusLine('farmer')).toBe('Waiting for Test Field');
        expect(BoardRunner.isHeroIdle('farmer')).toBe(false);
        expect(idleMomentOf(Flags.waitingOf('farmer'), 'Test Field')).toBeNull();
        expect(field.alert ?? null).toBeNull();
        expect(skipHint(ALERT.GROWING)).toMatch(/growing/);

        // Ripe again: harvested again at once.
        run(20000);
        expect(Fields.stageOf(field)).toBe(Fields.STAGE.RIPE);
        run(1200);
        expect(Flags.statusOf('farmer')).toMatchObject({ state: 'working', instanceId: field.id });
        expect(wheat()).toBe(4);
    });

    it('with no seed the Field stops and says so; the farmer is idle as before', () => {
        const field = ripeField({ seeds: 0 });
        run(3500);
        expect(wheat()).toBe(3);
        expect(Fields.stageOf(field)).toBe(Fields.STAGE.EMPTY);
        expect(Growth.growthAlertOf(field.id)).toEqual({ alert: ALERT.GROW_NEEDS_ITEM, needs: [SEED] });
        run(1000);
        expect(Flags.waitingOf('farmer')).toBeNull();
        expect(BoardRunner.isHeroIdle('farmer')).toBe(true);
        // A seed in the Bank: it sows, and the farmer waits for it again.
        InventoryManager.addItem(SEED, 1);
        run(1000);
        expect(Fields.stageOf(field)).toBe(Fields.STAGE.GROWING);
        expect(Flags.waitingOf('farmer')).toEqual({ instanceId: field.id, kind: 'node' });
    });

    it('the last harvest can pay with the seed it dropped itself', () => {
        InventoryManager.addItem(SEED, 1);
        const field = put('fh_field', FIELD.x, FIELD.y);
        expect(StationRecipe.setSelectedRecipe(field, SEEDY)).toBe(true);
        run(20200);
        expect(InventoryManager.getItemCount(SEED)).toBe(0);
        Orders.orderAt('farmer', { x: FIELD.x, y: FIELD.y });
        run(1200);
        expect(wheat()).toBe(1);
        expect(Fields.stageOf(field)).toBe(Fields.STAGE.GROWING);
        expect(InventoryManager.getItemCount(SEED) + SpriteLayer.countOnBoard(SEED)).toBe(0);
        expect(Growth.growthAlertOf(field.id)).toBeNull();
    });

    it('a farmer sent to a Farmstead works the ripe Field while the other grows', () => {
        const a = ripeField({ seeds: 2, farmer: false });
        const b = put('fh_field', FIELD.x + 160, FIELD.y);
        expect(StationRecipe.setSelectedRecipe(b, WHEAT)).toBe(true);
        const farmstead = put('fh_farmstead', FIELD.x + 80, FIELD.y + 160);
        expect(Orders.orderAt('farmer', { x: farmstead.x, y: farmstead.y }).success).toBe(true);
        // A is ripe, B just sown: A is harvested; then B grows ripe while A grows, and B is worked.
        run(3500);
        expect(Fields.stageOf(a)).toBe(Fields.STAGE.GROWING);
        run(17000);
        expect(Fields.stageOf(b)).toBe(Fields.STAGE.RIPE);
        run(1200);
        expect(Flags.statusOf('farmer')).toMatchObject({ state: 'working', instanceId: b.id });
    });

    // Rewritten with classless heroes: every hero holds Farming now, so the hero who does not wait
    // is one sent to a spot clear of the Field, not onto it.
    it('a hero sent to a spot beside it does not wait on it', () => {
        ripeField({ seeds: 1, farmer: false });
        Orders.orderAt('miner', { x: FIELD.x + 260, y: FIELD.y });
        run(1000);
        expect(Flags.waitingOf('miner')).toBeNull();
        expect(BoardRunner.isHeroIdle('miner')).toBe(true);
    });

    it('a Field that needs a sickle is not harvested without one, and nobody waits on it', () => {
        ripeField({ seeds: 1, typeId: 'fh_sickle_field' });
        run(2000);
        expect(wheat()).toBe(0);
        expect(Flags.statusOf('farmer').state).not.toBe('working');
    });
});

describe('supports reach a Field\'s harvest like any work', () => {
    it('a Beehive in reach (100 % double on wheat here) doubles each harvest', () => {
        put('fh_beehive', FIELD.x + 150, FIELD.y);
        TileModifiers.rebuildAll();
        ripeField({ seeds: 1 });
        run(3500);
        expect(wheat()).toBe(6);
    });
});

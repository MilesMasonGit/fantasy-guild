import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
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
import * as Fields from '../systems/board/Fields.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import * as InputCost from '../systems/board/InputCost.js';
import * as HallRules from '../systems/progression/HallRules.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { rollFraction } from '../systems/combat/CombatFormulas.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { ALERT, BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { HALL_NODE } from '../config/guildUpgrades.js';
import { resetMatTuning } from '../config/matTuning.js';
import { roundByChance, mostByChance } from '../utils/RNG.js';
import { buildRateBook } from '../../cms/src/engine/ledger/rates.js';
import { withoutShippedPerks } from './fixtures/noPerks.js';

withoutShippedPerks();

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Efficiency rounds by chance (owner, 2026-11-11, brief 590 P1b): a cycle whose Efficiency
 * (`INPUT_COST`) makes an input cost a fraction pays the whole number below or above it by chance,
 * so it averages the exact cost (10 Coal at −12 % pays 9 four times in five, 8 one time in five);
 * there is no minimum of 1 (1 Coal at −20 % is free one time in five); increases round alike. A
 * whole cost draws nothing; a check before paying asks for the cost rounded up.
 */

const COAL = 'ef_coal';
const BAR = 'ef_bar';
const SEED = 'ef_seed';
const WHEAT = 'ef_wheat';
const material = (id, name) => ({ id, name, type: 'material', stackable: true, equipSlot: '', sprite: 'i_wheat' });
registerItems({ [COAL]: material(COAL, 'Coal'), [BAR]: material(BAR, 'Bar'), [SEED]: material(SEED, 'Seed'), [WHEAT]: material(WHEAT, 'Wheat') });

registerRecipePools({
    construction: [{
        id: 'ef_build_vein', name: 'Build Vein', levelRequirement: 1, foundationKinds: ['wood'],
        inputs: [{ itemId: COAL, quantity: 3 }],
        outputs: [{ tokenId: 'ef_vein', chance: 100, minQty: 1, maxQty: 1 }], durationMs: 1000, xp: 1
    }],
    farming: [{
        id: 'ef_recipe_wheat', name: 'Wheat', levelRequirement: 1, durationMs: 1000, xp: 2, stationKinds: ['field'],
        inputs: [{ itemId: SEED, quantity: 1 }],
        outputs: [{ itemId: WHEAT, chance: 100, minQty: 1, maxQty: 1 }],
        crop: { growMs: 20000, load: 3 }
    }]
});

const forge = (id, coal) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: true,
    config: {
        skill: 'smithing', skillRequired: 1, cycleTimeMs: 1000, xp: 1,
        inputs: [{ itemId: COAL, quantity: coal }], outputs: [{ itemId: BAR, chance: 100, minQty: 1, maxQty: 1 }]
    }
});
let stm = 0;
const efficiency = (id, to, value, extra = {}) => ({
    id, name: id, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false,
    statements: [{
        id: `stm_ef_${++stm}`, keyword: 'provides', to, reach: 'nearby',
        payload: { type: EFFECT_TYPES.INPUT_COST, bucket: 'percentage', value, ...extra }
    }]
});
const keeps = (id, to, value) => ({
    id, name: id, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false,
    statements: [{ id: `stm_ef_${++stm}`, keyword: 'provides', to, reach: 'nearby', payload: { type: EFFECT_TYPES.PRESERVATION, bucket: 'flat', value } }]
});
const FORGES = { mode: 'tag', value: 'EfForge' };
registerTokenTypes({
    ef_forge_10: { ...forge('ef_forge_10', 10), tags: ['EfForge'] },
    ef_forge_1: { ...forge('ef_forge_1', 1), tags: ['EfForge'] },
    ef_forge_2: { ...forge('ef_forge_2', 2), tags: ['EfForge'] },
    ef_minus_12: efficiency('ef_minus_12', FORGES, -0.12),
    ef_minus_20: efficiency('ef_minus_20', FORGES, -0.2),
    ef_minus_50: efficiency('ef_minus_50', FORGES, -0.5),
    ef_plus_12: efficiency('ef_plus_12', FORGES, 0.12),
    ef_keep_100: keeps('ef_keep_100', FORGES, 100),
    ef_keep_0: keeps('ef_keep_0', FORGES, 0),
    ef_vein: {
        id: 'ef_vein', name: 'Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: true,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [{ itemId: COAL, chance: 100, minQty: 1, maxQty: 1 }] }
    },
    ef_foundation: { id: 'ef_foundation', name: 'Foundation', rarity: 'common', theme: 'fixture', uses: 1, foundation: { kind: 'wood', skill: 'construction' } },
    ef_field: {
        id: 'ef_field', name: 'Field', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_farmland',
        requiresHero: true, field: {},
        config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_ef_field', keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }]
    }
});

/** A Hall star, rank 1 held, giving `type` at `value` in `bucket`, guild-wide, narrowed to `category`. */
function holdStar(type, bucket, value, category) {
    registerHallSky({
        constellations: { ef: { id: 'ef', name: 'Efficiency', label: { x: 1, y: 0 } } },
        stars: {
            ef_star: {
                id: 'ef_star', constellation: 'ef', name: 'Thrift', node: { x: 0.7, y: 0 }, links: [HALL_NODE],
                ranks: [{ tier: 1, price: [], lines: [], rules: [{
                    id: 'stm_ef_star', keyword: KEYWORD.PROVIDES, chargeDelta: 0, reach: 'board', target: null, when: null, upkeep: null,
                    to: { mode: 'all', value: '' }, payload: { type, bucket, value, ...(category ? { category } : {}) }
                }] }]
            }
        }
    });
    GuildUpgradeManager.getRanks().ef_star = 1;
    GuildUpgradeManager.recompute();
}

function makeHero(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 200, max: 200 };
    for (const s of getAllSkillIds()) hero.skills[s] = { level: 60, xp: 0 };
    hero.equipment = Array(9).fill(null);
    GameState.state.heroes.push(hero);
    return hero;
}

function put(typeId, at) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    const res = Placement.placeTokenAt(instance, at);
    expect(res?.success, res?.reason).not.toBe(false);
    TileModifiers.rebuildAround([instance]);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const HERE = { x: 800, y: 500 };
const BESIDE = { x: 940, y: 500 };
const BELOW = { x: 800, y: 640 };
const made = (itemId) => InventoryManager.getItemCount(itemId) + SpriteLayer.countOnBoard(itemId);

/** A smith on `typeId` with `coal` in the Bank and `beside` next to it; records what each cycle paid. */
function forgeScene(typeId, coal, beside = null, below = null) {
    InventoryManager.addItem(COAL, coal);
    const smith = makeHero('smith');
    const f = put(typeId, HERE);
    if (beside) put(beside, BESIDE);
    if (below) put(below, BELOW);
    Orders.orderAt(smith.id, HERE);
    const paid = [];
    let owed = 0;
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.INVENTORY_UPDATED, (e) => { if (e?.itemId === COAL && e.removed) owed += e.removed; }),
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (e) => { if (e.instanceId === f.id) { paid.push(owed); owed = 0; } })
    ];
    return { f, paid, off: () => offs.forEach(off => off()) };
}

/** A fixed stream from a seed, so a long run gives the same mix every time. */
function seededRandom(seed = 4242) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

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
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    vi.restoreAllMocks();
    registerHallSky(null);
    HallRules.apply({});
});

describe('the rounding', () => {
    it('makes 8.8 whole by chance: 9 below 0.8, 8 above; a whole amount draws nothing', () => {
        expect(roundByChance(8.8, () => 0.79)).toBe(9);
        expect(roundByChance(8.8, () => 0.81)).toBe(8);
        expect(roundByChance(0.8, () => 0.9)).toBe(0);
        expect(roundByChance(0.8, () => 0.1)).toBe(1);
        const random = vi.fn(() => 0.5);
        expect(roundByChance(8, random)).toBe(8);
        // Float noise is no fraction: 10 × 0.7 is 7.000000000000001.
        expect(roundByChance(10 * 0.7, random)).toBe(7);
        expect(roundByChance(0, random)).toBe(0);
        expect(roundByChance(-2, random)).toBe(0);
        expect(random).not.toHaveBeenCalled();
    });

    it('the most it can give is the amount rounded up', () => {
        expect([8.8, 8, 10 * 0.7, 0.2, 0, -1].map(mostByChance)).toEqual([9, 8, 7, 1, 0, 0]);
    });

    it('is the same rounding a blow\'s damage takes', () => {
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.05);
        expect(rollFraction(1.1)).toBe(2);
        expect(rollFraction(3)).toBe(3);
        expect(spy).toHaveBeenCalledTimes(1);
    });
});

describe('Efficiency on a cycle', () => {
    it('10 Coal at −12 % pays 9 or 8, 8.8 on average, and every cycle makes its bar', () => {
        vi.spyOn(Math, 'random').mockImplementation(seededRandom());
        const scene = forgeScene('ef_forge_10', 3000, 'ef_minus_12');
        run(250_000);
        scene.off();
        const { paid } = scene;
        expect(paid.length).toBeGreaterThanOrEqual(200);
        expect(paid.every(n => n === 8 || n === 9)).toBe(true);
        expect(paid.filter(n => n === 8).length).toBeGreaterThan(0);
        const mean = paid.reduce((a, b) => a + b, 0) / paid.length;
        expect(mean).toBeGreaterThan(8.7);
        expect(mean).toBeLessThan(8.9);
        expect(made(BAR)).toBe(paid.length);
        expect(InputCost.exactInputQuantity(scene.f.id, 10, 'smithing')).toBeCloseTo(8.8, 10);
    });

    it('1 Coal at −20 % pays 1 or nothing, with no minimum of 1, and a free cycle still makes its bar', () => {
        vi.spyOn(Math, 'random').mockImplementation(seededRandom(77));
        const scene = forgeScene('ef_forge_1', 1000, 'ef_minus_20');
        run(200_000);
        scene.off();
        const { paid } = scene;
        expect(paid.every(n => n === 0 || n === 1)).toBe(true);
        expect(paid.filter(n => n === 0).length).toBeGreaterThan(10);
        const mean = paid.reduce((a, b) => a + b, 0) / paid.length;
        expect(mean).toBeGreaterThan(0.7);
        expect(mean).toBeLessThan(0.9);
        expect(made(BAR)).toBe(paid.length);
    });

    it('an increase rounds the same way: 10 Coal at +12 % pays 11 or 12', () => {
        vi.spyOn(Math, 'random').mockImplementation(seededRandom(5));
        const scene = forgeScene('ef_forge_10', 2000, 'ef_plus_12');
        run(100_000);
        scene.off();
        expect(scene.paid.length).toBeGreaterThan(50);
        expect(scene.paid.every(n => n === 11 || n === 12)).toBe(true);
        expect(new Set(scene.paid).size).toBe(2);
    });

    it('a whole cost draws nothing: −50 % on 2 Coal pays 1 with the very draws of no rule', () => {
        const draws = (beside) => {
            GameState.initNew();
            TileModifiers.clearAll();
            GameState.state.heroes = [];
            InventoryManager.init();
            const scene = forgeScene('ef_forge_2', 100, beside);
            const spy = vi.spyOn(Math, 'random');
            run(3200);
            const n = spy.mock.calls.length;
            spy.mockRestore();
            scene.off();
            expect(scene.paid).toHaveLength(3);
            return { n, paid: scene.paid };
        };
        const none = draws(null);
        expect(none.paid).toEqual([2, 2, 2]);
        const half = draws('ef_minus_50');
        expect(half.paid).toEqual([1, 1, 1]);
        expect(half.n).toBe(none.n);
    });

    it('a fractional cost draws once a cycle, just before it pays', () => {
        const draws = (beside) => {
            GameState.initNew();
            TileModifiers.clearAll();
            GameState.state.heroes = [];
            InventoryManager.init();
            const scene = forgeScene('ef_forge_10', 100, beside);
            const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
            run(3200);
            const n = spy.mock.calls.length;
            spy.mockRestore();
            scene.off();
            expect(scene.paid).toHaveLength(3);
            return n;
        };
        expect(draws('ef_minus_12')).toBe(draws(null) + 3);
    });
});

describe('what a cycle needs before it starts', () => {
    it('asks for the cost rounded up: 9 Coal runs a 10-Coal forge at −12 %, 8 does not', () => {
        const scene = forgeScene('ef_forge_10', 9, 'ef_minus_12');
        expect(WorkCheck.fixableReason(scene.f.id, scene.f).reason).toBeNull();
        // Fixed once the scene stands: Token ids draw too, and must differ.
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        run(1500);
        scene.off();
        // 0.99 is past 0.8: this cycle paid 8.
        expect(scene.paid).toEqual([8]);
        expect(InventoryManager.getItemCount(COAL)).toBe(1);
        vi.restoreAllMocks();

        GameState.initNew();
        TileModifiers.clearAll();
        GameState.state.heroes = [];
        InventoryManager.init();
        const short = forgeScene('ef_forge_10', 8, 'ef_minus_12');
        const check = WorkCheck.fixableReason(short.f.id, short.f);
        expect(check.reason).toBe(ALERT.INPUTS);
        expect(check.inputCheck.missing).toEqual([{ itemId: COAL, needed: 9, available: 8 }]);
    });

    it('waiting for the most it can take, it draws nothing and pays nothing', () => {
        const scene = forgeScene('ef_forge_10', 11, 'ef_plus_12');
        const spy = vi.spyOn(Math, 'random');
        run(3000);
        expect(spy).not.toHaveBeenCalled();
        scene.off();
        expect(scene.paid).toEqual([]);
        expect(InventoryManager.getItemCount(COAL)).toBe(11);
        expect(WorkCheck.fixableReason(scene.f.id, scene.f).inputCheck.missing).toEqual([{ itemId: COAL, needed: 12, available: 11 }]);
    });
});

describe('with Preservation beside it', () => {
    it('a kept cycle rounds nothing: the draws of Preservation alone', () => {
        const draws = (beside, below) => {
            GameState.initNew();
            TileModifiers.clearAll();
            GameState.state.heroes = [];
            InventoryManager.init();
            const scene = forgeScene('ef_forge_10', 100, beside, below);
            const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
            run(3200);
            const n = spy.mock.calls.length;
            spy.mockRestore();
            scene.off();
            return { n, paid: scene.paid };
        };
        const kept = draws('ef_keep_100', null);
        expect(kept.paid).toEqual([0, 0, 0]);
        expect(draws('ef_keep_100', 'ef_minus_12')).toEqual(kept);
        // At 0 % nothing is kept and nothing about it draws: the rounding alone.
        const plain = draws('ef_minus_12', null);
        expect(draws('ef_minus_12', 'ef_keep_0')).toEqual(plain);
    });
});

describe('a Field\'s owed seed and a build', () => {
    function ripeField() {
        InventoryManager.addItem(SEED, 1);
        const farmer = makeHero('farmer');
        const field = put('ef_field', HERE);
        expect(StationRecipe.setSelectedRecipe(field, 'ef_recipe_wheat')).toBe(true);
        run(20200);
        expect(Fields.stageOf(field)).toBe(Fields.STAGE.RIPE);
        Orders.orderAt(farmer.id, HERE);
        return field;
    }

    it('a seed costing 0.8 is paid by chance: free this time, and the seed counts as paid', () => {
        holdStar(EFFECT_TYPES.INPUT_COST, 'percentage', -0.2, 'farming');
        const field = ripeField();
        vi.spyOn(Math, 'random').mockReturnValue(0.9);
        run(1100);
        expect(made(WHEAT)).toBe(1);
        expect(field.field.seedOwed).toBeUndefined();
        expect(InventoryManager.getItemCount(SEED)).toBe(1);
    });

    it('and paid in full the other time', () => {
        holdStar(EFFECT_TYPES.INPUT_COST, 'percentage', -0.2, 'farming');
        const field = ripeField();
        vi.spyOn(Math, 'random').mockReturnValue(0.1);
        run(1100);
        expect(field.field.seedOwed).toBeUndefined();
        expect(InventoryManager.getItemCount(SEED)).toBe(0);
    });

    it('a build remembers what it paid after Efficiency', () => {
        holdStar(EFFECT_TYPES.INPUT_COST, 'percentage', -0.12, 'construction');
        InventoryManager.addItem(COAL, 10);
        const builder = makeHero('builder');
        const f = put('ef_foundation', HERE);
        expect(StationRecipe.setSelectedRecipe(f, 'ef_build_vein')).toBe(true);
        Orders.orderAt(builder.id, HERE);
        // 3 × 0.88 = 2.64: 0.9 is past 0.64, so 2.
        vi.spyOn(Math, 'random').mockReturnValue(0.9);
        for (let i = 0; i < 100 && BoardState.getTokenById(f.id); i++) run(100);
        const built = BoardState.tokens().find(t => t.typeId === 'ef_vein');
        expect(built?.builtFrom).toEqual({ foundationTypeId: 'ef_foundation', buildCost: [{ itemId: COAL, quantity: 2 }] });
        expect(InventoryManager.getItemCount(COAL)).toBe(8);
    });
});

describe('the CMS rate calculator', () => {
    it('counts the exact cost a cycle pays on average, with no minimum of 1', () => {
        const content = (thrift) => ({
            tokens: {
                ef_forge_10: forge('ef_forge_10', 10),
                ef_forge_1: forge('ef_forge_1', 1),
                ...(thrift ? { ef_thrift: efficiency('ef_thrift', { mode: 'all', value: '' }, -0.2) } : {})
            },
            items: { [COAL]: material(COAL, 'Coal'), [BAR]: material(BAR, 'Bar') },
            recipes: [], effects: {}, skillPerks: {}
        });
        const book = buildRateBook(content(true));
        const ten = book.rateOf({ token: 'ef_forge_10' }, { supports: ['ef_thrift'] });
        const one = book.rateOf({ token: 'ef_forge_1' }, { supports: ['ef_thrift'] });
        expect(ten.ok).toBe(true);
        // 3600 cycles an hour at 1 s: 8 and 0.8 Coal a cycle.
        expect(ten.inputs[COAL]).toBeCloseTo(8 * ten.cyclesPerHour, 6);
        expect(one.inputs[COAL]).toBeCloseTo(0.8 * one.cyclesPerHour, 6);
    });
});

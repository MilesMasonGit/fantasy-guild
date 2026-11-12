import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as LoadoutMoments from '../systems/board/LoadoutMoments.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as Growth from '../systems/board/Growth.js';
import * as Fields from '../systems/board/Fields.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import * as HallRules from '../systems/progression/HallRules.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as ConsumptionSystem from '../systems/hero/ConsumptionSystem.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, makeStatement, paletteForKeyword } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { HALL_NODE } from '../config/guildUpgrades.js';
import { getPaletteEntry } from '../config/registries/modifierPalette.js';
import { CARRIED_KIND, CARRIED_KINDS } from '../config/registries/carriedKinds.js';
import { DRINK_CYCLES, ELIXIR_FIGHTS } from '../config/loopConstants.js';
import { resetMatTuning } from '../config/matTuning.js';
import { supportTag } from '../ui/components/board/supportTags.js';
import { findUnknownRefs } from '../systems/core/unknownRefRule.js';
import { slotsOf } from '../../cms/src/engine/ledger/statementSlots.js';
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
 * Preservation (brief 590 P1): a chance a completed cycle uses none of its materials, rolled before
 * it pays; and a chance a hero's ammo, Food, drink or potion dose, fight elixir or bait is not used
 * up. From a building's nearby rule and from a Hall star, guild-wide or aimed. A cycle's rule narrows
 * by skill, a carried thing's by the item or its kind. A failed cycle pays and never rolls; no rule,
 * no draw.
 */

// ---- Items --------------------------------------------------------------------------------------
const ORE = 'pv_ore';
const BAR = 'pv_bar';
const SEED = 'pv_seed';
const WHEAT = 'pv_wheat';
const ARROW = 'pv_arrow';
const BOW = 'pv_bow';
const BREAD = 'pv_bread';
const COFFEE = 'pv_coffee';
const TEA = 'pv_tea';
const ELIXIR = 'pv_elixir';
const WORM = 'pv_worm';
const ROD = 'pv_rod';
const TROUT = 'pv_trout';
const SALMON = 'pv_salmon';

const forTheCycle = (effectId, skill = null) => ({
    ...makeStatement(KEYWORD.APPLIES),
    when: { event: 'WORK_START', scope: 'self', ...(skill ? { skill } : {}) },
    target: { role: 'actor' },
    payload: { effectId, scale: 1, durationMs: 0, forCycle: true, chance: 100 }
});
const forTheFight = (effectId) => ({
    ...makeStatement(KEYWORD.APPLIES),
    when: { event: 'COMBAT_ENGAGED', scope: 'self' },
    payload: { effectId, scale: 1, durationMs: 0, forFight: true, chance: 100 }
});
const boost = (type, value) => ({ ...makeStatement(KEYWORD.PROVIDES), payload: { type, bucket: 'percentage', value }, to: null });
registerEffects({
    pv_fx_quick: { id: 'pv_fx_quick', name: 'Quick', statements: [boost('WORK_TIME', -0.1)] },
    pv_fx_coffee: { id: 'pv_fx_coffee', name: 'Coffee Drink', statements: [forTheCycle('pv_fx_quick')] },
    pv_fx_tea: { id: 'pv_fx_tea', name: 'Mining Tea', statements: [forTheCycle('pv_fx_quick', 'mining')] },
    pv_fx_valor: { id: 'pv_fx_valor', name: 'Valor', statements: [{ ...boost('DAMAGE', 1), payload: { type: 'DAMAGE', bucket: 'flat', value: 1 } }] },
    pv_fx_elixir: { id: 'pv_fx_elixir', name: 'Elixir of Valor', statements: [forTheFight('pv_fx_valor')] }
});

const material = (id, name, extra = {}) => ({ id, name, type: 'material', stackable: true, equipSlot: '', sprite: 'i_wheat', ...extra });
registerItems({
    [ORE]: material(ORE, 'Test Ore'),
    [BAR]: material(BAR, 'Test Bar'),
    [SEED]: material(SEED, 'Test Seed'),
    [WHEAT]: material(WHEAT, 'Test Wheat'),
    [TROUT]: material(TROUT, 'Trout'),
    [SALMON]: material(SALMON, 'Salmon'),
    [ARROW]: material(ARROW, 'Iron Arrow', { equipSlot: 'consumable', arrow: { damage: 1, damageType: 'stab' } }),
    [BOW]: { id: BOW, name: 'Test Bow', type: 'weapon', equipSlot: 'hand', stackable: true, sprite: 'i_pick_copper', styles: ['ranged'], damage: 1 },
    [BREAD]: material(BREAD, 'Bread', { type: 'food', equipSlot: 'food', restoreAmount: 5 }),
    [COFFEE]: material(COFFEE, 'Coffee', { equipSlot: 'drink', effects: [{ effectId: 'pv_fx_coffee' }] }),
    [TEA]: material(TEA, 'Mining Tea', { equipSlot: 'consumable', effects: [{ effectId: 'pv_fx_tea' }] }),
    [ELIXIR]: material(ELIXIR, 'Valor', { equipSlot: 'consumable', effects: [{ effectId: 'pv_fx_elixir' }] }),
    [WORM]: material(WORM, 'Worm', { equipSlot: 'consumable' }),
    [ROD]: { id: ROD, name: 'Wooden Rod', type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_rod_wood', tool: { kind: 'fishing_rod', tier: 1 } }
});

registerRecipePools({
    farming: [{
        id: 'pv_recipe_wheat', name: 'Test Wheat', levelRequirement: 1, durationMs: 1000, xp: 2, stationKinds: ['field'],
        inputs: [{ itemId: SEED, quantity: 1 }],
        outputs: [{ itemId: WHEAT, chance: 100, minQty: 1, maxQty: 1 }],
        crop: { growMs: 20000, load: 3 }
    }]
});

// ---- Tokens -------------------------------------------------------------------------------------
const FORGE_USES = 50;
const forge = (id) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: FORGE_USES, sprite: 's_nature',
    tags: ['PvForge'], requiresHero: true,
    config: {
        skill: 'smithing', skillRequired: 1, cycleTimeMs: 1000, xp: 1,
        inputs: [{ itemId: ORE, quantity: 2 }], outputs: [{ itemId: BAR, chance: 100, minQty: 1, maxQty: 1 }]
    }
});
const vein = (id) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: true,
    config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] }
});
let stm = 0;
const keeps = (to, value, category) => ({
    id: `stm_pv_${++stm}`, keyword: 'provides', to, reach: 'nearby',
    payload: { type: EFFECT_TYPES.PRESERVATION, bucket: 'flat', value, ...(category ? { category } : {}) }
});
const building = (id, statements) => ({
    id, name: id, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false, statements
});
const AT_FORGE = { mode: 'id', value: 'pv_forge' };
const AT_VEIN = { mode: 'id', value: 'pv_vein' };
const AT_DUMMY = { mode: 'id', value: 'pv_dummy' };
const AT_LAKE = { mode: 'id', value: 'pv_lake' };
registerTokenTypes({
    pv_forge: forge('pv_forge'),
    pv_other_forge: forge('pv_other_forge'),
    pv_vein: vein('pv_vein'),
    pv_keep_100: building('pv_keep_100', [keeps(AT_FORGE, 100)]),
    pv_keep_0: building('pv_keep_0', [keeps(AT_FORGE, 0)]),
    pv_keep_cooking: building('pv_keep_cooking', [keeps(AT_FORGE, 100, 'cooking')]),
    pv_keep_smithing_tag: building('pv_keep_smithing_tag', [keeps({ mode: 'tag', value: 'PvForge' }, 100, 'smithing')]),
    pv_keep_ammo_at_forge: building('pv_keep_ammo_at_forge', [keeps(AT_FORGE, 100, CARRIED_KIND.AMMO)]),
    pv_jinx: building('pv_jinx', [{ ...keeps(AT_FORGE, 100), payload: { type: EFFECT_TYPES.FAIL_CHANCE, bucket: 'flat', value: 100 } }]),
    pv_half_jinx: building('pv_half_jinx', [{ ...keeps(AT_FORGE, 50), payload: { type: EFFECT_TYPES.FAIL_CHANCE, bucket: 'flat', value: 50 } }]),
    pv_vein_keep: building('pv_vein_keep', [keeps(AT_VEIN, 100)]),
    pv_dummy: {
        id: 'pv_dummy', name: 'Dummy', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50, sprite: 's_occult', requiresHero: true,
        enemy: { level: 1, style: 'melee', hp: 500 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    pv_ammo_keep: building('pv_ammo_keep', [keeps(AT_DUMMY, 100, CARRIED_KIND.AMMO)]),
    pv_ammo_keep_0: building('pv_ammo_keep_0', [keeps(AT_DUMMY, 0, CARRIED_KIND.AMMO)]),
    pv_arrow_keep: building('pv_arrow_keep', [keeps(AT_DUMMY, 100, ARROW)]),
    pv_food_keep_dummy: building('pv_food_keep_dummy', [keeps(AT_DUMMY, 100, CARRIED_KIND.FOOD)]),
    pv_elixir_keep: building('pv_elixir_keep', [keeps(AT_DUMMY, 100, CARRIED_KIND.ELIXIR)]),
    pv_food_keep_vein: building('pv_food_keep_vein', [keeps(AT_VEIN, 100, CARRIED_KIND.FOOD)]),
    pv_drink_keep: building('pv_drink_keep', [keeps(AT_VEIN, 100, CARRIED_KIND.DRINK)]),
    pv_potion_keep: building('pv_potion_keep', [keeps(AT_VEIN, 100, CARRIED_KIND.POTION)]),
    pv_mining_keep: building('pv_mining_keep', [keeps(AT_VEIN, 100, 'mining')]),
    pv_lake: {
        id: 'pv_lake', name: 'Lake', tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 't_lake_small', requiresHero: true,
        uses: null, tags: ['water'],
        catchPools: [
            { tool: 'fishing_rod', catches: [{ itemId: TROUT, weight: 1 }] },
            { tool: 'fishing_rod', bait: WORM, catches: [{ itemId: SALMON, weight: 1 }] }
        ],
        config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] }
    },
    pv_bait_keep: building('pv_bait_keep', [keeps(AT_LAKE, 100, CARRIED_KIND.BAIT)]),
    pv_bait_keep_0: building('pv_bait_keep_0', [keeps(AT_LAKE, 0, CARRIED_KIND.BAIT)]),
    pv_field: {
        id: 'pv_field', name: 'Test Field', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_farmland',
        requiresHero: true, field: {},
        config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_pv_field', keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }]
    }
});

/** A Hall star, rank 1 held, giving Preservation `value` % with the selector `to` (none: guild-wide). */
function holdStar(value, { to = null, category } = {}) {
    registerHallSky({
        constellations: { pv: { id: 'pv', name: 'Preservation', label: { x: 1, y: 0 } } },
        stars: {
            pv_star: {
                id: 'pv_star', constellation: 'pv', name: 'Thrifty Hands', node: { x: 0.7, y: 0 }, links: [HALL_NODE],
                ranks: [{ tier: 1, price: [], lines: [], rules: [{
                    id: 'stm_pv_star', keyword: KEYWORD.PROVIDES, chargeDelta: 0, reach: 'board', target: null, when: null, upkeep: null,
                    to: to || { mode: 'all', value: '' },
                    payload: { type: EFFECT_TYPES.PRESERVATION, bucket: 'flat', value, ...(category ? { category } : {}) }
                }] }]
            }
        }
    });
    GuildUpgradeManager.getRanks().pv_star = 1;
    GuildUpgradeManager.recompute();
}
function dropStar() {
    registerHallSky(null);
    HallRules.apply({});
}

function makeHero(id, hp = 200) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: hp, max: 200 };
    for (const s of getAllSkillIds()) hero.skills[s] = { level: 60, xp: 0 };
    hero.equipment = Array(9).fill(null);
    hero.aggregator = new ModifierAggregator(hero.id);
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

const run = (ms) => {
    for (let t = 0; t < ms; t += 100) {
        LiveEffects.tick(100, TriggerSystem.fireLiveStatement);
        BoardRunner.tick(100);
    }
};
const HERE = { x: 800, y: 500 };
const BESIDE = { x: 940, y: 500 };
const BELOW = { x: 800, y: 640 };
const FAR = { x: 300, y: 300 };
const made = (itemId) => InventoryManager.getItemCount(itemId) + SpriteLayer.countOnBoard(itemId);

/** Counts a Token's completed cycles, failed ones and the charges it spent. */
function watch(instanceId) {
    const seen = { cycles: 0, failed: 0, spent: 0 };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (e) => {
            if (e.instanceId !== instanceId) return;
            seen.cycles += 1;
            if (e.failed) seen.failed += 1;
        }),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, (e) => {
            if (e.instanceId === instanceId && e.delta < 0) seen.spent -= e.delta;
        })
    ];
    seen.off = () => offs.forEach(off => off?.());
    return seen;
}

/** A smith on a forge with 100 Ore in the Bank, and whatever stands beside it. */
function forgeScene({ beside = null, below = null, typeId = 'pv_forge' } = {}) {
    InventoryManager.addItem(ORE, 100);
    const smith = makeHero('smith');
    const f = put(typeId, HERE);
    if (beside) put(beside, BESIDE);
    if (below) put(below, BELOW);
    Orders.orderAt(smith.id, HERE);
    return f;
}

let consumed = [];
let offs = [];

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
    LoadoutMoments.init();
    TriggerSystem.init();
    Flags.init();
    LiveEffects.resetClock();
    TileModifiers.clearAll();
    Growth.resetGrowthAlerts();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
    offs.forEach(off => off());
    consumed = [];
    offs = [EventBus.subscribe(ENGINE_EVENTS.HERO_CONSUMED, (p) => consumed.push(p))];
});

afterEach(() => {
    dropStar();
});

describe('Preservation on a cycle, from a building beside the Token', () => {
    it('at 100 %, the forge works on, makes its bars and spends its charges, and the Ore never drops', () => {
        const f = forgeScene({ beside: 'pv_keep_100' });
        const seen = watch(f.id);
        run(6200);
        seen.off();
        expect(seen.cycles).toBeGreaterThanOrEqual(5);
        expect(InventoryManager.getItemCount(ORE)).toBe(100);
        expect(made(BAR)).toBe(seen.cycles);
        expect(seen.spent).toBe(seen.cycles);
        expect(f.usesRemaining).toBe(FORGE_USES - seen.cycles);
    });

    it('at 0 %, every cycle pays, as with no rule', () => {
        const f = forgeScene({ beside: 'pv_keep_0' });
        const seen = watch(f.id);
        run(3200);
        seen.off();
        expect(seen.cycles).toBe(3);
        expect(InventoryManager.getItemCount(ORE)).toBe(100 - 2 * 3);
    });

    it('out of reach, it does nothing', () => {
        InventoryManager.addItem(ORE, 100);
        const smith = makeHero('smith');
        put('pv_forge', HERE);
        put('pv_keep_100', FAR);
        Orders.orderAt(smith.id, HERE);
        run(3200);
        expect(InventoryManager.getItemCount(ORE)).toBe(94);
    });

    it('reaches only the Tokens its rule names', () => {
        forgeScene({ beside: 'pv_keep_100', typeId: 'pv_other_forge' });
        run(3200);
        expect(InventoryManager.getItemCount(ORE)).toBe(94);
    });

    it('narrowed to another skill, it does nothing; aimed by tag and narrowed to the forge\'s own skill, it keeps every input', () => {
        forgeScene({ beside: 'pv_keep_cooking' });
        run(3200);
        expect(InventoryManager.getItemCount(ORE)).toBe(94);

        GameState.initNew();
        TileModifiers.clearAll();
        GameState.state.heroes = [];
        InventoryManager.init();
        forgeScene({ beside: 'pv_keep_smithing_tag', typeId: 'pv_other_forge' });
        run(3200);
        expect(InventoryManager.getItemCount(ORE)).toBe(100);
    });

    it('narrowed to a kind of carried thing (Ammo), it keeps no cycle\'s materials', () => {
        forgeScene({ beside: 'pv_keep_ammo_at_forge' });
        run(3200);
        expect(InventoryManager.getItemCount(ORE)).toBe(94);
    });
});

describe('Preservation on a cycle, from a Hall star', () => {
    it('aimed at the forge at 100 %, the Ore never drops; at 0 %, it drops every cycle', () => {
        holdStar(100, { to: AT_FORGE });
        forgeScene();
        run(4200);
        expect(InventoryManager.getItemCount(ORE)).toBe(100);

        holdStar(0, { to: AT_FORGE });
        run(3000);
        expect(InventoryManager.getItemCount(ORE)).toBe(94);
    });

    it('aimed at the forge, it leaves another forge alone', () => {
        holdStar(100, { to: AT_FORGE });
        forgeScene({ typeId: 'pv_other_forge' });
        run(3200);
        expect(InventoryManager.getItemCount(ORE)).toBe(94);
    });

    it('guild-wide and narrowed to Smithing, it reaches every smithing Token; narrowed to Cooking, none', () => {
        holdStar(100, { category: 'smithing' });
        forgeScene({ typeId: 'pv_other_forge' });
        run(3200);
        expect(InventoryManager.getItemCount(ORE)).toBe(100);

        holdStar(100, { category: 'cooking' });
        run(3000);
        expect(InventoryManager.getItemCount(ORE)).toBe(94);
    });
});

describe('a failed cycle', () => {
    it('still pays its inputs with Preservation at 100 % beside it', () => {
        const f = forgeScene({ beside: 'pv_keep_100', below: 'pv_jinx' });
        const seen = watch(f.id);
        run(3200);
        seen.off();
        expect(seen.failed).toBe(3);
        expect(InventoryManager.getItemCount(ORE)).toBe(94);
        expect(made(BAR)).toBe(0);
    });

    it('draws nothing for Preservation: the same draws as without the rule', () => {
        const draws = (withRule) => {
            GameState.initNew();
            TileModifiers.clearAll();
            GameState.state.heroes = [];
            InventoryManager.init();
            forgeScene({ beside: 'pv_jinx', below: withRule ? 'pv_keep_100' : null });
            const spy = vi.spyOn(Math, 'random');
            run(3200);
            const n = spy.mock.calls.length;
            spy.mockRestore();
            expect(InventoryManager.getItemCount(ORE)).toBe(94);
            return n;
        };
        expect(draws(true)).toBe(draws(false));
    });
});

describe('⚠️ no rule, no draw, and the old order', () => {
    /** Math.random draws over three cycles of a fresh forge, with `beside` next to it. */
    function drawsWith(beside, { typeId = 'pv_forge', setUp = null } = {}) {
        GameState.initNew();
        TileModifiers.clearAll();
        GameState.state.heroes = [];
        InventoryManager.init();
        setUp?.();
        const f = forgeScene({ beside, typeId });
        const spy = vi.spyOn(Math, 'random');
        const seen = watch(f.id);
        run(3200);
        seen.off();
        const n = spy.mock.calls.length;
        spy.mockRestore();
        expect(seen.cycles).toBe(3);
        return n;
    }

    it('a rule offering Preservation draws once per cycle; none, or one at 0 %, draws nothing for it', () => {
        const none = drawsWith(null);
        expect(drawsWith('pv_keep_0')).toBe(none);
        expect(drawsWith('pv_keep_100')).toBe(none + 3);
    });

    it('a Token with nothing to pay never rolls, even with a rule offering the chance', () => {
        const veinDraws = (withRule) => {
            GameState.initNew();
            TileModifiers.clearAll();
            GameState.state.heroes = [];
            const miner = makeHero('miner');
            put('pv_vein', HERE);
            if (withRule) put('pv_vein_keep', BESIDE);
            Orders.orderAt(miner.id, HERE);
            const spy = vi.spyOn(Math, 'random');
            run(3200);
            const n = spy.mock.calls.length;
            spy.mockRestore();
            return n;
        };
        expect(veinDraws(true)).toBe(veinDraws(false));
    });

    it('with no rule the inputs are paid before the failure is rolled, as they always were; with one, after', () => {
        /** Each finished cycle's paying and drawing, in order: one list per cycle, four cycles. */
        const cycles = (below) => {
            GameState.initNew();
            TileModifiers.clearAll();
            GameState.state.heroes = [];
            InventoryManager.init();
            let log = [];
            const done = [];
            const real = Math.random;
            const spy = vi.spyOn(Math, 'random').mockImplementation(() => { log.push('draw'); return real(); });
            const f = forgeScene({ beside: 'pv_half_jinx', below });
            const offs = [
                EventBus.subscribe(ENGINE_EVENTS.INVENTORY_UPDATED, (e) => { if (e?.itemId === ORE && e.removed) log.push('paid'); }),
                EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (e) => {
                    if (e.instanceId !== f.id) return;
                    done.push({ failed: e.failed, log });
                    log = [];
                })
            ];
            // From the moment the smith stands at the forge: walking there is not a cycle.
            for (let i = 0; i < 100 && !BoardState.workTokenOf('smith'); i++) run(100);
            log = [];
            for (let i = 0; i < 100 && done.length < 4; i++) run(100);
            offs.forEach(off => off());
            spy.mockRestore();
            expect(done).toHaveLength(4);
            return done;
        };
        // No chance offered, by no rule or one at 0 %: every cycle pays, then rolls its failure.
        for (const below of [null, 'pv_keep_0']) {
            for (const cycle of cycles(below)) {
                expect(cycle.log[0]).toBe('paid');
                expect(cycle.log[1]).toBe('draw');
            }
        }
        // A chance offered: the failure is rolled first; a failed cycle then pays, one that worked
        // rolls Preservation (a hit at 100 %) and pays nothing.
        for (const cycle of cycles('pv_keep_100')) {
            expect(cycle.log[0]).toBe('draw');
            expect(cycle.log[1]).toBe(cycle.failed ? 'paid' : 'draw');
            expect(cycle.log.includes('paid')).toBe(cycle.failed);
        }
    });
});

describe('a Field\'s owed seed', () => {
    function ripeField() {
        InventoryManager.addItem(SEED, 1);
        const farmer = makeHero('farmer');
        const field = put('pv_field', HERE);
        expect(StationRecipe.setSelectedRecipe(field, 'pv_recipe_wheat')).toBe(true);
        run(20200);
        expect(Fields.stageOf(field)).toBe(Fields.STAGE.RIPE);
        expect(field.field.seedOwed).toBe(true);
        Orders.orderAt(farmer.id, HERE);
        return field;
    }

    it('stays owed after a harvest that kept its materials, and the next harvest pays it', () => {
        holdStar(100, { category: 'farming' });
        const field = ripeField();
        run(1100);
        expect(made(WHEAT)).toBe(1);
        expect(Fields.fieldState(field).load).toBe(2);
        expect(field.field.seedOwed).toBe(true);
        expect(InventoryManager.getItemCount(SEED)).toBe(1);

        dropStar();
        run(1000);
        expect(made(WHEAT)).toBe(2);
        expect(field.field.seedOwed).toBeUndefined();
        expect(InventoryManager.getItemCount(SEED)).toBe(0);
    });

    it('without the rule, the first harvest pays it', () => {
        const field = ripeField();
        run(1100);
        expect(field.field.seedOwed).toBeUndefined();
        expect(InventoryManager.getItemCount(SEED)).toBe(0);
    });
});

describe('ammo', () => {
    let archers = 0;
    function archerScene(beside) {
        const archer = makeHero(`archer_${++archers}`);
        InventoryManager.addItem(BOW, 1);
        expect(EquipmentManager.equipItem(archer.id, BOW).success).toBe(true);
        InventoryManager.addItem(ARROW, 40);
        expect(EquipmentManager.equipItem(archer.id, ARROW).success).toBe(true);
        put('pv_dummy', HERE);
        if (beside) put(beside, BESIDE);
        Orders.orderAt(archer.id, HERE);
        const shots = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => shots.push(p));
        return { archer, shots, off };
    }

    it('a building beside the enemy at 100 % keeps every arrow shot; at 0 % each one is spent', () => {
        const kept = archerScene('pv_ammo_keep');
        run(20000);
        kept.off();
        expect(kept.shots.length).toBeGreaterThan(3);
        expect(kept.shots.every(p => p.arrowId === ARROW)).toBe(true);
        expect(InventoryManager.getItemCount(ARROW)).toBe(40);
    });

    it('at 0 %, each arrow shot is spent', () => {
        const spent = archerScene('pv_ammo_keep_0');
        run(20000);
        spent.off();
        expect(spent.shots.length).toBeGreaterThan(3);
        expect(InventoryManager.getItemCount(ARROW)).toBe(40 - spent.shots.length);
    });

    it('a rule naming the arrow itself keeps it too', () => {
        const kept = archerScene('pv_arrow_keep');
        run(12000);
        kept.off();
        expect(kept.shots.length).toBeGreaterThan(1);
        expect(InventoryManager.getItemCount(ARROW)).toBe(40);
    });

    it('a guild-wide Hall star on Ammo keeps arrows anywhere', () => {
        holdStar(100, { category: CARRIED_KIND.AMMO });
        const kept = archerScene(null);
        run(12000);
        kept.off();
        expect(kept.shots.length).toBeGreaterThan(1);
        expect(InventoryManager.getItemCount(ARROW)).toBe(40);
    });

    it('draws once a shot with the rule, and not at all without it', () => {
        /**
         * Draws over a fight. `fixed`: every draw answers 0.5, so a kept arrow's extra draw cannot
         * turn a later hit into a miss and the counts compare one for one.
         */
        const draws = (beside, star = null, fixed = false) => {
            // Every run from the same seed, the hero's making included, so two runs compare blow for blow.
            // Fixed answers only once the fight runs: the scene's Token ids draw too, and must differ.
            let seed = 12345;
            let fighting = false;
            const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
                seed = (seed * 16807) % 2147483647;
                return fixed && fighting ? 0.5 : (seed - 1) / 2147483646;
            });
            GameState.initNew();
            TileModifiers.clearAll();
            BoardCombat.clearAll();
            Flags.init();
            GameState.state.heroes = [];
            InventoryManager.init();
            dropStar();
            if (star != null) holdStar(star, { category: CARRIED_KIND.AMMO });
            const scene = archerScene(beside);
            const before = spy.mock.calls.length;
            fighting = true;
            run(12000);
            const n = spy.mock.calls.length - before;
            spy.mockRestore();
            scene.off();
            return { n, shots: scene.shots.map(p => `${p.hit}:${p.damage}`) };
        };
        // A Hall star moves nothing on the mat, so the fight is the same fight: at 0 % the very
        // same draws and the very same blows.
        expect(draws(null, 0)).toEqual(draws(null));
        const none = draws(null, null, true);
        const starred = draws(null, 100, true);
        expect(starred.shots).toEqual(none.shots);
        expect(starred.n).toBe(none.n + none.shots.length);
        // A building in the same spot either way: one aimed elsewhere offers nothing here.
        expect(draws('pv_ammo_keep_0')).toEqual(draws('pv_keep_100'));
        const elsewhere = draws('pv_keep_100', null, true);
        const kept = draws('pv_ammo_keep', null, true);
        expect(kept.shots).toEqual(elsewhere.shots);
        expect(kept.n).toBe(elsewhere.n + elsewhere.shots.length);
    });
});

describe('Food', () => {
    it('in a fight, a building beside the enemy keeps the bread the hero eats; it still heals', () => {
        const fighter = makeHero('fighter', 10);
        fighter.equipment[0] = BREAD;
        InventoryManager.addItem(BREAD, 20);
        put('pv_dummy', HERE);
        put('pv_food_keep_dummy', BESIDE);
        Orders.orderAt(fighter.id, HERE);
        run(8000);
        const meals = consumed.filter(p => p.itemId === BREAD);
        expect(meals.length).toBeGreaterThan(0);
        expect(meals.every(p => p.preserved === true)).toBe(true);
        expect(InventoryManager.getItemCount(BREAD)).toBe(20);
        expect(fighter.hp.current).toBeGreaterThan(10);
    });

    it('out of a fight, read at the Token the hero works: kept beside it, eaten elsewhere', () => {
        const miner = makeHero('miner');
        miner.equipment[0] = BREAD;
        InventoryManager.addItem(BREAD, 5);
        put('pv_vein', HERE);
        put('pv_food_keep_vein', BESIDE);
        Orders.orderAt(miner.id, HERE);
        run(1500);
        expect(BoardState.workTokenOf(miner.id)).not.toBeNull();
        miner.hp.current = 10;
        expect(ConsumptionSystem.tryEat(miner.id)).toHaveLength(1);
        expect(InventoryManager.getItemCount(BREAD)).toBe(5);

        // A hero who works nothing: no Token, so no building reaches the meal.
        const idle = makeHero('idle', 10);
        idle.equipment[0] = BREAD;
        expect(ConsumptionSystem.tryEat(idle.id)).toHaveLength(1);
        expect(InventoryManager.getItemCount(BREAD)).toBe(4);
    });

    it('a guild-wide Hall star on Food reaches a hero who works nothing', () => {
        holdStar(100, { category: CARRIED_KIND.FOOD });
        const idle = makeHero('idle', 10);
        idle.equipment[0] = BREAD;
        InventoryManager.addItem(BREAD, 5);
        expect(ConsumptionSystem.tryEat(idle.id)).toHaveLength(1);
        expect(InventoryManager.getItemCount(BREAD)).toBe(5);
    });

    it('an Ammo rule does not keep Food, and a Mining rule keeps no carried thing', () => {
        holdStar(100, { category: CARRIED_KIND.AMMO });
        const idle = makeHero('idle', 10);
        idle.equipment[0] = BREAD;
        InventoryManager.addItem(BREAD, 5);
        ConsumptionSystem.tryEat(idle.id);
        expect(InventoryManager.getItemCount(BREAD)).toBe(4);

        holdStar(100, { category: 'mining' });
        idle.hp.current = 10;
        ConsumptionSystem.tryEat(idle.id);
        expect(InventoryManager.getItemCount(BREAD)).toBe(3);
    });
});

describe('drinks, work potions and fight elixirs', () => {
    function minerOn(beside, grid) {
        const miner = makeHero('miner');
        grid.forEach((id, i) => { miner.equipment[i] = id; });
        put('pv_vein', HERE);
        if (beside) put(beside, BESIDE);
        Orders.orderAt(miner.id, HERE);
        return miner;
    }

    it('a drink\'s fresh dose starts without taking one from the Bank', () => {
        InventoryManager.addItem(COFFEE, 3);
        const miner = minerOn('pv_drink_keep', [COFFEE]);
        run(1500);
        // One dose, started at the first cycle and counted down by the second.
        expect(miner.drinkCycles?.[COFFEE]).toBe(DRINK_CYCLES - 2);
        expect(consumed.filter(p => p.itemId === COFFEE)).toEqual([expect.objectContaining({ dose: 'drink', preserved: true })]);
        expect(InventoryManager.getItemCount(COFFEE)).toBe(3);
    });

    it('without the rule the dose takes one', () => {
        InventoryManager.addItem(COFFEE, 3);
        minerOn(null, [COFFEE]);
        run(1500);
        expect(InventoryManager.getItemCount(COFFEE)).toBe(2);
        expect(consumed.find(p => p.itemId === COFFEE)?.preserved).toBeUndefined();
    });

    it('a work potion drunk every cycle is kept by a Work potion rule, not by a Drink one', () => {
        InventoryManager.addItem(TEA, 10);
        minerOn('pv_potion_keep', [TEA]);
        run(3200);
        expect(consumed.filter(p => p.itemId === TEA).length).toBeGreaterThanOrEqual(3);
        expect(InventoryManager.getItemCount(TEA)).toBe(10);

        GameState.initNew();
        TileModifiers.clearAll();
        GameState.state.heroes = [];
        InventoryManager.init();
        InventoryManager.addItem(TEA, 10);
        minerOn('pv_drink_keep', [TEA]);
        run(3200);
        expect(InventoryManager.getItemCount(TEA)).toBeLessThanOrEqual(7);
    });

    it('a fight elixir\'s fresh dose starts without taking one, read beside the enemy', () => {
        const fighter = makeHero('fighter');
        fighter.equipment[0] = ELIXIR;
        InventoryManager.addItem(ELIXIR, 2);
        put('pv_dummy', HERE);
        put('pv_elixir_keep', BESIDE);
        Orders.orderAt(fighter.id, HERE);
        run(3000);
        expect(fighter.elixirFights).toEqual({ [ELIXIR]: ELIXIR_FIGHTS - 1 });
        expect(consumed.filter(p => p.itemId === ELIXIR)).toEqual([expect.objectContaining({ elixir: true, preserved: true })]);
        expect(InventoryManager.getItemCount(ELIXIR)).toBe(2);
    });

    it('a Mining rule keeps the vein\'s cycle (it has nothing to keep) and no dose', () => {
        InventoryManager.addItem(COFFEE, 3);
        minerOn('pv_mining_keep', [COFFEE]);
        run(1500);
        expect(InventoryManager.getItemCount(COFFEE)).toBe(2);
    });
});

describe('bait', () => {
    function anglerScene(beside) {
        const angler = makeHero('angler');
        angler.equipment[0] = ROD;
        angler.heldCopies = Array(9).fill(false);
        angler.heldCopies[0] = true;
        angler.equipment[1] = WORM;
        InventoryManager.addItem(WORM, 10);
        put('pv_lake', HERE);
        if (beside) put(beside, BESIDE);
        Orders.orderAt(angler.id, HERE);
        return angler;
    }

    it('a building beside the water keeps the bait; the catch is still the bait pool\'s', () => {
        anglerScene('pv_bait_keep');
        run(4200);
        expect(made(SALMON)).toBeGreaterThanOrEqual(3);
        expect(made(TROUT)).toBe(0);
        expect(InventoryManager.getItemCount(WORM)).toBe(10);
    });

    it('without it one worm goes per catch', () => {
        anglerScene(null);
        run(4200);
        const catches = made(SALMON);
        expect(catches).toBeGreaterThanOrEqual(3);
        expect(InventoryManager.getItemCount(WORM)).toBe(10 - catches);
    });

    it('draws once a catch with the rule, and not at all without it or at 0 %', () => {
        const draws = (beside) => {
            GameState.initNew();
            TileModifiers.clearAll();
            GameState.state.heroes = [];
            InventoryManager.init();
            anglerScene(beside);
            const spy = vi.spyOn(Math, 'random');
            run(3200);
            const n = spy.mock.calls.length;
            spy.mockRestore();
            return { n, catches: made(SALMON) };
        };
        const none = draws(null);
        expect(draws('pv_bait_keep_0')).toEqual(none);
        const kept = draws('pv_bait_keep');
        expect(kept.catches).toBe(none.catches);
        expect(kept.n).toBe(none.n + none.catches);
    });
});

describe('Preservation as the CMS and the game say it', () => {
    const rule = (category, value = 25, extra = {}) => ({
        ...makeStatement(KEYWORD.PROVIDES), to: null, reach: 'nearby', ...extra,
        payload: { type: EFFECT_TYPES.PRESERVATION, bucket: 'flat', value, ...(category ? { category } : {}) }
    });
    const names = { item: (id) => (id === ARROW ? 'Iron Arrow' : id) };

    it('is a Support chance in the palette, named Preservation, flat only, narrowed by skill or carried thing', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.PRESERVATION);
        expect(entry).toMatchObject({ label: 'Preservation', shape: 'proc', categories: 'skillOrCarried', buckets: ['flat'], group: 'Support' });
        expect(entry.hint).toMatch(/^A chance a cycle uses none of its materials/);
        expect(paletteForKeyword(KEYWORD.PROVIDES, false).map(e => e.type)).toContain(EFFECT_TYPES.PRESERVATION);
    });

    it('reads what it keeps: everything, a skill\'s materials, a kind or one item', () => {
        expect(renderStatement(rule(null), names)).toBe(
            'Makes every nearby Token have a 25% chance nothing is used up: a cycle\'s materials, ammo, Food, drinks, potions or bait.');
        expect(renderStatement(rule('smithing'), names)).toBe(
            'Makes every nearby Token have a 25% chance a Smithing cycle uses none of its materials.');
        expect(renderStatement(rule('alchemy'), names)).toMatch(/chance an Alchemy cycle uses none of its materials/);
        expect(renderStatement(rule(CARRIED_KIND.AMMO), names)).toBe(
            'Makes every nearby Token have a 25% chance ammo is not used up.');
        expect(renderStatement(rule(CARRIED_KIND.DRINK), names)).toMatch(/a 25% chance a drink is not used up/);
        expect(renderStatement(rule(ARROW), names)).toBe(
            'Makes every nearby Token have a 25% chance an Iron Arrow is not used up.');
        expect(renderStatement(rule(CARRIED_KIND.FOOD, -5), names)).toMatch(/have 5% less chance Food is not used up/);
    });

    it('reads on a hero as the hero\'s, with no second "at Mining"', () => {
        const carried = { ...names, carried: true };
        expect(renderStatement(rule(null), carried)).toBe(
            'Gives the hero a 25% chance nothing is used up: a cycle\'s materials, ammo, Food, drinks, potions or bait.');
        expect(renderStatement(rule('mining'), carried)).toBe('Gives the hero a 25% chance a Mining cycle uses none of its materials.');
        expect(renderStatement(rule(CARRIED_KIND.BAIT), carried)).toBe('Gives the hero a 25% chance bait is not used up.');
    });

    it('tags a support "+25 % Preservation"', () => {
        expect(supportTag({ type: EFFECT_TYPES.PRESERVATION, bucket: 'flat', value: 25 })).toBe('+25 % Preservation');
    });

    it('offers everything, every skill, every kind and every item in the CMS', () => {
        const ctx = { items: { [ARROW]: { id: ARROW, name: 'Iron Arrow' } } };
        const slot = slotsOf(rule(null), ctx).find(s => s.id === 'category');
        const ids = slot.options.map(o => o.id);
        expect(ids[0]).toBe('');
        expect(ids).toEqual(expect.arrayContaining(['mining', 'smithing', ...CARRIED_KINDS.map(k => k.id), ARROW]));
        expect(slot.options.find(o => o.id === CARRIED_KIND.AMMO).label).toBe('Ammo');
    });

    it('the audit names a narrowing that is no skill, kind or item', () => {
        const token = (id, category) => ({ id, name: id, statements: [rule(category)] });
        const findings = findUnknownRefs({
            tokens: [token('pv_good_kind', CARRIED_KIND.BAIT), token('pv_good_skill', 'mining'), token('pv_good_item', ARROW), token('pv_bad', 'not_a_thing')],
            items: { [ARROW]: { id: ARROW } }
        });
        expect(findings.map(f => f.entityId)).toEqual(['pv_bad']);
    });

    it('every kind id is no skill, so the two never collide in a rule', () => {
        for (const kind of CARRIED_KINDS) expect(getAllSkillIds()).not.toContain(kind.id);
    });
});

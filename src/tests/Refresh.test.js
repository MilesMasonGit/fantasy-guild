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
import * as Growth from '../systems/board/Growth.js';
import * as Fields from '../systems/board/Fields.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as HallRules from '../systems/progression/HallRules.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { HALL_NODE } from '../config/guildUpgrades.js';
import { getPaletteEntry } from '../config/registries/modifierPalette.js';
import { resetMatTuning } from '../config/matTuning.js';
import { supportTag } from '../ui/components/board/supportTags.js';
import { withoutShippedPerks } from './fixtures/noPerks.js';

withoutShippedPerks();

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Refresh (brief 590 P2): a chance a completed cycle spends none of the Token's charges, and a
 * Field's harvest none of its load. From a building's nearby rule and from a Hall star, aimed by the
 * rule's `to` and narrowed by skill. A failed cycle still burns its charge and never rolls; no rule,
 * no draw.
 */

const ORE = 'fixture_rf_ore';
const SEED = 'fixture_rf_seed';
const WHEAT_ITEM = 'fixture_rf_wheat';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({ [ORE]: item(ORE, 'Test Ore'), [SEED]: item(SEED, 'Test Seed'), [WHEAT_ITEM]: item(WHEAT_ITEM, 'Test Wheat') });

const WHEAT = 'rf_recipe_wheat';
registerRecipePools({
    farming: [{
        id: WHEAT, name: 'Test Wheat', levelRequirement: 1, durationMs: 1000, xp: 2, stationKinds: ['field'],
        inputs: [{ itemId: SEED, quantity: 1 }],
        outputs: [{ itemId: WHEAT_ITEM, chance: 100, minQty: 1, maxQty: 1 }],
        crop: { growMs: 20000, load: 3 }
    }]
});

const USES = 5;
const vein = (id) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: USES, sprite: 's_nature',
    tags: ['RfOre'], requiresHero: true,
    respawn: { mode: 'refill', afterMs: 60000 },
    config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] }
});
let stm = 0;
const provides = (to, type, value, extra = {}) => ({
    id: `stm_rf_${++stm}`, keyword: 'provides', to, reach: 'nearby',
    payload: { type, bucket: 'flat', value, ...extra }
});
const building = (id, statements) => ({
    id, name: id, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false, statements
});
const AT_VEIN = { mode: 'id', value: 'rf_vein' };
registerTokenTypes({
    rf_vein: vein('rf_vein'),
    rf_other_vein: vein('rf_other_vein'),
    rf_endless_vein: { ...vein('rf_endless_vein'), uses: null, respawn: undefined },
    rf_well_100: building('rf_well_100', [provides(AT_VEIN, EFFECT_TYPES.REFRESH, 100)]),
    rf_well_0: building('rf_well_0', [provides(AT_VEIN, EFFECT_TYPES.REFRESH, 0)]),
    rf_well_50: building('rf_well_50', [provides(AT_VEIN, EFFECT_TYPES.REFRESH, 50)]),
    rf_well_forestry: building('rf_well_forestry', [provides(AT_VEIN, EFFECT_TYPES.REFRESH, 100, { category: 'forestry' })]),
    rf_well_mining_tag: building('rf_well_mining_tag', [provides({ mode: 'tag', value: 'RfOre' }, EFFECT_TYPES.REFRESH, 100, { category: 'mining' })]),
    rf_jinx: building('rf_jinx', [provides(AT_VEIN, EFFECT_TYPES.FAIL_CHANCE, 100)]),
    rf_field: {
        id: 'rf_field', name: 'Test Field', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_farmland',
        requiresHero: true, field: {},
        config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_rf_field', keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }]
    },
    rf_field_well: building('rf_field_well', [provides({ mode: 'id', value: 'rf_field' }, EFFECT_TYPES.REFRESH, 100)])
});

/** A Hall star, rank 1 held, giving Refresh `value` % with the selector `to` (none: guild-wide). */
function holdStar(value, { to = null, category } = {}) {
    registerHallSky({
        constellations: { rf: { id: 'rf', name: 'Refresh', label: { x: 1, y: 0 } } },
        stars: {
            rf_star: {
                id: 'rf_star', constellation: 'rf', name: 'Fresh Seams', node: { x: 0.7, y: 0 }, links: [HALL_NODE],
                ranks: [{ tier: 1, price: [], lines: [], rules: [{
                    id: 'stm_rf_star', keyword: KEYWORD.PROVIDES, chargeDelta: 0, reach: 'board', target: null, when: null, upkeep: null,
                    to: to || { mode: 'all', value: '' },
                    payload: { type: EFFECT_TYPES.REFRESH, bucket: 'flat', value, ...(category ? { category } : {}) }
                }] }]
            }
        }
    });
    GuildUpgradeManager.getRanks().rf_star = 1;
    GuildUpgradeManager.recompute();
}

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 10, skills: out, hp: { current: 100, max: 100 } };
}

function put(typeId, at) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    const res = Placement.placeTokenAt(instance, at);
    expect(res?.success, res?.reason).not.toBe(false);
    TileModifiers.rebuildAround([instance]);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const VEIN = { x: 800, y: 500 };
const BESIDE = { x: 940, y: 500 };
const FAR = { x: 300, y: 300 };

/** Counts the vein's completed cycles and the charges it spent. */
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

/** A miner on a vein, with whatever stands beside it. */
function scene({ beside = null, typeId = 'rf_vein' } = {}) {
    const v = put(typeId, VEIN);
    if (beside) put(beside, BESIDE);
    Orders.orderAt('miner', VEIN);
    return v;
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
    Growth.resetGrowthAlerts();
    GameState.state.heroes = [hero('miner', { mining: 10 }), hero('farmer', { farming: 10 })];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    registerHallSky(null);
    HallRules.apply({});
});

describe('Refresh from a building beside the Token', () => {
    it('at 100 %, the vein works on and never spends a charge', () => {
        const v = scene({ beside: 'rf_well_100' });
        const seen = watch(v.id);
        run(8200);
        seen.off();
        expect(seen.cycles).toBeGreaterThanOrEqual(USES + 2);
        expect(seen.spent).toBe(0);
        expect(v.usesRemaining).toBe(USES);
        expect(Respawn.isResting(v)).toBe(false);
    });

    it('at 0 %, every cycle spends its charge, as with no rule', () => {
        const v = scene({ beside: 'rf_well_0' });
        const seen = watch(v.id);
        run(3200);
        seen.off();
        expect(seen.cycles).toBe(3);
        expect(seen.spent).toBe(3);
        expect(v.usesRemaining).toBe(USES - 3);
    });

    it('out of reach, it does nothing', () => {
        const v = put('rf_vein', VEIN);
        put('rf_well_100', FAR);
        Orders.orderAt('miner', VEIN);
        run(3200);
        expect(v.usesRemaining).toBe(USES - 3);
    });

    it('reaches only the Tokens its rule names', () => {
        const v = scene({ beside: 'rf_well_100', typeId: 'rf_other_vein' });
        run(3200);
        expect(v.usesRemaining).toBe(USES - 3);
    });

    it('narrowed to another skill, it does nothing', () => {
        const off = scene({ beside: 'rf_well_forestry' });
        run(3200);
        expect(off.usesRemaining).toBe(USES - 3);
    });

    it('aimed by tag and narrowed to the Token\'s own skill, it keeps every charge', () => {
        const v = scene({ beside: 'rf_well_mining_tag', typeId: 'rf_other_vein' });
        run(3200);
        expect(v.usesRemaining).toBe(USES);
    });
});

describe('Refresh from a Hall star', () => {
    it('aimed at the vein at 100 %, it never spends a charge', () => {
        holdStar(100, { to: AT_VEIN });
        const v = scene();
        run(8200);
        expect(v.usesRemaining).toBe(USES);
    });

    it('aimed at the vein at 0 %, every cycle spends its charge', () => {
        holdStar(0, { to: AT_VEIN });
        const v = scene();
        run(3200);
        expect(v.usesRemaining).toBe(USES - 3);
    });

    it('aimed at the vein, it leaves another vein alone', () => {
        holdStar(100, { to: AT_VEIN });
        const v = scene({ typeId: 'rf_other_vein' });
        run(3200);
        expect(v.usesRemaining).toBe(USES - 3);
    });

    it('guild-wide and narrowed to Mining, it reaches every mining Token; narrowed to Forestry, none', () => {
        holdStar(100, { category: 'mining' });
        const v = scene({ typeId: 'rf_other_vein' });
        run(3200);
        expect(v.usesRemaining).toBe(USES);

        holdStar(100, { category: 'forestry' });
        run(3000);
        expect(v.usesRemaining).toBe(USES - 3);
    });
});

describe('a failed cycle', () => {
    it('still burns its charge with Refresh at 100 % beside it', () => {
        const v = put('rf_vein', VEIN);
        put('rf_well_100', BESIDE);
        put('rf_jinx', { x: 800, y: 640 });
        Orders.orderAt('miner', VEIN);
        const seen = watch(v.id);
        run(3200);
        seen.off();
        expect(seen.failed).toBe(3);
        expect(v.usesRemaining).toBe(USES - 3);
    });

    it('draws nothing for Refresh: the same draws as without the rule', () => {
        const draws = (withRefresh) => {
            GameState.initNew();
            TileModifiers.clearAll();
            GameState.state.heroes = [hero('miner', { mining: 10 })];
            const v = put('rf_vein', VEIN);
            put('rf_jinx', BESIDE);
            if (withRefresh) put('rf_well_100', { x: 800, y: 640 });
            Orders.orderAt('miner', VEIN);
            const spy = vi.spyOn(Math, 'random');
            run(3200);
            const n = spy.mock.calls.length;
            spy.mockRestore();
            expect(v.usesRemaining).toBe(USES - 3);
            return n;
        };
        expect(draws(true)).toBe(draws(false));
    });
});

describe('⚠️ no rule, no draw', () => {
    /** Math.random draws over three cycles of a fresh vein, with `beside` next to it. */
    function drawsWith(beside, typeId = 'rf_vein', setUp = null) {
        GameState.initNew();
        TileModifiers.clearAll();
        GameState.state.heroes = [hero('miner', { mining: 10 })];
        setUp?.();
        const v = scene({ beside, typeId });
        const spy = vi.spyOn(Math, 'random');
        const seen = watch(v.id);
        run(3200);
        seen.off();
        const n = spy.mock.calls.length;
        spy.mockRestore();
        expect(seen.cycles).toBe(3);
        return n;
    }

    it('a rule offering Refresh draws exactly once per cycle; none, or one at 0 %, draws nothing for it', () => {
        const none = drawsWith(null);
        expect(drawsWith('rf_well_0')).toBe(none);
        expect(drawsWith('rf_well_100')).toBe(none + 3);
    });

    it('a Token with nothing to spend never rolls, even with a rule offering the chance', () => {
        const star = () => holdStar(100, { category: 'mining' });
        const clear = () => { registerHallSky(null); HallRules.apply({}); };
        const plain = drawsWith(null, 'rf_endless_vein');
        const starred = drawsWith(null, 'rf_endless_vein', star);
        clear();
        expect(starred).toBe(plain);
        // The same star on a vein that spends rolls once a cycle, so the rule did reach the work.
        const spending = drawsWith(null);
        expect(drawsWith(null, 'rf_vein', star)).toBe(spending + 3);
        clear();
    });
});

describe('a vein that rests', () => {
    it('rests later, never sooner: it rests only once five charges are spent, however many cycles that takes', () => {
        const v = scene({ beside: 'rf_well_50' });
        const seen = watch(v.id);
        let restedAfter = null;
        for (let t = 0; t < 40000 && restedAfter == null; t += 100) {
            BoardRunner.tick(100);
            if (Respawn.isResting(v)) restedAfter = seen.cycles;
        }
        seen.off();
        expect(restedAfter).not.toBeNull();
        expect(seen.spent).toBe(USES);
        expect(restedAfter).toBeGreaterThan(USES);
    });

    it('at 0 %, it rests after exactly five cycles, as without the rule', () => {
        const v = scene({ beside: 'rf_well_0' });
        const seen = watch(v.id);
        let restedAfter = null;
        for (let t = 0; t < 10000 && restedAfter == null; t += 100) {
            BoardRunner.tick(100);
            if (Respawn.isResting(v)) restedAfter = seen.cycles;
        }
        seen.off();
        expect(restedAfter).toBe(USES);
    });
});

describe('Refresh on a Field', () => {
    function ripeField(beside) {
        InventoryManager.addItem(SEED, 1);
        const field = put('rf_field', VEIN);
        if (beside) put(beside, BESIDE);
        expect(StationRecipe.setSelectedRecipe(field, WHEAT)).toBe(true);
        run(20200);
        expect(Fields.stageOf(field)).toBe(Fields.STAGE.RIPE);
        Orders.orderAt('farmer', VEIN);
        return field;
    }

    it('at 100 %, harvests never count down its load, and the seed it owed is paid once', () => {
        const field = ripeField('rf_field_well');
        expect(Fields.fieldState(field).load).toBe(3);
        run(6000);
        expect(InventoryManager.getItemCount(WHEAT_ITEM) + SpriteLayer.countOnBoard(WHEAT_ITEM)).toBeGreaterThanOrEqual(4);
        expect(Fields.fieldState(field)).toMatchObject({ stage: Fields.STAGE.RIPE, load: 3 });
        expect(field.field.seedOwed).toBeUndefined();
        expect(InventoryManager.getItemCount(SEED)).toBe(0);
    });

    it('without it, each harvest counts the load down', () => {
        const field = ripeField(null);
        run(2100);
        expect(Fields.fieldState(field).load).toBe(1);
    });
});

describe('Refresh as the CMS and the game say it', () => {
    it('is a Support chance in the palette, named Refresh, narrowed by skill, flat only', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.REFRESH);
        expect(entry).toMatchObject({ label: 'Refresh', shape: 'proc', categories: 'skill', buckets: ['flat'], group: 'Support' });
        expect(entry.hint).toMatch(/^A chance a cycle spends none of the Token's charges/);
        // What the CMS rule editor offers on a Provides (`paletteForKeyword`): Refresh among them.
        expect(paletteForKeyword(KEYWORD.PROVIDES, false).map(e => e.type)).toContain(EFFECT_TYPES.REFRESH);
    });

    it('tags a support "+25 % Refresh"', () => {
        expect(supportTag({ type: EFFECT_TYPES.REFRESH, bucket: 'flat', value: 25 })).toBe('+25 % Refresh');
    });
});

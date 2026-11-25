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
import * as Respawn from '../systems/board/Respawn.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { renderStatement, effectParts } from '../systems/effects/statementText.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { getPaletteEntry } from '../config/registries/modifierPalette.js';
import { effectTag } from '../config/registries/effectWords.js';
import { resetMatTuning } from '../config/matTuning.js';
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
 * Faith's blessings (T-705), the effects no building gives, carried by a shrine on the Tokens in its
 * reach while it is lit:
 * - **Can't Run Out** (`NEVER_RUNS_OUT`): a Token it reaches spends none of its charges on its own
 *   work, and a Field none of its load, failed cycles included, so it never runs out.
 * - **Echo** (`ECHO`): a chance a finished work cycle repeats at once, for free: its outputs again and
 *   its XP again, with no inputs, charges, load or tool wear, and no second cycle for the rules.
 * Blessings add up: two shrines' Echoes are one chance of their sum.
 */

const ORE = 'fixture_fb_ore';
const SEED = 'fixture_fb_seed';
const WHEAT = 'fixture_fb_wheat';
const COAL = 'fixture_fb_coal';
const BAR = 'fixture_fb_bar';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({
    [ORE]: item(ORE, 'Blessing Ore'), [SEED]: item(SEED, 'Blessing Seed'), [WHEAT]: item(WHEAT, 'Blessing Wheat'),
    [COAL]: item(COAL, 'Blessing Coal'), [BAR]: item(BAR, 'Blessing Bar')
});

const CROP = 'fb_recipe_wheat';
const SMELT = 'fb_recipe_bar';
registerRecipePools({
    farming: [{
        id: CROP, name: 'Blessing Wheat', levelRequirement: 1, durationMs: 1000, xp: 2, stationKinds: ['field'],
        inputs: [{ itemId: SEED, quantity: 1 }],
        outputs: [{ itemId: WHEAT, chance: 100, minQty: 1, maxQty: 1 }],
        crop: { growMs: 20000, load: 3 }
    }],
    smithing: [{
        id: SMELT, name: 'Blessing Bar', levelRequirement: 1, durationMs: 1000, xp: 5,
        inputs: [{ itemId: COAL, quantity: 2 }],
        outputs: [{ itemId: BAR, chance: 100, minQty: 1, maxQty: 1 }]
    }]
});

const USES = 3;
const vein = (id, extra = {}) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: USES, sprite: 's_nature',
    requiresHero: true,
    config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, xp: 3, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] },
    ...extra
});
let stm = 0;
const bless = (type, value, extra = {}) => ({
    id: `stm_fb_${++stm}`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
    payload: { type, bucket: 'flat', value, ...extra }
});
const shrine = (id, statements) => ({
    id, name: id, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_shrine_forge_major',
    requiresHero: true, shrine: { maxLitMs: 600_000 },
    config: { skill: 'faith', skillRequired: 1, cycleTimeMs: 2000, xp: 0, inputs: [], outputs: [] },
    statements: [{ id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'faith', stationKind: 'shrine' } }, ...statements]
});
registerTokenTypes({
    fb_vein: vein('fb_vein'),
    fb_jinx: { id: 'fb_jinx', name: 'Jinx', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false,
        statements: [bless(EFFECT_TYPES.FAIL_CHANCE, 100)] },
    fb_nature: shrine('fb_nature', [bless(EFFECT_TYPES.NEVER_RUNS_OUT, 1)]),
    fb_nature_forestry: shrine('fb_nature_forestry', [bless(EFFECT_TYPES.NEVER_RUNS_OUT, 1, { category: 'forestry' })]),
    fb_echo: shrine('fb_echo', [bless(EFFECT_TYPES.ECHO, 100)]),
    fb_echo_half: shrine('fb_echo_half', [bless(EFFECT_TYPES.ECHO, 50)]),
    fb_echo_none: shrine('fb_echo_none', [bless(EFFECT_TYPES.ECHO, 0)]),
    fb_field: {
        id: 'fb_field', name: 'Blessing Field', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_farmland',
        requiresHero: true, field: { startsWith: CROP },
        config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_fb_field', keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }]
    },
    fb_furnace: {
        id: 'fb_furnace', name: 'Blessing Furnace', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        requiresHero: true, config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 1000, xp: 0, inputs: [], outputs: [] },
        statements: [{ id: 'stm_fb_furnace', keyword: KEYWORD.STATION, payload: { skill: 'smithing' } }]
    }
});

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

/** A shrine beside the work, lit for ten minutes (the lighting itself is `FaithShrines.test.js`'). */
function litShrine(typeId, at = BESIDE) {
    const s = put(typeId, at);
    s.shrine = { litMs: 600_000 };
    TileModifiers.rebuildAll();
    return s;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const WORK = { x: 800, y: 500 };
const BESIDE = { x: 940, y: 500 };
const OTHER_SIDE = { x: 660, y: 500 };
const FAR = { x: 300, y: 300 };
const count = (itemId) => InventoryManager.getItemCount(itemId) + SpriteLayer.countOnBoard(itemId);
const xp = (heroId, skill) => GameState.state.heroes.find(h => h.id === heroId).skills[skill].xp;

/** The Token's completed cycles and the charges it spent. */
function watch(instanceId) {
    const seen = { cycles: 0, spent: 0 };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (e) => { if (e.instanceId === instanceId) seen.cycles += 1; }),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, (e) => { if (e.instanceId === instanceId && e.delta < 0) seen.spent -= e.delta; })
    ];
    seen.off = () => offs.forEach(off => off?.());
    return seen;
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
    GameState.state.heroes = [hero('miner', { mining: 10 }), hero('farmer', { farming: 10 }), hero('smith', { smithing: 10 })];
    GameState.state.inventory.maxSlots = 50;
});

describe('Can\'t Run Out: a lit shrine\'s nodes never run out', () => {
    it('a vein in its reach works on past its charges and spends none', () => {
        const v = put('fb_vein', WORK);
        litShrine('fb_nature');
        Orders.orderAt('miner', WORK);
        const seen = watch(v.id);
        run(USES * 1000 + 2200);
        seen.off();
        expect(seen.cycles).toBeGreaterThanOrEqual(USES + 2);
        expect(seen.spent).toBe(0);
        expect(BoardState.getTokenById(v.id)).toBe(v);
        expect(v.usesRemaining).toBe(USES);
    });

    it('even a failed cycle spends nothing', () => {
        const v = put('fb_vein', WORK);
        litShrine('fb_nature');
        put('fb_jinx', OTHER_SIDE);
        Orders.orderAt('miner', WORK);
        run(2200);
        expect(v.usesRemaining).toBe(USES);
        expect(count(ORE)).toBe(0);
    });

    it('a Field in its reach keeps its load', () => {
        const f = put('fb_field', WORK);
        litShrine('fb_nature');
        Orders.orderAt('farmer', WORK);
        InventoryManager.addItem(SEED, 1);
        run(5200);
        expect(Fields.stageOf(f)).toBe(Fields.STAGE.RIPE);
        expect(f.field.load).toBe(3);
        expect(count(WHEAT)).toBeGreaterThanOrEqual(5);
    });

    it('out of reach, out, or narrowed to another skill, the vein runs out as ever', () => {
        for (const setUp of [
            () => litShrine('fb_nature', FAR),
            () => put('fb_nature', BESIDE),
            () => litShrine('fb_nature_forestry')
        ]) {
            GameState.initNew();
            InventoryManager.init();
            TileModifiers.clearAll();
            GameState.state.heroes = [hero('miner', { mining: 10 })];
            const v = put('fb_vein', WORK);
            setUp();
            Orders.orderAt('miner', WORK);
            run(USES * 1000 + 200);
            expect(BoardState.getTokenById(v.id)).toBeNull();
        }
    });

    it('is offered on a rule with no number: it reads as what it does', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.NEVER_RUNS_OUT);
        expect(entry).toMatchObject({ label: 'Can\'t Run Out', flag: true });
        expect(paletteForKeyword(KEYWORD.PROVIDES, false, { onToken: true }).map(e => e.type)).toContain(EFFECT_TYPES.NEVER_RUNS_OUT);
        const payload = { type: EFFECT_TYPES.NEVER_RUNS_OUT, bucket: 'flat', value: 1 };
        expect(effectTag(entry, payload).text).toBe('Can\'t Run Out');
        expect(renderStatement({ keyword: KEYWORD.PROVIDES, reach: 'nearby', to: { mode: 'all', value: '' }, payload }))
            .toBe('Can\'t Run Out on every nearby Token.');
        expect(effectParts({ keyword: KEYWORD.PROVIDES, payload })).toBeNull();
    });
});

describe('Echo: a chance a finished cycle repeats at once, for free', () => {
    it('at 100 %, every cycle of a vein comes out twice, with its XP twice, and spends one charge', () => {
        const v = put('fb_vein', WORK);
        litShrine('fb_echo');
        Orders.orderAt('miner', WORK);
        const seen = watch(v.id);
        run(2200);
        seen.off();
        expect(seen.cycles).toBe(2);
        expect(seen.spent).toBe(2);
        expect(count(ORE)).toBe(4);
        expect(xp('miner', 'mining')).toBe(12);
    });

    it('an echoed station cycle pays its inputs once', () => {
        const furnace = put('fb_furnace', WORK);
        expect(StationRecipe.setSelectedRecipe(furnace, SMELT)).toBe(true);
        litShrine('fb_echo');
        InventoryManager.addItem(COAL, 10);
        Orders.orderAt('smith', WORK);
        run(1100);
        expect(count(COAL)).toBe(8);
        expect(count(BAR)).toBe(2);
        expect(xp('smith', 'smithing')).toBe(10);
    });

    it('a failed cycle never echoes', () => {
        put('fb_vein', WORK);
        litShrine('fb_echo');
        put('fb_jinx', OTHER_SIDE);
        Orders.orderAt('miner', WORK);
        run(1100);
        expect(count(ORE)).toBe(0);
        expect(xp('miner', 'mining')).toBe(0);
    });

    it('at 0 %, or from a shrine that is out, nothing repeats and nothing more is drawn than with no shrine', () => {
        const drawsWith = (setUp) => {
            GameState.initNew();
            InventoryManager.init();
            SpriteLayer.init();
            TileModifiers.clearAll();
            GameState.state.heroes = [hero('miner', { mining: 10 })];
            put('fb_vein', WORK);
            setUp();
            Orders.orderAt('miner', WORK);
            const draws = vi.spyOn(Math, 'random');
            run(1100);
            const calls = draws.mock.calls.length;
            draws.mockRestore();
            expect(count(ORE)).toBe(1);
            return calls;
        };
        const none = drawsWith(() => {});
        expect(drawsWith(() => litShrine('fb_echo_none'))).toBe(none);
        expect(drawsWith(() => put('fb_echo', BESIDE))).toBe(none);
    });

    it('blessings add up: two half chances are a sure echo', () => {
        put('fb_vein', WORK);
        litShrine('fb_echo_half');
        litShrine('fb_echo_half', OTHER_SIDE);
        Orders.orderAt('miner', WORK);
        run(3200);
        expect(count(ORE)).toBe(6);
    });

    it('echoes are said on the mat, and the rules hear one cycle', () => {
        const v = put('fb_vein', WORK);
        const s = litShrine('fb_echo');
        Orders.orderAt('miner', WORK);
        const fired = [];
        const off = EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => { if (p.instanceId === v.id) fired.push(p); });
        const seen = watch(v.id);
        run(1100);
        off();
        seen.off();
        expect(seen.cycles).toBe(1);
        expect(fired).toEqual([expect.objectContaining({ instanceId: v.id, echo: true, fromTokenId: s.id })]);
    });

    it('is offered as a chance and reads as what it does', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.ECHO);
        expect(entry).toMatchObject({ label: 'Echo', shape: 'proc' });
        const payload = { type: EFFECT_TYPES.ECHO, bucket: 'flat', value: 10 };
        expect(effectTag(entry, payload).text).toBe('Echo 10%');
        expect(renderStatement({ keyword: KEYWORD.PROVIDES, reach: 'nearby', to: { mode: 'all', value: '' }, payload }))
            .toBe('Echo 10% on every nearby Token.');
        expect(effectParts({ keyword: KEYWORD.PROVIDES, payload })).toEqual({
            before: 'have a', size: '10%', after: 'chance a finished cycle repeats at once, for free'
        });
    });
});

describe('a resting vein stays a resting vein', () => {
    it('Respawn is untouched: a blessed vein never rests', () => {
        const v = put('fb_vein', WORK);
        litShrine('fb_nature');
        Orders.orderAt('miner', WORK);
        run(USES * 1000 + 1200);
        expect(Respawn.isResting(v)).toBe(false);
    });
});

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
import * as EndRoll from '../systems/board/endRoll.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { withoutShippedPerks } from './fixtures/noPerks.js';

withoutShippedPerks();

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
vi.mock('../systems/board/endRoll.js', async (importOriginal) => {
    const real = await importOriginal();
    return { ...real, endsNow: vi.fn(real.endsNow) };
});

/**
 * Faith's blessings on the gathering sources that end by chance, fish, and build:
 * - **Can't Run Out** keeps a vein, a tree and a ripe Field from ending: the cycle spends nothing,
 *   so it draws no chance to end (`endRoll.endsNow` is never asked), failed cycles included.
 * - **Echo**'s free repeat lands the cycle's outputs and XP again and nothing else: it draws no
 *   chance to end, spends no Bait and rolls no lure's break at a water, teaches the fish's own XP
 *   once more, and never builds twice.
 */

const realEnds = (await vi.importActual('../systems/board/endRoll.js')).endsNow;

const item = (id, name, extra = {}) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1, ...extra
});
const ORE = 'fixture_fbg_ore';
const LOG = 'fixture_fbg_log';
const GRAIN = 'fixture_fbg_grain';
const EEL = 'fixture_fbg_eel';
const BAIT = 'fixture_fbg_bait';
const LURE = 'fixture_fbg_eel_lure';
const ROD = 'fixture_fbg_rod';
registerItems({
    [ORE]: item(ORE, 'Gathering Ore'),
    [LOG]: item(LOG, 'Gathering Log'),
    [GRAIN]: item(GRAIN, 'Gathering Grain'),
    [EEL]: item(EEL, 'Gathering Eel', { sprite: 'i_trout_raw', fish: { level: 1, bait: 1, xp: 7 } }),
    [BAIT]: item(BAIT, 'Gathering Bait', { equipSlot: 'consumable', sprite: 'i_fish_bait' }),
    [LURE]: item(LURE, 'Gathering Eel Lure', { equipSlot: 'consumable', sprite: 'i_fish_bait', lure: { fish: [EEL], breakChance: 100 } }),
    [ROD]: { id: ROD, name: 'Gathering Rod', type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_rod_wood', tool: { kind: 'fishing_rod', tier: 1 } }
});

const SURE_CROP = 'fbg_recipe_sure_grain';
const CHANCY_CROP = 'fbg_recipe_chancy_grain';
const crop = (id, endChance) => ({
    id, name: id, levelRequirement: 1, durationMs: 1000, xp: 2, stationKinds: ['field'],
    inputs: [], outputs: [{ itemId: GRAIN, chance: 100, minQty: 1, maxQty: 1 }],
    crop: { growMs: 20000, endChance }
});
const DIG = 'fbg_recipe_dig_vein';
registerRecipePools({
    farming: [crop(SURE_CROP, 100), crop(CHANCY_CROP, 50)],
    construction: [{
        id: DIG, name: 'Dig a Vein', levelRequirement: 1, foundationKinds: ['fbg_dig'], inputs: [],
        outputs: [{ tokenId: 'fbg_sure_vein', chance: 100, minQty: 1, maxQty: 1 }], durationMs: 1000, xp: 4
    }]
});

const resource = (id, extra) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 's_nature', requiresHero: true, ...extra
});
const mining = { skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, xp: 3, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] };
const logging = { skill: 'forestry', skillRequired: 1, cycleTimeMs: 1000, xp: 3, inputs: [], outputs: [{ itemId: LOG, chance: 100, minQty: 1, maxQty: 1 }] };
const refill = { mode: 'refill', afterMs: 60000 };
let stm = 0;
const bless = (type, value) => ({
    id: `stm_fbg_${++stm}`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
    payload: { type, bucket: 'flat', value }
});
const shrine = (id, statements) => ({
    id, name: id, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_shrine_forge_major',
    requiresHero: true, shrine: { maxLitMs: 600_000 },
    config: { skill: 'faith', skillRequired: 1, cycleTimeMs: 2000, xp: 0, inputs: [], outputs: [] },
    statements: [{ id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'faith', stationKind: 'shrine' } }, ...statements]
});
const field = (id, startsWith) => ({
    id, name: id, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_farmland',
    requiresHero: true, field: { startsWith },
    config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
    statements: [{ id: `stm_${id}`, keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }]
});
registerTokenTypes({
    // Ends at its first spend, unless nothing is spent.
    fbg_sure_vein: resource('fbg_sure_vein', { endChance: 100, config: mining, respawn: refill }),
    fbg_chancy_vein: resource('fbg_chancy_vein', { endChance: 50, config: mining, respawn: refill }),
    fbg_tree: resource('fbg_tree', { endChance: 100, config: logging, respawn: { mode: 'regrow', into: 'fbg_stump' } }),
    fbg_stump: resource('fbg_stump', { uses: null, config: null, grows: { into: 'fbg_tree', afterMs: 600000 } }),
    fbg_sure_field: field('fbg_sure_field', SURE_CROP),
    fbg_chancy_field: field('fbg_chancy_field', CHANCY_CROP),
    fbg_pond: resource('fbg_pond', {
        uses: null, sprite: 't_lake_small', tags: ['water'],
        catchPools: [{ tool: 'fishing_rod', bait: BAIT, catches: [{ itemId: EEL, weight: 1 }] }],
        config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] }
    }),
    fbg_dig_site: {
        id: 'fbg_dig_site', name: 'Dig Site', rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'fbg_dig', skill: 'construction' }
    },
    fbg_jinx: {
        id: 'fbg_jinx', name: 'Jinx', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        requiresHero: false, statements: [bless(EFFECT_TYPES.FAIL_CHANCE, 100)]
    },
    fbg_nature: shrine('fbg_nature', [bless(EFFECT_TYPES.NEVER_RUNS_OUT, 1)]),
    fbg_echo: shrine('fbg_echo', [bless(EFFECT_TYPES.ECHO, 100)])
});

function hero(id, skills, grid = []) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    const equipment = Array.from({ length: 9 }, (_, i) => grid[i] || null);
    const heldCopies = equipment.map(itemId => !!itemId && getAllItems()[itemId]?.equipSlot === 'hand');
    return { id, name: id, status: 'idle', level: 10, skills: out, hp: { current: 100, max: 100 }, equipment, heldCopies };
}

function put(typeId, at) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    const res = Placement.placeTokenAt(instance, at);
    expect(res?.success, res?.reason).not.toBe(false);
    TileModifiers.rebuildAround([instance]);
    return instance;
}

const WORK = { x: 800, y: 500 };
const BESIDE = { x: 940, y: 500 };
const OTHER_SIDE = { x: 660, y: 500 };

/** A shrine beside the work, lit for ten minutes, or out when `lit` is false. */
function shrineBeside(typeId, { at = BESIDE, lit = true } = {}) {
    const s = put(typeId, at);
    if (lit) s.shrine = { litMs: 600_000 };
    TileModifiers.rebuildAll();
    return s;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const count = (itemId) => InventoryManager.getItemCount(itemId) + SpriteLayer.countOnBoard(itemId);
const xp = (heroId, skill) => GameState.state.heroes.find(h => h.id === heroId).skills[skill].xp;
/** How many times a chance to end was asked since the last `rolls.clear()`. */
const rolls = { get count() { return EndRoll.endsNow.mock.calls.length; }, clear: () => EndRoll.endsNow.mockClear() };

/** The Token's completed cycles while `fn` runs. */
function cyclesOf(instanceId, fn) {
    let cycles = 0;
    const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (e) => { if (e.instanceId === instanceId) cycles += 1; });
    try { fn(); } finally { off(); }
    return cycles;
}

beforeAll(() => { Flags.init(); TimedChanges.init(); });
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    EndRoll.endsNow.mockImplementation(realEnds);
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
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [
        hero('miner', { mining: 5 }), hero('logger', { forestry: 5 }), hero('farmer', { farming: 5 }),
        hero('builder', { construction: 5 }), hero('fisher', { fishing: 5 }, [ROD, BAIT, LURE])
    ];
});

describe('Can\'t Run Out: a source that ends by chance never draws its end', () => {
    it('without the blessing, a sure vein ends at its first cycle (the control)', () => {
        const v = put('fbg_sure_vein', WORK);
        shrineBeside('fbg_nature', { lit: false });
        Orders.orderAt('miner', WORK);
        rolls.clear();
        run(1100);
        expect(rolls.count).toBe(1);
        expect(Respawn.isResting(v)).toBe(true);
    });

    it('a vein in its reach works on and never asks for its chance to end', () => {
        const v = put('fbg_sure_vein', WORK);
        shrineBeside('fbg_nature');
        Orders.orderAt('miner', WORK);
        rolls.clear();
        const cycles = cyclesOf(v.id, () => run(5200));
        expect(cycles).toBe(5);
        expect(rolls.count).toBe(0);
        expect(Respawn.isResting(v)).toBe(false);
        expect(count(ORE)).toBe(5);
    });

    it('nor does a failed cycle', () => {
        const v = put('fbg_sure_vein', WORK);
        shrineBeside('fbg_nature');
        put('fbg_jinx', OTHER_SIDE);
        Orders.orderAt('miner', WORK);
        rolls.clear();
        const cycles = cyclesOf(v.id, () => run(2200));
        expect(cycles).toBe(2);
        expect(rolls.count).toBe(0);
        expect(Respawn.isResting(v)).toBe(false);
    });

    it('a tree in its reach is never felled to its Stump', () => {
        const tree = put('fbg_tree', WORK);
        shrineBeside('fbg_nature');
        Orders.orderAt('logger', WORK);
        rolls.clear();
        run(3200);
        expect(rolls.count).toBe(0);
        expect(BoardState.getTokenById(tree.id)?.typeId).toBe('fbg_tree');
        expect(count(LOG)).toBe(3);
    });

    it('a ripe Field in its reach never draws its crop\'s finish', () => {
        const f = put('fbg_sure_field', WORK);
        shrineBeside('fbg_nature');
        Orders.orderAt('farmer', WORK);
        run(1000);
        expect(Fields.stageOf(f)).toBe(Fields.STAGE.RIPE);
        rolls.clear();
        run(4200);
        expect(rolls.count).toBe(0);
        expect(Fields.stageOf(f)).toBe(Fields.STAGE.RIPE);
        expect(count(GRAIN)).toBeGreaterThanOrEqual(4);
    });

    it('a vein a gathering Foundation digs in its reach never ends either', () => {
        const site = put('fbg_dig_site', WORK);
        expect(StationRecipe.setSelectedRecipe(site, DIG)).toBe(true);
        shrineBeside('fbg_nature');
        Orders.orderAt('builder', WORK);
        run(1100);
        const vein = BoardState.tokens().find(t => t.typeId === 'fbg_sure_vein');
        expect(vein).toBeTruthy();
        Orders.orderAt('miner', WORK);
        rolls.clear();
        run(3200);
        expect(rolls.count).toBe(0);
        expect(Respawn.isResting(vein)).toBe(false);
    });
});

describe('Echo: the free repeat draws no chance to end', () => {
    it('an echoed vein cycle asks for its end once, for the cycle that spent', () => {
        EndRoll.endsNow.mockImplementation(() => false);
        const v = put('fbg_chancy_vein', WORK);
        shrineBeside('fbg_echo');
        Orders.orderAt('miner', WORK);
        rolls.clear();
        const cycles = cyclesOf(v.id, () => run(2200));
        expect(cycles).toBe(2);
        expect(count(ORE)).toBe(4);
        expect(rolls.count).toBe(2);
    });

    it('an echoed Field harvest asks for its crop\'s finish once', () => {
        EndRoll.endsNow.mockImplementation(() => false);
        const f = put('fbg_chancy_field', WORK);
        shrineBeside('fbg_echo');
        Orders.orderAt('farmer', WORK);
        run(1000);
        expect(Fields.stageOf(f)).toBe(Fields.STAGE.RIPE);
        rolls.clear();
        const before = count(GRAIN);
        run(2200);
        expect(count(GRAIN) - before).toBe(4);
        expect(rolls.count).toBe(2);
    });

    it('beside Can\'t Run Out as well, nothing is asked at all', () => {
        const v = put('fbg_sure_vein', WORK);
        shrineBeside('fbg_echo');
        shrineBeside('fbg_nature', { at: OTHER_SIDE });
        Orders.orderAt('miner', WORK);
        rolls.clear();
        run(3200);
        expect(rolls.count).toBe(0);
        expect(Respawn.isResting(v)).toBe(false);
        expect(count(ORE)).toBe(6);
    });
});

describe('Echo at a water and at a Foundation', () => {
    it('an echoed catch lands the fish again and teaches its own XP again, spending one Bait and breaking one lure', () => {
        put('fbg_pond', WORK);
        shrineBeside('fbg_echo');
        InventoryManager.addItem(BAIT, 10);
        InventoryManager.addItem(LURE, 3);
        Orders.orderAt('fisher', WORK);
        run(1100);
        expect(count(EEL)).toBe(2);
        expect(xp('fisher', 'fishing')).toBe(14);
        expect(InventoryManager.getItemCount(BAIT)).toBe(9);
        expect(InventoryManager.getItemCount(LURE)).toBe(2);
    });

    it('a build in its reach builds once and teaches once', () => {
        const site = put('fbg_dig_site', WORK);
        expect(StationRecipe.setSelectedRecipe(site, DIG)).toBe(true);
        shrineBeside('fbg_echo');
        Orders.orderAt('builder', WORK);
        run(1100);
        expect(BoardState.tokens().filter(t => t.typeId === 'fbg_sure_vein')).toHaveLength(1);
        expect(BoardState.tokens().filter(t => t.typeId === 'fbg_dig_site')).toHaveLength(0);
        expect(xp('builder', 'construction')).toBe(4);
    });
});

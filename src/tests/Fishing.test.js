import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as Flags from '../systems/board/Flags.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import * as Charges from '../systems/board/Charges.js';
import * as Fishing from '../systems/board/Fishing.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, getTokenType, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { MAX_SPEED_UP_CUT } from '../config/loopConstants.js';
import {
    catchPoolsOf, hasCatchPools, catchToolKinds, poolFor, baitsFor, catchItemIds, baitItemIds, pickCatchIndex
} from '../config/registries/catchPools.js';
import { TOOL_KINDS, neededToolOf, toolMeets, toolNeedPhrase, toolItemFor } from '../config/registries/toolKinds.js';
import { deriveTokenType } from '../config/registries/tokenTypeDerivation.js';
import { neverWearsReason, NEVER_WEARS } from '../systems/core/wearRule.js';
import { toolFindings } from '../systems/core/toolRule.js';
import { rulesLinesOf } from '../systems/effects/statementText.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { problemText } from '../ui/components/board/problemMark.js';
import { tokenCardModel, CARD_BLOCK } from '../ui/components/board/tokenCard.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Brief 230 S5, Fishing (owner rulings 2026-10-24): water never runs out and does not shift;
 * each water's catch pools, per tool kind and bait, are weighted and authored; no bait gives the
 * basic pool; the tool kind picks the pool and a tool's tier never gates, a better rod carrying its
 * own bonus (more weight on a rare fish); bait is carried in a consumable cell, one spent per catch,
 * and when it runs out the hero fishes plain; a Dock in reach speeds fishing to the standard floor;
 * a hero holding a rod and a net fishes with the first hand's tool.
 */

const material = (id, name) => ({ id, name, type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw' });
const tool = (id, name, kind, tier = 1, extra = {}) => ({
    id, name, type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_rod_wood', tool: { kind, tier }, ...extra
});

registerEffects({
    s5_fx_dolphin_lure: {
        id: 's5_fx_dolphin_lure', name: 'Dolphin Lure',
        statements: [{ id: 'stm_s5_lure', keyword: 'provides', to: null,
            payload: { type: EFFECT_TYPES.CATCH_WEIGHT, bucket: 'percentage', value: 9, category: 's5_dolphin' } }]
    }
});

registerItems({
    s5_trout: material('s5_trout', 'Trout'),
    s5_salmon: material('s5_salmon', 'Salmon'),
    s5_dolphin: material('s5_dolphin', 'Dolphin'),
    s5_shrimp: material('s5_shrimp', 'Shrimp'),
    s5_crab: material('s5_crab', 'Crab'),
    s5_worm: { id: 's5_worm', name: 'Worm', type: 'material', stackable: true, equipSlot: 'consumable', sprite: 'i_fish_bait' },
    s5_squid: { id: 's5_squid', name: 'Squid Bait', type: 'material', stackable: true, equipSlot: 'consumable', sprite: 'i_fish_bait' },
    s5_bread_bait: { id: 's5_bread_bait', name: 'Bread Bait', type: 'food', stackable: true, equipSlot: 'food', sprite: 'i_fish_bait' },
    s5_rod: tool('s5_rod', 'Wooden Rod', 'fishing_rod', 1),
    s5_fine_rod: tool('s5_fine_rod', 'Fine Rod', 'fishing_rod', 3, { effects: [{ effectId: 's5_fx_dolphin_lure' }] }),
    s5_net: tool('s5_net', 'Fishing Net', 'fishing_net', 1),
    s5_trap: tool('s5_trap', 'Crab Trap', 'fishing_trap', 1),
    s5_pick: tool('s5_pick', 'Pickaxe', 'pickaxe', 1)
});

const LAKE_POOLS = [
    { tool: 'fishing_rod', catches: [{ itemId: 's5_trout', weight: 50 }, { itemId: 's5_salmon', weight: 40 }, { itemId: 's5_dolphin', weight: 10 }] },
    { tool: 'fishing_rod', bait: 's5_worm', catches: [{ itemId: 's5_salmon', weight: 1 }] },
    { tool: 'fishing_net', catches: [{ itemId: 's5_shrimp', weight: 1 }] }
];

const water = (id, name, pools, extra = {}) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 't_lake_small', requiresHero: true,
    tags: ['water'], catchPools: pools,
    config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
    ...extra
});
const buff = (id, payload, to) => ({
    id, name: id, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false,
    statements: [{ id: `stm_${id}`, keyword: 'provides', to, payload }]
});

registerTokenTypes({
    // Authored with 5000 charges, Outputs and a Needs tool on purpose: the pools win over all three.
    s5_lake: water('s5_lake', 'Lake', LAKE_POOLS, {
        uses: 5000,
        needsTool: { kind: 'pickaxe', minTier: 4 },
        config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [],
            outputs: [{ itemId: 'fixture_copper_ore', chance: 100, minQty: 1, maxQty: 1 }] }
    }),
    s5_slow_lake: water('s5_slow_lake', 'Slow Lake', LAKE_POOLS, {
        uses: null, config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [] }
    }),
    s5_pond: water('s5_pond', 'Pond', [{ tool: 'fishing_net', catches: [{ itemId: 's5_shrimp', weight: 1 }] }], { uses: null }),
    // A trap catches only with bait here: an authoring slip the audit names.
    s5_sea: water('s5_sea', 'Sea', [{ tool: 'fishing_trap', bait: 's5_squid', catches: [{ itemId: 's5_crab', weight: 1 }] }], { uses: null }),
    s5_dock: buff('s5_dock', { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.5 }, { mode: 'tag', value: 'water' }),
    s5_jinx: buff('s5_jinx', { type: EFFECT_TYPES.FAIL_CHANCE, bucket: 'flat', value: 100 }, { mode: 'tag', value: 'water' }),
    // An old save's Coast after the content pack: water, no turns. And the Shrimp Coast it once turned into.
    s5_coast: water('s5_coast', 'Coast', LAKE_POOLS, { uses: 5000 }),
    s5_shrimp_coast: {
        id: 's5_shrimp_coast', name: 'Shrimp Coast', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 1000,
        sprite: 't_coast_shrimp', requiresHero: true, needsTool: { kind: 'fishing_rod', minTier: 1 },
        config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [],
            outputs: [{ itemId: 's5_shrimp', chance: 100, minQty: 1, maxQty: 1 }] }
    }
});

const LAKE = { x: 600, y: 500 };

function hero(id, grid = []) {
    const equipment = Array.from({ length: 9 }, (_, i) => grid[i] || null);
    // Tools are the hero's own copies; consumables name a Bank stack.
    const heldCopies = equipment.map(itemId => !!itemId && getAllItems()[itemId]?.equipSlot === 'hand');
    return { id, name: id, status: 'idle', level: 10, skills: { fishing: { level: 10, xp: 0 }, mining: { level: 10, xp: 0 } },
        hp: { current: 100, max: 100 }, equipment, heldCopies };
}
const setHeroes = (...heroes) => { GameState.state.heroes = heroes; };

function put(typeId, at = LAKE) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    const res = Placement.placeTokenAt(instance, at);
    expect(res?.success, res?.reason).not.toBe(false);
    return instance;
}

const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };

/** What landed, per finished cycle at `instance`, while `fn` runs. */
function catchesOf(instance, fn) {
    const landed = [];
    const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p?.instanceId === instance.id) landed.push(p.produced.join('+') || '-'); });
    try { fn(); } finally { off(); }
    return landed;
}

/** A seeded stream (mulberry32). */
function seeded(seed = 1) {
    let s = seed;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardRunner.init();
    Flags.init();
    TileModifiers.clearAll();
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [];
});

describe('the catch pools, as content', () => {
    it('reads usable pools in order: a tool, a catch with a weight; a repeat of a tool and bait is dropped', () => {
        const def = { catchPools: [
            { tool: 'fishing_rod', catches: [{ itemId: 'a', weight: 2 }, { itemId: 'b', weight: 0 }, { itemId: '', weight: 3 }] },
            { tool: '', catches: [{ itemId: 'x', weight: 1 }] },
            { tool: 'fishing_net', catches: [] },
            { tool: 'fishing_rod', bait: 'w', catches: [{ itemId: 'c', weight: 1 }] },
            { tool: 'fishing_rod', catches: [{ itemId: 'dup', weight: 1 }] }
        ] };
        expect(catchPoolsOf(def)).toEqual([
            { tool: 'fishing_rod', bait: null, catches: [{ itemId: 'a', weight: 2 }] },
            { tool: 'fishing_rod', bait: 'w', catches: [{ itemId: 'c', weight: 1 }] }
        ]);
        expect(hasCatchPools(def)).toBe(true);
        expect(hasCatchPools({ catchPools: [] })).toBe(false);
        expect(hasCatchPools({})).toBe(false);
        expect(catchToolKinds(def)).toEqual(['fishing_rod']);
        expect(poolFor(def, 'fishing_rod').catches[0].itemId).toBe('a');
        expect(poolFor(def, 'fishing_rod', 'w').catches[0].itemId).toBe('c');
        expect(poolFor(def, 'fishing_net')).toBeNull();
        expect(baitsFor(def, 'fishing_rod')).toEqual(['w']);
        expect(catchItemIds(getTokenType('s5_lake'))).toEqual(['s5_trout', 's5_salmon', 's5_dolphin', 's5_shrimp']);
        expect(baitItemIds(getTokenType('s5_lake'))).toEqual(['s5_worm']);
    });

    it('a pick draws once from a pool of several and never from a pool of one; nothing bites at no weight', () => {
        let draws = 0;
        const counted = (value) => () => { draws++; return value; };
        expect(pickCatchIndex([50, 40, 10], counted(0.0))).toBe(0);
        expect(pickCatchIndex([50, 40, 10], counted(0.55))).toBe(1);
        expect(pickCatchIndex([50, 40, 10], counted(0.95))).toBe(2);
        expect(draws).toBe(3);
        expect(pickCatchIndex([0, 7, -1], counted(0.5))).toBe(1);
        expect(pickCatchIndex([0, 0], counted(0.5))).toBeNull();
        expect(draws).toBe(3);
    });
});

describe('the tool: any kind a pool names, at any tier', () => {
    it('six kinds; water needs any of its pools\' kinds, whatever its own Needs tool says', () => {
        expect(TOOL_KINDS.map(k => k.id)).toEqual(['pickaxe', 'woodaxe', 'fishing_rod', 'sickle', 'fishing_net', 'fishing_trap']);
        const need = neededToolOf(getTokenType('s5_lake'));
        expect(need).toEqual({ kind: 'fishing_rod', kinds: ['fishing_rod', 'fishing_net'], minTier: 1 });
        expect(toolMeets({ kind: 'fishing_rod', tier: 1 }, need)).toBe(true);
        expect(toolMeets({ kind: 'fishing_net', tier: 1 }, need)).toBe(true);
        expect(toolMeets({ kind: 'pickaxe', tier: 9 }, need)).toBe(false);
        expect(toolNeedPhrase(need)).toBe('Fishing Rod or Fishing Net');
        expect(toolNeedPhrase({ kind: 'fishing_rod', kinds: ['fishing_rod', 'fishing_net', 'fishing_trap'], minTier: 1 }))
            .toBe('Fishing Rod, Fishing Net or Trap');
        expect(toolNeedPhrase(neededToolOf(getTokenType('s5_pond')))).toBe('Fishing Net');
        const all = getAllItems();
        expect(toolItemFor(need, { s5_net: all.s5_net, s5_fine_rod: all.s5_fine_rod, s5_rod: all.s5_rod })).toBe('s5_rod');
        expect(toolItemFor(need, { s5_net: all.s5_net })).toBe('s5_net');
        // A Token with no pools keeps its own need.
        expect(neededToolOf(getTokenType('s5_shrimp_coast'))).toEqual({ kind: 'fishing_rod', minTier: 1 });
    });

    it('a net, or any rod, works the lake; a pickaxe does not, and the mark says what will', () => {
        const lake = put('s5_lake');
        const config = getTokenType('s5_lake').config;
        setHeroes(hero('pick', ['s5_pick']), hero('net', ['s5_net']), hero('fine', ['s5_fine_rod']));
        expect(WorkCheck.heroReason('pick', config, lake)).toBe(ALERT.NO_TOOL);
        expect(WorkCheck.heroReason('net', config, lake)).toBeNull();
        expect(WorkCheck.heroReason('fine', config, lake)).toBeNull();
        expect(problemText({ kind: ALERT.NO_TOOL }, lake.id)).toBe('Needs Fishing Rod or Fishing Net');
    });

    it('a hero holding a rod and a net fishes with the first hand\'s tool, wherever the water has a pool for it', () => {
        put('s5_lake');
        const lake = getTokenType('s5_lake');
        setHeroes(hero('rodFirst', ['s5_rod', 's5_net']), hero('netFirst', ['s5_net', 's5_rod']));
        expect(Fishing.fishingOf(lake, 'rodFirst').tool.kind).toBe('fishing_rod');
        expect(Fishing.fishingOf(lake, 'netFirst').tool.kind).toBe('fishing_net');
        // The pond has only a net pool: the rod in the first hand stands aside.
        expect(Fishing.fishingOf(getTokenType('s5_pond'), 'rodFirst').tool.kind).toBe('fishing_net');
    });
});

describe('a cycle at the water lands one catch from the pool', () => {
    it('the catch replaces the Token\'s own Outputs: a rod with no bait lands only the basic pool\'s fish', () => {
        const lake = put('s5_lake');
        setHeroes(hero('fisher', ['s5_rod']));
        Orders.orderAt('fisher', LAKE);
        const landed = catchesOf(lake, () => run(40_000));
        expect(landed.length).toBeGreaterThanOrEqual(30);
        expect(new Set(landed)).not.toContain('fixture_copper_ore');
        for (const item of landed) expect(['s5_trout', 's5_salmon', 's5_dolphin']).toContain(item);
    });

    it('a rare catch drops like any other item: no rare-drop signal, however small its share (owner, 2026-10-24)', () => {
        const lake = put('s5_lake');
        setHeroes(hero('fisher', ['s5_rod']));
        Orders.orderAt('fisher', LAKE);
        let rare = 0;
        const off = EventBus.subscribe(BOARD_EVENTS.RARE_DROP, () => { rare++; });
        let landed;
        try { landed = catchesOf(lake, () => run(120_000)); } finally { off(); }
        expect(landed).toContain('s5_dolphin');
        expect(rare).toBe(0);
    });

    it('the shares follow the weights (50 / 40 / 10), and a better rod\'s Catch Weight puts more on the Dolphin', () => {
        put('s5_lake');
        const lake = getTokenType('s5_lake');
        const id = BoardState.tokens()[0].id;
        const shares = (heroId) => {
            setHeroes(hero(heroId, [heroId === 'fine' ? 's5_fine_rod' : 's5_rod']));
            // Tests arrive the moment they claim (`setInstantArrival`): the hero works the lake now.
            BoardState.setClaim(heroId, { instanceId: id, typeId: 's5_lake', x: LAKE.x, y: LAKE.y });
            expect(BoardState.workerOf(id)).toBe(heroId);
            const random = seeded(11);
            const n = { s5_trout: 0, s5_salmon: 0, s5_dolphin: 0 };
            for (let i = 0; i < 4000; i++) n[Fishing.catchOf(id, lake, heroId, random).itemId]++;
            BoardState.setClaim(heroId, null);
            return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, v / 4000]));
        };
        const plain = shares('plain');
        expect(plain.s5_trout).toBeCloseTo(0.5, 1);
        expect(plain.s5_salmon).toBeCloseTo(0.4, 1);
        expect(plain.s5_dolphin).toBeCloseTo(0.1, 1);
        // +900 % on the Dolphin's 10: 100 of 190.
        const fine = shares('fine');
        expect(fine.s5_dolphin).toBeCloseTo(100 / 190, 1);
        expect(fine.s5_trout).toBeCloseTo(50 / 190, 1);
    });

    it('bait in a consumable cell: one spent per catch, the bait\'s pool while it lasts, then plain', () => {
        const lake = put('s5_lake');
        setHeroes(hero('fisher', ['s5_rod', 's5_worm']));
        InventoryManager.addItem('s5_worm', 3);
        Orders.orderAt('fisher', LAKE);
        const landed = catchesOf(lake, () => run(30_000));
        expect(landed.slice(0, 3)).toEqual(['s5_salmon', 's5_salmon', 's5_salmon']);
        expect(InventoryManager.getItemCount('s5_worm')).toBe(0);
        // Then the basic pool: Trout and Dolphin bite again.
        expect(landed.slice(3).some(item => item !== 's5_salmon')).toBe(true);
        expect(landed.length).toBeGreaterThanOrEqual(20);
    });

    it('bait the Bank does not hold, or carried in the food cell, is no bait', () => {
        put('s5_lake');
        const lake = getTokenType('s5_lake');
        setHeroes(hero('empty', ['s5_rod', 's5_worm']), hero('food', ['s5_rod', 's5_bread_bait']));
        expect(Fishing.fishingOf(lake, 'empty').bait).toBeNull();
        InventoryManager.addItem('s5_bread_bait', 5);
        const odd = { ...LAKE_POOLS[1], bait: 's5_bread_bait' };
        const def = { ...lake, catchPools: [LAKE_POOLS[0], odd] };
        expect(Fishing.fishingOf(def, 'food').bait).toBeNull();
        InventoryManager.addItem('s5_worm', 1);
        expect(Fishing.fishingOf(lake, 'empty').bait).toBe('s5_worm');
    });

    it('a net fishes the net pool; a trap with no bait where only a baited trap pool exists catches nothing and spends nothing', () => {
        const lake = put('s5_lake');
        const sea = put('s5_sea', { x: 1400, y: 500 });
        setHeroes(hero('netter', ['s5_net']), hero('trapper', ['s5_trap']));
        Orders.orderAt('netter', LAKE);
        Orders.orderAt('trapper', { x: 1400, y: 500 });
        let seaLanded;
        const lakeLanded = catchesOf(lake, () => { seaLanded = catchesOf(sea, () => run(10_000)); });
        expect(new Set(lakeLanded)).toEqual(new Set(['s5_shrimp']));
        expect(seaLanded.length).toBeGreaterThan(0);
        expect(new Set(seaLanded)).toEqual(new Set(['-']));
        InventoryManager.addItem('s5_squid', 2);
        GameState.state.heroes.find(h => h.id === 'trapper').equipment[1] = 's5_squid';
        const baited = catchesOf(sea, () => run(5_000));
        expect(baited.slice(0, 2)).toEqual(['s5_crab', 's5_crab']);
        expect(InventoryManager.getItemCount('s5_squid')).toBe(0);
    });

    it('a failed cycle catches nothing and keeps its bait', () => {
        const lake = put('s5_lake');
        put('s5_jinx', { x: LAKE.x + 160, y: LAKE.y });
        TileModifiers.rebuildAll();
        setHeroes(hero('fisher', ['s5_rod', 's5_worm']));
        InventoryManager.addItem('s5_worm', 3);
        Orders.orderAt('fisher', LAKE);
        const landed = catchesOf(lake, () => run(10_000));
        expect(landed.length).toBeGreaterThan(3);
        expect(new Set(landed)).toEqual(new Set(['-']));
        expect(InventoryManager.getItemCount('s5_worm')).toBe(3);
    });

    it('draws in a fixed place: a three-fish pool draws exactly one more number per catch than a one-fish pool', () => {
        const drawsPerCatch = (grid, typeId) => {
            GameState.initNew();
            InventoryManager.init();
            SpriteLayer.init();
            TileModifiers.clearAll();
            const water = put(typeId);
            setHeroes(hero('fisher', grid));
            Orders.orderAt('fisher', LAKE);
            run(3000);
            const real = Math.random;
            let draws = 0;
            Math.random = () => { draws++; return real(); };
            let catches = 0;
            const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p.instanceId === water.id) catches++; });
            try { run(1000); } finally { Math.random = real; off(); }
            expect(catches).toBe(1);
            return draws;
        };
        const three = drawsPerCatch(['s5_rod'], 's5_lake');
        const one = drawsPerCatch(['s5_net'], 's5_lake');
        expect(three - one).toBe(1);
    });
});

describe('a Dock in reach speeds fishing, stacking to the standard floor', () => {
    function cycleGap(docks) {
        const lake = put('s5_slow_lake');
        for (let i = 0; i < docks; i++) put('s5_dock', { x: LAKE.x + (i % 2 ? -160 : 160), y: LAKE.y + (i > 1 ? 160 : 0) });
        TileModifiers.rebuildAll();
        setHeroes(hero('fisher', ['s5_rod']));
        Orders.orderAt('fisher', LAKE);
        const at = [];
        let now = 0;
        const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p.instanceId === lake.id) at.push(now); });
        try { for (; now < 40_000; now += 100) BoardRunner.tick(100); } finally { off(); }
        return at[2] - at[1];
    }

    it('none: 10 s; one Dock (−50 %): 5 s; three (−150 %): held at 2 s, 80 % off', () => {
        expect(MAX_SPEED_UP_CUT).toBe(0.8);
        expect(cycleGap(0)).toBe(10_000);
        GameState.initNew(); SpriteLayer.init(); TileModifiers.clearAll();
        expect(cycleGap(1)).toBe(5_000);
        GameState.initNew(); SpriteLayer.init(); TileModifiers.clearAll();
        expect(cycleGap(3)).toBe(2_000);
    });
});

describe('water never runs out and does not shift', () => {
    it('a Token with catch pools never wears, whatever charges its type or an old copy holds', () => {
        const def = getTokenType('s5_lake');
        expect(neverWearsReason(def)).toBe(NEVER_WEARS.WATER);
        expect(tokenStartingUses('s5_lake')).toBeNull();
        const lake = put('s5_lake');
        lake.usesRemaining = 5000;   // an old save's Coast
        expect(Charges.isUnlimited(lake)).toBe(true);
        Charges.clearNeverWearingCharges();
        expect(lake.usesRemaining).toBeNull();
        setHeroes(hero('fisher', ['s5_rod']));
        Orders.orderAt('fisher', LAKE);
        run(10_000);
        expect(BoardState.getTokenById(lake.id)).not.toBeNull();
        expect(lake.usesRemaining).toBeNull();
    });

    it('an old save\'s Shrimp Coast turns back into the Coast (now water, no turns) and stays one', () => {
        const coastDef = getTokenType('s5_coast');
        expect(coastDef.turns).toBeUndefined();
        const shrimp = BoardState.createTokenInstance('s5_shrimp_coast', 1000);
        shrimp.turnedFrom = 's5_coast';
        Placement.placeTokenAt(shrimp, LAKE);
        const random = seeded(3);
        let current = shrimp;
        for (let s = 0; s < 3600 && current.typeId !== 's5_coast'; s++) {
            TimedChanges.tick(1000, random);
            current = BoardState.tokens()[0];
        }
        expect(current.typeId).toBe('s5_coast');
        expect(current.turnedFrom).toBeUndefined();
        for (let s = 0; s < 600; s++) TimedChanges.tick(1000, random);
        expect(BoardState.tokens().map(t => t.typeId)).toEqual(['s5_coast']);
    });

    it('so does one whose own type the content pack deleted', () => {
        const ghost = BoardState.createTokenInstance('s5_type_the_pack_deleted', 1000);
        ghost.turnedFrom = 's5_coast';
        BoardState.addToken(ghost, LAKE.x, LAKE.y);
        const random = seeded(5);
        for (let s = 0; s < 3600 && BoardState.tokens()[0].typeId !== 's5_coast'; s++) TimedChanges.tick(1000, random);
        expect(BoardState.tokens()[0].typeId).toBe('s5_coast');
    });
});

describe('how water reads', () => {
    it('it files as a resource (no warning), even with no Outputs', () => {
        const derived = deriveTokenType(getTokenType('s5_slow_lake'));
        expect(derived.type).toBe('resource');
        expect(derived.warn).toBeFalsy();
    });

    it('its card lists every fish its pools can land, and the tools it takes', () => {
        const lake = put('s5_lake');
        const model = tokenCardModel('s5_lake', lake.id);
        const recipe = model.blocks.find(b => b.id === CARD_BLOCK.RECIPE);
        expect(recipe.makes.map(m => m.itemId)).toEqual(['s5_trout', 's5_salmon', 's5_dolphin', 's5_shrimp']);
        expect(recipe.tools.map(t => t.name)).toEqual(['Fishing Rod or Fishing Net']);
        expect(model.blocks.find(b => b.id === CARD_BLOCK.CYCLE).uses).toBeNull();
    });

    it('a Catch Weight rule reads as more bites of its fish', () => {
        const lure = { id: 'stm_lure', keyword: 'provides', to: null,
            payload: { type: EFFECT_TYPES.CATCH_WEIGHT, bucket: 'percentage', value: 9, category: 's5_dolphin' } };
        const lines = rulesLinesOf({ statements: [lure] }, { item: (id) => getAllItems()[id]?.name || id });
        expect(lines.join(' ')).toContain('900% more bites of Dolphin');
    });

    it('the audit names pools that cannot work', () => {
        const items = { ...getAllItems() };
        const tokens = {
            bad: { id: 'bad', name: 'Bad Water', config: { skill: 'fishing', outputs: [{ itemId: 's5_trout' }] }, needsTool: { kind: 'fishing_rod' },
                catchPools: [
                    { tool: 'harpoon', catches: [{ itemId: 's5_trout', weight: 1 }] },
                    { tool: 'fishing_rod', bait: 's5_bread_bait', catches: [{ itemId: 'nope', weight: 1 }] },
                    { tool: 'fishing_rod', bait: 's5_bread_bait', catches: [{ itemId: 's5_trout', weight: 0 }] }
                ] },
            dry: { id: 'dry', name: 'Dry Water', catchPools: [{ tool: 'fishing_rod', catches: [{ itemId: 's5_trout', weight: 1 }] }] }
        };
        const found = toolFindings({ items, tokens }).map(f => `${f.entityId}: ${f.message}`);
        expect(found).toEqual(expect.arrayContaining([
            expect.stringMatching(/^bad: its catch pool 1 names the tool kind "harpoon"/),
            expect.stringMatching(/^bad: its catch pool 2 takes Bread Bait as bait, but Bread Bait is not a Consumable/),
            expect.stringMatching(/^bad: its catch pool 2 lands "nope", which is not an item/),
            expect.stringMatching(/^bad: has two catch pools for a Fishing Rod with Bread Bait/),
            expect.stringMatching(/^bad: its catch pool 3 has no catch with a weight above 0/),
            expect.stringMatching(/^bad: a hero with a Fishing Rod catches nothing here without bait/),
            expect.stringMatching(/^bad: has catch pools, so its Outputs are never made/),
            expect.stringMatching(/^bad: has catch pools, so its Needs tool is ignored/),
            expect.stringMatching(/^dry: has catch pools but no work cycle/)
        ]));
    });
});

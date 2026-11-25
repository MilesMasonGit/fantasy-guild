// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
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
import * as Flags from '../systems/board/Flags.js';
import * as Fishing from '../systems/board/Fishing.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, getTokenType, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { TOOL_KINDS, takesLure } from '../config/registries/toolKinds.js';
import { fishOf, fishXp, lureOf, baitSavingOf, baitSpent } from '../config/registries/fishRules.js';
import { fishFindings } from '../systems/core/fishRule.js';
import { adaptToken } from '../../cms/src/engine/sim/fieldAdapter.js';
import { buildRateBook } from '../../cms/src/engine/ledger/rates.js';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import { clearBubbles } from '../ui/components/board/speechBubbles.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Fishing's catch rules: a fish asks a tool kind (Rod, Harpoon, Trap), never a tier; one Bait,
 * an amount per fish spent each catch, less with a better tool; a lure carried in a stack picks
 * its fish where the spot holds it and may break; a lure for a fish the spot lacks fishes the
 * lureless roll and is not spent; a lure above the hero's level stops them; with no lure (and with
 * every harpoon) the roll is among the fish the tool and level allow, at the longest cycle of
 * those; one Trap catch per water; a fish's price includes its Bait.
 */

const fish = (id, name, block) => ({ id, name, type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw', ...(block ? { fish: block } : {}) });
const carried = (id, name, extra = {}) => ({ id, name, type: 'material', stackable: true, equipSlot: 'consumable', sprite: 'i_fish_bait', ...extra });
const tool = (id, name, kind, tier = 1, extra = {}) => ({
    id, name, type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_rod_wood', tool: { kind, tier, ...extra }
});

registerItems({
    rc_trout: fish('rc_trout', 'Trout', { level: 1, cycleMs: 2000, bait: 1 }),
    rc_tuna: fish('rc_tuna', 'Tuna', { level: 5, cycleMs: 3000, bait: 1 }),
    rc_salmon: fish('rc_salmon', 'Salmon', { level: 20, cycleMs: 5000, bait: 2 }),
    rc_shark: fish('rc_shark', 'Shark', { level: 1, cycleMs: 4000, bait: 3 }),
    rc_shrimp: fish('rc_shrimp', 'Raw Shrimp', { level: 1, cycleMs: 1000 }),
    rc_lobster: fish('rc_lobster', 'Lobster', { level: 1, cycleMs: 1000, bait: 1 }),
    rc_cod: fish('rc_cod', 'Cod'),
    rc_eel: fish('rc_eel', 'Eel', { xp: 7 }),
    rc_minnow: fish('rc_minnow', 'Minnow', { xp: 0 }),
    rc_bait: carried('rc_bait', 'Bait'),
    rc_other_bait: carried('rc_other_bait', 'Squid Bait'),
    rc_feather_lure: carried('rc_feather_lure', 'Feather Lure', { lure: { fish: ['rc_trout', 'rc_salmon'] } }),
    rc_tuna_lure: carried('rc_tuna_lure', 'Tuna Lure', { lure: { fish: ['rc_tuna'], breakChance: 100 } }),
    rc_salmon_lure: carried('rc_salmon_lure', 'Salmon Lure', { lure: { fish: ['rc_salmon'] } }),
    rc_cod_lure: carried('rc_cod_lure', 'Cod Lure', { lure: { fish: ['rc_cod'] } }),
    rc_rod: tool('rc_rod', 'Rod', 'fishing_rod', 1),
    rc_master_rod: tool('rc_master_rod', 'Master Rod', 'fishing_rod', 3, { baitSaving: 1 }),
    rc_harpoon: tool('rc_harpoon', 'Harpoon', 'harpoon', 1),
    rc_dark_harpoon: tool('rc_dark_harpoon', 'Darkmetal Harpoon', 'harpoon', 5),
    rc_trap: tool('rc_trap', 'Trap', 'fishing_trap', 1)
});

const WORK = { skill: 'fishing', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] };
const water = (id, pools, extra = {}) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 't_lake_small', requiresHero: true,
    uses: null, tags: ['water'], catchPools: pools, config: { ...WORK }, ...extra
});

registerTokenTypes({
    rc_lake: water('rc_lake', [
        { tool: 'fishing_rod', bait: 'rc_bait', catches: [{ itemId: 'rc_trout', weight: 3 }, { itemId: 'rc_tuna', weight: 1 }, { itemId: 'rc_salmon', weight: 1 }] },
        { tool: 'harpoon', bait: 'rc_bait', catches: [{ itemId: 'rc_shark', weight: 1 }] },
        { tool: 'fishing_trap', catches: [{ itemId: 'rc_shrimp', weight: 1 }] }
    ]),
    rc_sea: water('rc_sea', [
        { tool: 'fishing_trap', bait: 'rc_bait', catches: [{ itemId: 'rc_lobster', weight: 1 }] }
    ]),
    // Catch XP: the Eel teaches its own 7, the Trout the water's 1, the Minnow none.
    rc_eel_pond: water('rc_eel_pond', [
        { tool: 'fishing_rod', bait: 'rc_bait', catches: [{ itemId: 'rc_eel', weight: 1 }, { itemId: 'rc_trout', weight: 1 }, { itemId: 'rc_minnow', weight: 1 }] }
    ]),
    // Two rod pools: with one Bait, the bait carried no longer picks between them; the first does.
    rc_pond: water('rc_pond', [
        { tool: 'fishing_rod', bait: 'rc_bait', catches: [{ itemId: 'rc_trout', weight: 1 }] },
        { tool: 'fishing_rod', bait: 'rc_other_bait', catches: [{ itemId: 'rc_tuna', weight: 1 }] }
    ])
});

// Bait is made by Fishing: a Fishing recipe at a station that works as Fishing (a Bait Shed).
registerRecipePools({
    fishing: [{
        id: 'rc_recipe_bait', name: 'Bait', levelRequirement: 1, durationMs: 1000, xp: 1,
        inputs: [{ itemId: 'rc_shrimp', quantity: 1 }],
        outputs: [{ itemId: 'rc_bait', chance: 100, minQty: 3, maxQty: 3 }]
    }]
});
registerTokenTypes({
    rc_bait_shed: {
        id: 'rc_bait_shed', name: 'Bait Shed', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_market_fish', requiresHero: true,
        config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_rc_bait_shed', keyword: KEYWORD.STATION, payload: { skill: 'fishing' } }]
    }
});

const AT = { x: 600, y: 500 };
const SEA = { x: 1400, y: 500 };
const h = React.createElement;

function hero(id, grid = [], fishing = 10) {
    const equipment = Array.from({ length: 9 }, (_, i) => grid[i] || null);
    const heldCopies = equipment.map(itemId => !!itemId && getAllItems()[itemId]?.equipSlot === 'hand');
    return { id, name: id, status: 'idle', level: 10, skills: { fishing: { level: fishing, xp: 0 } },
        hp: { current: 100, max: 100 }, equipment, heldCopies };
}
const setHeroes = (...heroes) => { GameState.state.heroes = heroes; };

function put(typeId, at = AT) {
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

/** The game ms between the first two catches at `instance` while `fn` runs. */
function gapOf(instance, fn) {
    const at = [];
    let clock = 0;
    const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p?.instanceId === instance.id) at.push(clock); });
    try { fn((ms) => { for (let t = 0; t < ms; t += 100) { clock += 100; BoardRunner.tick(100); } }); } finally { off(); }
    return at.length >= 2 ? at[1] - at[0] : null;
}

const bubbles = (container, id) => [...container.querySelectorAll(`[data-hero-bubble-stack="${id}"] [data-hero-bubble]`)]
    .map(n => n.textContent);
const onMat = (id) => ({ heroId: id, state: 'idle', x: AT.x, y: AT.y, moving: false, tokenId: null, alert: null });

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
    clearBubbles();
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [];
});

afterEach(() => {
    cleanup();
    clearBubbles();
});

describe('the item blocks, as content', () => {
    it('a fish names its level, its catch time and its Bait; a field left out is the water\'s', () => {
        expect(fishOf(getAllItems().rc_salmon)).toEqual({ level: 20, cycleMs: 5000, bait: 2, xp: null });
        expect(fishOf(getAllItems().rc_shrimp)).toEqual({ level: 1, cycleMs: 1000, bait: null, xp: null });
        expect(fishOf(getAllItems().rc_cod)).toBeNull();
        expect(fishOf({ fish: { level: 'x', cycleMs: -1, bait: 0 } })).toEqual({ level: null, cycleMs: null, bait: 0, xp: null });
        expect(fishOf(getAllItems().rc_eel).xp).toBe(7);
        expect(fishXp(getAllItems().rc_eel, 1)).toBe(7);
        expect(fishXp(getAllItems().rc_minnow, 1)).toBe(0);
        expect(fishXp(getAllItems().rc_trout, 1)).toBe(1);
        expect(fishXp(getAllItems().rc_cod, 3)).toBe(3);
    });

    it('a lure names its fish and a chance to break; a lure naming no fish is none', () => {
        expect(lureOf(getAllItems().rc_tuna_lure)).toEqual({ fish: ['rc_tuna'], breakChance: 100 });
        expect(lureOf(getAllItems().rc_feather_lure)).toEqual({ fish: ['rc_trout', 'rc_salmon'], breakChance: 0 });
        expect(lureOf({ lure: { fish: [] } })).toBeNull();
        expect(lureOf(getAllItems().rc_bait)).toBeNull();
    });

    it('a better tool spends less Bait, never below 1 for a catch that spends any', () => {
        expect(baitSavingOf(getAllItems().rc_master_rod)).toBe(1);
        expect(baitSavingOf(getAllItems().rc_rod)).toBe(0);
        expect(baitSpent(3, 1)).toBe(2);
        expect(baitSpent(1, 1)).toBe(1);
        expect(baitSpent(2, 5)).toBe(1);
        expect(baitSpent(0, 0)).toBe(0);
    });
});

describe('a fish asks a tool kind, never a tier', () => {
    it('three fishing kinds the plan names, the Harpoon among them; only a rod takes a lure', () => {
        const ids = TOOL_KINDS.map(k => k.id);
        for (const id of ['fishing_rod', 'harpoon', 'fishing_trap']) expect(ids).toContain(id);
        expect(TOOL_KINDS.find(k => k.id === 'harpoon').catches).toBe(true);
        expect(takesLure('fishing_rod')).toBe(true);
        expect(takesLure('harpoon')).toBe(false);
        expect(takesLure('fishing_trap')).toBe(false);
    });

    it('any harpoon catches the harpoon fish, the lowest tier as the highest', () => {
        put('rc_lake');
        InventoryManager.addItem('rc_bait', 50);
        setHeroes(hero('low', ['rc_harpoon', 'rc_bait']), hero('high', ['rc_dark_harpoon', 'rc_bait']));
        const lake = getTokenType('rc_lake');
        expect(Fishing.fishingOf(lake, 'low')?.catches.map(c => c.itemId)).toEqual(['rc_shark']);
        expect(Fishing.fishingOf(lake, 'high')?.catches.map(c => c.itemId)).toEqual(['rc_shark']);
    });
});

describe('no lure: a roll among the fish the tool and level allow, at the longest cycle of those', () => {
    it('a level 10 hero never lands the level 20 Salmon, and each catch takes the Tuna\'s 3 s', () => {
        const lake = put('rc_lake');
        setHeroes(hero('fisher', ['rc_rod', 'rc_bait']));
        InventoryManager.addItem('rc_bait', 500);
        Orders.orderAt('fisher', AT);
        const def = getTokenType('rc_lake');
        expect(Fishing.fishingOf(def, 'fisher', lake).catches.map(c => c.itemId)).toEqual(['rc_trout', 'rc_tuna']);
        expect(Fishing.cycleMsOf(def, 'fisher', lake, 1000)).toBe(3000);
        const landed = catchesOf(lake, () => run(120_000));
        expect(landed.length).toBeGreaterThan(20);
        expect(landed.length).toBeLessThanOrEqual(40);
        expect(new Set(landed)).toEqual(new Set(['rc_trout', 'rc_tuna']));
    });

    it('a level 30 hero rolls the Salmon too, and then waits its 5 s each catch', () => {
        const lake = put('rc_lake');
        setHeroes(hero('fisher', ['rc_rod', 'rc_bait'], 30));
        InventoryManager.addItem('rc_bait', 500);
        Orders.orderAt('fisher', AT);
        expect(Fishing.cycleMsOf(getTokenType('rc_lake'), 'fisher', lake, 1000)).toBe(5000);
        expect(gapOf(lake, (go) => go(30_000))).toBe(5000);
    });

    it('a harpoon takes no lure: carrying one changes nothing and spends none', () => {
        const lake = put('rc_lake');
        setHeroes(hero('harpooner', ['rc_harpoon', 'rc_bait', 'rc_tuna_lure']));
        InventoryManager.addItem('rc_bait', 30);
        InventoryManager.addItem('rc_tuna_lure', 3);
        Orders.orderAt('harpooner', AT);
        const landed = catchesOf(lake, () => run(20_000));
        expect(new Set(landed)).toEqual(new Set(['rc_shark']));
        expect(InventoryManager.getItemCount('rc_tuna_lure')).toBe(3);
        // Three Bait a Shark.
        expect(InventoryManager.getItemCount('rc_bait')).toBe(30 - 3 * landed.length);
    });
});

describe('a lure picks the fish', () => {
    it('carried in a consumable cell, it lands only its fish, at that fish\'s own time', () => {
        const lake = put('rc_lake');
        setHeroes(hero('fisher', ['rc_rod', 'rc_bait', 'rc_salmon_lure'], 30));
        InventoryManager.addItem('rc_bait', 500);
        InventoryManager.addItem('rc_salmon_lure', 1);
        Orders.orderAt('fisher', AT);
        const def = getTokenType('rc_lake');
        expect(Fishing.fishingOf(def, 'fisher', lake).lure).toBe('rc_salmon_lure');
        expect(Fishing.cycleMsOf(def, 'fisher', lake, 1000)).toBe(5000);
        const landed = catchesOf(lake, () => run(30_000));
        expect(new Set(landed)).toEqual(new Set(['rc_salmon']));
        // No chance to break: the lure stays.
        expect(InventoryManager.getItemCount('rc_salmon_lure')).toBe(1);
    });

    it('a lure naming several fish picks the first of them the spot holds', () => {
        put('rc_lake');
        setHeroes(hero('fisher', ['rc_rod', 'rc_bait', 'rc_feather_lure']));
        InventoryManager.addItem('rc_bait', 5);
        InventoryManager.addItem('rc_feather_lure', 1);
        expect(Fishing.fishingOf(getTokenType('rc_lake'), 'fisher')?.catches.map(c => c.itemId)).toEqual(['rc_trout']);
    });

    it('a lure the Bank no longer holds is no lure', () => {
        put('rc_lake');
        setHeroes(hero('fisher', ['rc_rod', 'rc_bait', 'rc_tuna_lure']));
        InventoryManager.addItem('rc_bait', 5);
        expect(Fishing.fishingOf(getTokenType('rc_lake'), 'fisher')?.lure).toBeNull();
    });

    it('may break each catch: a sure break uses one a catch, then the hero fishes the lureless roll', () => {
        const lake = put('rc_lake');
        setHeroes(hero('fisher', ['rc_rod', 'rc_bait', 'rc_tuna_lure']));
        InventoryManager.addItem('rc_bait', 500);
        InventoryManager.addItem('rc_tuna_lure', 3);
        Orders.orderAt('fisher', AT);
        const landed = catchesOf(lake, () => run(60_000));
        expect(landed.slice(0, 3)).toEqual(['rc_tuna', 'rc_tuna', 'rc_tuna']);
        expect(InventoryManager.getItemCount('rc_tuna_lure')).toBe(0);
        expect(new Set(landed.slice(3))).toEqual(new Set(['rc_trout', 'rc_tuna']));
    });

    it('a lure for a fish this spot lacks: the lureless roll, the lure kept, and the hero says so', () => {
        const lake = put('rc_lake');
        setHeroes(hero('fisher', ['rc_rod', 'rc_bait', 'rc_cod_lure']));
        InventoryManager.addItem('rc_bait', 500);
        InventoryManager.addItem('rc_cod_lure', 2);
        Orders.orderAt('fisher', AT);
        const said = [];
        const off = EventBus.subscribe(BOARD_EVENTS.LURE_FISH_ABSENT, (p) => said.push(p));
        let landed;
        try { landed = catchesOf(lake, () => run(20_000)); } finally { off(); }
        expect(new Set(landed)).toEqual(new Set(['rc_trout', 'rc_tuna']));
        expect(InventoryManager.getItemCount('rc_cod_lure')).toBe(2);
        expect(said[0]).toEqual({ instanceId: lake.id, heroId: 'fisher', lureId: 'rc_cod_lure', fish: ['rc_cod'] });
    });

    it('a lure for a fish above the hero\'s level: they do not fish there, and need that level', () => {
        const lake = put('rc_lake');
        setHeroes(hero('fisher', ['rc_rod', 'rc_bait', 'rc_salmon_lure']));
        InventoryManager.addItem('rc_bait', 50);
        InventoryManager.addItem('rc_salmon_lure', 1);
        const def = getTokenType('rc_lake');
        expect(Fishing.fishingOf(def, 'fisher', lake)).toBeNull();
        expect(Fishing.levelNeededOf(def, 'fisher', lake)).toBe(20);
        expect(WorkCheck.baitReason('fisher', lake, def)).toBe(ALERT.FISH_LEVEL);
        expect(Fishing.lacksBait(def, 'fisher', lake)).toBe(false);
        Orders.orderAt('fisher', AT);
        const said = [];
        const off = EventBus.subscribe(BOARD_EVENTS.CATCH_NEEDS_LEVEL, (p) => said.push(p));
        let landed;
        try { landed = catchesOf(lake, () => run(5_000)); } finally { off(); }
        expect(landed).toEqual([]);
        expect(BoardState.workerOf(lake.id)).toBeNull();
        expect(said[0]).toEqual({ instanceId: lake.id, heroId: 'fisher', skill: 'fishing', level: 20 });
    });
});

describe('Bait: one item, an amount per fish, less with a better tool', () => {
    it('a Salmon spends 2 a catch with a plain rod, 1 with the Master Rod', () => {
        const spentWith = (rod) => {
            GameState.initNew();
            InventoryManager.init();
            SpriteLayer.init();
            TileModifiers.clearAll();
            const lake = put('rc_lake');
            setHeroes(hero('fisher', [rod, 'rc_bait', 'rc_salmon_lure'], 30));
            InventoryManager.addItem('rc_bait', 100);
            InventoryManager.addItem('rc_salmon_lure', 1);
            Orders.orderAt('fisher', AT);
            const landed = catchesOf(lake, () => run(30_000));
            return (100 - InventoryManager.getItemCount('rc_bait')) / landed.length;
        };
        expect(spentWith('rc_rod')).toBe(2);
        expect(spentWith('rc_master_rod')).toBe(1);
    });

    it('too little Bait for the catch: no fishing, and the hero needs Bait', () => {
        put('rc_lake');
        setHeroes(hero('fisher', ['rc_rod', 'rc_bait', 'rc_salmon_lure'], 30));
        InventoryManager.addItem('rc_bait', 1);
        InventoryManager.addItem('rc_salmon_lure', 1);
        const def = getTokenType('rc_lake');
        expect(Fishing.fishingOf(def, 'fisher')).toBeNull();
        expect(Fishing.lacksBait(def, 'fisher')).toBe(true);
        expect(Fishing.baitNeedOf(def, 'fisher')).toEqual({ itemId: 'rc_bait', needed: 2 });
    });

    it('the bait carried no longer picks the pool: the first for the tool there is fished', () => {
        put('rc_pond');
        setHeroes(hero('fisher', ['rc_rod', 'rc_other_bait']));
        InventoryManager.addItem('rc_other_bait', 5);
        const def = getTokenType('rc_pond');
        expect(Fishing.fishingOf(def, 'fisher')).toBeNull();
        expect(Fishing.baitNeededOf(def, 'fisher')).toBe('rc_bait');
    });
});

describe('the Trap: one catch a water, no lure', () => {
    it('Raw Shrimp needs no Bait; every other Trap catch spends it', () => {
        const lake = put('rc_lake');
        const sea = put('rc_sea', SEA);
        setHeroes(hero('free', ['rc_trap', 'rc_tuna_lure']), hero('lobster', ['rc_trap', 'rc_bait']));
        InventoryManager.addItem('rc_bait', 4);
        InventoryManager.addItem('rc_tuna_lure', 2);
        Orders.orderAt('free', AT);
        Orders.orderAt('lobster', SEA);
        let seaLanded;
        const lakeLanded = catchesOf(lake, () => { seaLanded = catchesOf(sea, () => run(10_000)); });
        expect(new Set(lakeLanded)).toEqual(new Set(['rc_shrimp']));
        expect(InventoryManager.getItemCount('rc_tuna_lure')).toBe(2);
        expect(seaLanded).toEqual(['rc_lobster', 'rc_lobster', 'rc_lobster', 'rc_lobster']);
        expect(InventoryManager.getItemCount('rc_bait')).toBe(0);
    });
});

describe('Bait is a Fishing recipe', () => {
    it('a station working as Fishing turns Raw Shrimp into Bait', () => {
        const shed = put('rc_bait_shed');
        StationRecipe.setSelectedRecipe(shed, 'rc_recipe_bait');
        setHeroes(hero('baiter'));
        InventoryManager.addItem('rc_shrimp', 2);
        Orders.orderAt('baiter', AT);
        const made = catchesOf(shed, () => run(10_000));
        expect(made).toEqual(['rc_bait', 'rc_bait']);
        expect(InventoryManager.getItemCount('rc_shrimp')).toBe(0);
    });
});

describe('what the hero says', () => {
    it('"Needs Fishing 20" for a lure above them, "No Cod here" for a lure the spot lacks', () => {
        vi.useFakeTimers();
        try {
            put('rc_lake');
            setHeroes(hero('high', ['rc_rod', 'rc_bait', 'rc_salmon_lure']), hero('absent', ['rc_rod', 'rc_bait', 'rc_cod_lure']));
            InventoryManager.addItem('rc_bait', 100);
            InventoryManager.addItem('rc_salmon_lure', 1);
            InventoryManager.addItem('rc_cod_lure', 1);
            const { container } = render(h(HeroBubbleLayer, { heroes: ['high', 'absent'].map(onMat) }));
            act(() => { vi.advanceTimersByTime(10); });
            Orders.orderAt('high', AT);
            Orders.orderAt('absent', AT);
            act(() => run(8_000));
            expect(bubbles(container, 'high')).toEqual(['Needs Fishing 20']);
            expect(bubbles(container, 'absent')).toEqual(['No Cod here']);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('catch XP comes per fish', () => {
    it("a catch teaches its fish's own XP, else the water's config.xp; a fish of 0 teaches none", () => {
        const pond = put('rc_eel_pond');
        // Below level 10, where Fishing's first perk would widen every award.
        setHeroes(hero('fisher', ['rc_rod', 'rc_bait'], 5));
        InventoryManager.addItem('rc_bait', 500);
        Orders.orderAt('fisher', AT);
        const angler = GameState.state.heroes[0];
        const taught = [];
        let before = angler.skills.fishing.xp;
        const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => {
            if (p?.instanceId !== pond.id) return;
            taught.push([p.produced.join('+'), angler.skills.fishing.xp - before]);
            before = angler.skills.fishing.xp;
        });
        try { run(60_000); } finally { off(); }
        const byFish = {};
        for (const [fishId, xp] of taught) (byFish[fishId] ||= new Set()).add(xp);
        expect(Object.keys(byFish).sort()).toEqual(['rc_eel', 'rc_minnow', 'rc_trout']);
        expect([...byFish.rc_eel]).toEqual([7]);
        expect([...byFish.rc_trout]).toEqual([1]);
        expect([...byFish.rc_minnow]).toEqual([0]);
    });

    it("the rate calculator counts each fish's XP at its share of the catches", () => {
        const book = buildRateBook({ items: getAllItems(), tokens: { rc_eel_pond: getTokenType('rc_eel_pond'), rc_lake: getTokenType('rc_lake') } });
        const r = book.rateOf({ token: 'rc_eel_pond' }, { tool: 'rc_rod', level: 5 });
        expect(r.ok).toBe(true);
        // One Eel (7), one Trout (the water's 1), one Minnow (0) in three catches.
        expect(r.xpPerCycle).toBeCloseTo(8 / 3, 6);
        // Today's waters, no fish XP: the water's own, as before.
        expect(book.rateOf({ token: 'rc_lake' }, { tool: 'rc_rod', level: 5 }).xpPerCycle).toBeCloseTo(1, 6);
    });

    it('the audit names a catch XP that is not a whole number of 0 or more', () => {
        const odd = {
            ...getAllItems(),
            rc_bad_a: fish('rc_bad_a', 'Bad A', { xp: -2 }),
            rc_bad_b: fish('rc_bad_b', 'Bad B', { xp: 'lots' }),
            rc_bad_c: fish('rc_bad_c', 'Bad C', { xp: 1.5 })
        };
        const out = fishFindings({ items: odd, tokens: { rc_eel_pond: getTokenType('rc_eel_pond') } });
        for (const id of ['rc_bad_a', 'rc_bad_b', 'rc_bad_c']) {
            expect(out.some(f => f.entityId === id && /catch XP/.test(f.message))).toBe(true);
        }
        expect(out.some(f => ['rc_eel', 'rc_minnow', 'rc_trout'].includes(f.entityId) && /catch XP/.test(f.message))).toBe(false);
    });
});

describe('the content audit', () => {
    const items = getAllItems();
    const spot = (id, pools, biomes = []) => ({
        id, name: id, standsOn: ['water'], config: { ...WORK }, catchPools: pools,
        spot: { water: ['sea', 'fresh'], biomes, everyMinutes: 5, most: 2 }
    });

    it('one Bait for all fishing: a second bait named is a warning', () => {
        const out = fishFindings({ items, tokens: { rc_lake: getTokenType('rc_lake'), rc_pond: getTokenType('rc_pond') } });
        expect(out.some(f => /Squid Bait/.test(f.message) && /one Bait/.test(f.message))).toBe(true);
    });

    it('one Trap catch per water', () => {
        const two = water('two_traps', [{ tool: 'fishing_trap', catches: [{ itemId: 'rc_shrimp', weight: 1 }, { itemId: 'rc_lobster', weight: 1 }] }]);
        const out = fishFindings({ items, tokens: { two_traps: two } });
        expect(out.some(f => f.entityId === 'two_traps' && /one Trap catch/.test(f.message))).toBe(true);
    });

    it('a lure naming no item, or a fish no rod catches, is named', () => {
        const odd = { ...items, rc_odd_lure: carried('rc_odd_lure', 'Odd Lure', { lure: { fish: ['nope', 'rc_shark'] } }) };
        const out = fishFindings({ items: odd, tokens: { rc_lake: getTokenType('rc_lake') } });
        const mine = out.filter(f => f.entityId === 'rc_odd_lure').map(f => f.message).join(' | ');
        expect(mine).toMatch(/"nope", which is not an item/);
        expect(mine).toMatch(/Shark/);
    });

    it('a map holds at most one fish per lure: two spot kinds in one biome giving two of a lure\'s fish is a warning', () => {
        const tokens = {
            a: spot('a', [{ tool: 'fishing_rod', bait: 'rc_bait', water: ['fresh'], catches: [{ itemId: 'rc_trout', weight: 1 }] }]),
            b: spot('b', [{ tool: 'fishing_rod', bait: 'rc_bait', water: ['sea'], biomes: ['coast'], catches: [{ itemId: 'rc_salmon', weight: 1 }] }])
        };
        const out = fishFindings({ items, tokens });
        expect(out.some(f => f.entityId === 'rc_feather_lure' && /coast/.test(f.message) && /Trout/.test(f.message) && /Salmon/.test(f.message))).toBe(true);
        // In another biome only the Trout is there: nothing to say.
        tokens.b = spot('b', [{ tool: 'fishing_rod', bait: 'rc_bait', water: ['sea'], biomes: ['mountain'], catches: [{ itemId: 'rc_salmon', weight: 1 }] }], ['mountain']);
        tokens.a = spot('a', tokens.a.catchPools, ['forest']);
        expect(fishFindings({ items, tokens }).some(f => f.entityId === 'rc_feather_lure')).toBe(false);
    });
});

describe('a fish\'s price includes its Bait', () => {
    it('the economy prices water from its pools that bite, with Bait an input at the amount a catch spends', () => {
        const def = { ...getTokenType('rc_lake'), catchPools: [getTokenType('rc_lake').catchPools[0]] };
        const entity = adaptToken(def, 'rc_lake', getAllItems());
        expect(entity.outputs.map(o => o.itemId)).toEqual(['rc_trout', 'rc_tuna', 'rc_salmon']);
        // 3 Trout and 1 Tuna at 1 Bait, 1 Salmon at 2: 6 Bait over 5 catches.
        expect(entity.inputs).toEqual([{ itemId: 'rc_bait', quantity: 1.2 }]);
    });

    it('a Trap\'s free pool spends nothing', () => {
        const def = { ...getTokenType('rc_lake'), catchPools: [getTokenType('rc_lake').catchPools[2]] };
        const entity = adaptToken(def, 'rc_lake', getAllItems());
        expect(entity.inputs).toEqual([]);
        expect(entity.outputs.map(o => o.itemId)).toEqual(['rc_shrimp']);
    });
});

describe("the ledger's rate calculator follows the catch rules", () => {
    const book = () => buildRateBook({ items: getAllItems(), tokens: { rc_lake: getTokenType('rc_lake') } });

    it('no lure: the fish the level allows, at the longest time of those, Bait as they ask', () => {
        const r = book().rateOf({ token: 'rc_lake' }, { tool: 'rc_rod', level: 10 });
        expect(r.ok).toBe(true);
        expect(r.baseCycleMs).toBe(3000);
        expect(Object.keys(r.perCycle).sort()).toEqual(['rc_trout', 'rc_tuna']);
        expect(r.inputs.rc_bait / r.cyclesPerHour).toBeCloseTo(1, 6);
    });

    it('a lure: its fish alone at its own time, and the lure as it breaks', () => {
        const r = book().rateOf({ token: 'rc_lake' }, { tool: 'rc_rod', level: 10, lure: 'rc_tuna_lure' });
        expect(Object.keys(r.perCycle)).toEqual(['rc_tuna']);
        expect(r.baseCycleMs).toBe(3000);
        expect(r.inputs.rc_tuna_lure / r.cyclesPerHour).toBeCloseTo(1, 6);
    });

    it('a lure above the hero: refused for the level; a better rod spends less Bait', () => {
        expect(book().rateOf({ token: 'rc_lake' }, { tool: 'rc_rod', level: 10, lure: 'rc_salmon_lure' })).toMatchObject({ ok: false, reason: 'level' });
        const plain = book().rateOf({ token: 'rc_lake' }, { tool: 'rc_rod', level: 30, lure: 'rc_salmon_lure' });
        const master = book().rateOf({ token: 'rc_lake' }, { tool: 'rc_master_rod', level: 30, lure: 'rc_salmon_lure' });
        expect(plain.inputs.rc_bait / plain.cyclesPerHour).toBeCloseTo(2, 6);
        expect(master.inputs.rc_bait / master.cyclesPerHour).toBeCloseTo(1, 6);
        expect(plain.baseCycleMs).toBe(5000);
    });
});

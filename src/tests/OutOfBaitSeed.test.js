// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Flags from '../systems/board/Flags.js';
import * as Growth from '../systems/board/Growth.js';
import * as Fields from '../systems/board/Fields.js';
import * as Fishing from '../systems/board/Fishing.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, getTokenType, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { resetMatTuning } from '../config/matTuning.js';
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
 * Out of bait or seed, the hero leaves and says so. At a water a hero fishes only with bait
 * carried in a consumable cell and still held by the Bank, except with a Trap, whose pool with no
 * bait lands Raw Shrimp. With none the hero lets go of the water, as of a resting vein, keeps the
 * order, and says "Needs Worm Bait" in the shared running-out bubble. A Field stopped for want of
 * its seed has its hero say "Needs Wheat Seed" the same way, and keeps its own yellow mark.
 */

const material = (id, name, extra = {}) => ({ id, name, type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw', ...extra });
const tool = (id, name, kind) => ({ id, name, type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_rod_wood', tool: { kind, tier: 1 } });

registerItems({
    ob_trout: material('ob_trout', 'Trout'),
    ob_salmon: material('ob_salmon', 'Salmon'),
    ob_raw_shrimp: material('ob_raw_shrimp', 'Raw Shrimp'),
    ob_lobster: material('ob_lobster', 'Lobster'),
    ob_wheat: material('ob_wheat', 'Wheat'),
    ob_wheat_seed: material('ob_wheat_seed', 'Wheat Seed'),
    ob_worm_bait: material('ob_worm_bait', 'Worm Bait', { equipSlot: 'consumable', sprite: 'i_fish_bait' }),
    ob_shrimp_bait: material('ob_shrimp_bait', 'Shrimp Bait', { equipSlot: 'consumable', sprite: 'i_fish_bait' }),
    ob_rod: tool('ob_rod', 'Fishing Rod', 'fishing_rod'),
    ob_trap: tool('ob_trap', 'Trap', 'fishing_trap')
});

const water = (id, name, catchPools) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 't_lake_small', requiresHero: true, uses: null,
    tags: ['water'], catchPools,
    config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] }
});

registerRecipePools({
    farming: [{
        id: 'ob_recipe_wheat', name: 'Wheat', levelRequirement: 1, durationMs: 1000, xp: 1, stationKinds: ['field'],
        inputs: [{ itemId: 'ob_wheat_seed', quantity: 1 }],
        outputs: [{ itemId: 'ob_wheat', chance: 100, minQty: 1, maxQty: 1 }],
        crop: { growMs: 5000, load: 1 }
    }]
});

registerTokenTypes({
    // As shipped before the Fishing pack: each water still authors a rod pool with no bait, which no
    // longer bites.
    ob_river: water('ob_river', 'River', [
        { tool: 'fishing_rod', catches: [{ itemId: 'ob_trout', weight: 70 }, { itemId: 'ob_salmon', weight: 30 }] },
        { tool: 'fishing_rod', bait: 'ob_worm_bait', catches: [{ itemId: 'ob_salmon', weight: 1 }] }
    ]),
    ob_coast: water('ob_coast', 'Coast', [
        { tool: 'fishing_rod', catches: [{ itemId: 'ob_trout', weight: 1 }] },
        { tool: 'fishing_rod', bait: 'ob_shrimp_bait', catches: [{ itemId: 'ob_salmon', weight: 1 }] },
        { tool: 'fishing_trap', catches: [{ itemId: 'ob_raw_shrimp', weight: 1 }] },
        { tool: 'fishing_trap', bait: 'ob_worm_bait', catches: [{ itemId: 'ob_lobster', weight: 1 }] }
    ]),
    ob_field: {
        id: 'ob_field', name: 'Field', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_farmland', requiresHero: true,
        config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_ob_field_works', keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }],
        field: { emptySprite: 't_farmland' }
    }
});

const AT = { x: 800, y: 500 };
const h = React.createElement;

function hero(id, grid = []) {
    const equipment = Array.from({ length: 9 }, (_, i) => grid[i] || null);
    const heldCopies = equipment.map(itemId => !!itemId && getAllItems()[itemId]?.equipSlot === 'hand');
    return { id, name: id, status: 'idle', level: 10, skills: { fishing: { level: 10, xp: 0 }, farming: { level: 10, xp: 0 } },
        hp: { current: 100, max: 100 }, equipment, heldCopies };
}

function put(typeId, at = AT) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    const res = Placement.placeTokenAt(instance, at);
    expect(res?.success, res?.reason).not.toBe(false);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

/** What landed at `instance` per finished cycle while `fn` runs. */
function catchesOf(instance, fn) {
    const landed = [];
    const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p?.instanceId === instance.id) landed.push(p.produced.join('+') || '-'); });
    try { fn(); } finally { off(); }
    return landed;
}

/** Every `INPUT_NEEDED` published while `fn` runs. */
function saidWhile(fn) {
    const said = [];
    const off = EventBus.subscribe(BOARD_EVENTS.INPUT_NEEDED, (p) => said.push(p));
    try { fn(); } finally { off(); }
    return said;
}

const bubbles = (container, id) => [...container.querySelectorAll(`[data-hero-bubble-stack="${id}"] [data-hero-bubble]`)]
    .map(n => n.textContent);
const onMat = (id) => ({ heroId: id, state: 'idle', x: AT.x, y: AT.y, moving: false, tokenId: null, alert: null });
function mount(heroIds) {
    const view = render(h(HeroBubbleLayer, { heroes: heroIds.map(onMat) }));
    act(() => { vi.advanceTimersByTime(10); });
    return view;
}

/** Put `itemId` in hero `heroId`'s grid cell `slot`, as equipping does. */
function carry(heroId, slot, itemId) {
    const record = GameState.state.heroes.find(x => x.id === heroId);
    record.equipment[slot] = itemId;
    EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { heroId });
}

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.useFakeTimers();
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
    vi.useRealTimers();
});

describe('at a water, no bait, no fishing', () => {
    it('a rod with no bait does not fish: the order stands, the hero lets go, no badge, and says which bait', () => {
        const river = put('ob_river');
        GameState.state.heroes = [hero('fisher', ['ob_rod'])];
        expect(Orders.orderAt('fisher', AT).success).toBe(true);
        let landed;
        const said = saidWhile(() => { landed = catchesOf(river, () => run(10_000)); });
        expect(landed).toEqual([]);
        expect(BoardState.workerOf(river.id)).toBeNull();
        expect(Flags.pinnedIdOf('fisher')).toBe(river.id);
        expect(river.alert ?? null).toBeNull();
        expect(Flags.skipsOfHero('fisher').map(s => s.reason)).toEqual([ALERT.NO_BAIT]);
        expect(said.length).toBeGreaterThan(0);
        expect(said.length).toBeLessThanOrEqual(12);
        expect(said[0]).toEqual({ instanceId: river.id, heroId: 'fisher', itemId: 'ob_worm_bait', needed: 1, carried: true });
        expect(Fishing.baitNeededOf(getTokenType('ob_river'), 'fisher')).toBe('ob_worm_bait');
        expect(WorkCheck.whyCannotRun(river.id, river, 'fisher', getTokenType('ob_river').config)).toBe(ALERT.NO_BAIT);
        // Not a refusal: the hero can be ordered onto it with no bait.
        expect(Flags.orderRefusal('fisher', river)).toBeNull();
    });

    it('with bait carried in a consumable cell and held by the Bank, they fish, one bait a catch', () => {
        const river = put('ob_river');
        GameState.state.heroes = [hero('fisher', ['ob_rod', 'ob_worm_bait'])];
        InventoryManager.addItem('ob_worm_bait', 50);
        Orders.orderAt('fisher', AT);
        let landed;
        const said = saidWhile(() => { landed = catchesOf(river, () => run(5_000)); });
        expect(landed.length).toBeGreaterThanOrEqual(3);
        expect(new Set(landed)).toEqual(new Set(['ob_salmon']));
        expect(InventoryManager.getItemCount('ob_worm_bait')).toBe(50 - landed.length);
        expect(said).toEqual([]);
    });

    it('bait in the Bank alone does not do: it must be carried', () => {
        put('ob_river');
        GameState.state.heroes = [hero('fisher', ['ob_rod'])];
        InventoryManager.addItem('ob_worm_bait', 5);
        expect(Fishing.fishingOf(getTokenType('ob_river'), 'fisher')).toBeNull();
        expect(Fishing.lacksBait(getTokenType('ob_river'), 'fisher')).toBe(true);
    });

    it('run dry: the last bait lands its catch, then the hero lets go and says Needs Worm Bait', () => {
        const river = put('ob_river');
        GameState.state.heroes = [hero('fisher', ['ob_rod', 'ob_worm_bait'])];
        InventoryManager.addItem('ob_worm_bait', 2);
        Orders.orderAt('fisher', AT);
        let landed;
        const said = saidWhile(() => { landed = catchesOf(river, () => run(10_000)); });
        expect(landed).toEqual(['ob_salmon', 'ob_salmon']);
        expect(BoardState.workerOf(river.id)).toBeNull();
        expect(said[0]).toMatchObject({ heroId: 'fisher', itemId: 'ob_worm_bait', carried: true });
    });

    it('the bubble says Needs Worm Bait, stays until the bait is carried and in the Bank, and they fish again', () => {
        const river = put('ob_river');
        GameState.state.heroes = [hero('fisher', ['ob_rod'])];
        Orders.orderAt('fisher', AT);
        const { container } = mount(['fisher']);
        act(() => run(3_000));
        expect(bubbles(container, 'fisher')).toEqual(['Needs Worm Bait']);
        // In the Bank but not carried: still needed.
        act(() => { InventoryManager.addItem('ob_worm_bait', 20); });
        expect(bubbles(container, 'fisher')).toEqual(['Needs Worm Bait']);
        act(() => carry('fisher', 1, 'ob_worm_bait'));
        expect(bubbles(container, 'fisher')).toEqual([]);
        let landed;
        act(() => { landed = catchesOf(river, () => run(5_000)); });
        expect(landed.length).toBeGreaterThanOrEqual(3);
        expect(BoardState.workerOf(river.id)).toBe('fisher');
    });

    it('carried but run dry, the bubble clears the moment the Bank holds the bait again', () => {
        put('ob_river');
        GameState.state.heroes = [hero('fisher', ['ob_rod', 'ob_worm_bait'])];
        Orders.orderAt('fisher', AT);
        const { container } = mount(['fisher']);
        act(() => run(3_000));
        expect(bubbles(container, 'fisher')).toEqual(['Needs Worm Bait']);
        act(() => { InventoryManager.addItem('ob_worm_bait', 1); });
        expect(bubbles(container, 'fisher')).toEqual([]);
    });

    it('names the bait their tool takes at that water: a rod at the Coast needs Shrimp Bait', () => {
        put('ob_coast');
        GameState.state.heroes = [hero('fisher', ['ob_rod'])];
        Orders.orderAt('fisher', AT);
        const said = saidWhile(() => run(3_000));
        expect(said[0]).toMatchObject({ itemId: 'ob_shrimp_bait', carried: true });
    });
});

describe('the Trap fishes with no bait', () => {
    it('a hero with a Trap and no bait catches Raw Shrimp and never says Needs', () => {
        const coast = put('ob_coast');
        GameState.state.heroes = [hero('trapper', ['ob_trap'])];
        Orders.orderAt('trapper', AT);
        let landed;
        const said = saidWhile(() => { landed = catchesOf(coast, () => run(10_000)); });
        expect(landed.length).toBeGreaterThanOrEqual(8);
        expect(new Set(landed)).toEqual(new Set(['ob_raw_shrimp']));
        expect(said).toEqual([]);
        expect(Fishing.lacksBait(getTokenType('ob_coast'), 'trapper')).toBe(false);
        expect(Fishing.baitNeededOf(getTokenType('ob_coast'), 'trapper')).toBeNull();
    });

    it('a Trap with bait it takes fishes the baited pool', () => {
        const coast = put('ob_coast');
        GameState.state.heroes = [hero('trapper', ['ob_trap', 'ob_worm_bait'])];
        InventoryManager.addItem('ob_worm_bait', 2);
        Orders.orderAt('trapper', AT);
        const landed = catchesOf(coast, () => run(5_000));
        expect(landed.slice(0, 2)).toEqual(['ob_lobster', 'ob_lobster']);
        expect(new Set(landed.slice(2))).toEqual(new Set(['ob_raw_shrimp']));
    });
});

describe('at a Field, no seed, no waiting', () => {
    function stoppedField() {
        const field = put('ob_field');
        expect(StationRecipe.setSelectedRecipe(field, 'ob_recipe_wheat')).toBe(true);
        GameState.state.heroes = [hero('farmer')];
        return field;
    }

    it('the hero lets go and says Needs Wheat Seed; the Field keeps its yellow mark', () => {
        const field = stoppedField();
        Orders.orderAt('farmer', AT);
        const said = saidWhile(() => run(3_000));
        expect(Growth.growthAlertOf(field.id)).toEqual({ alert: ALERT.GROW_NEEDS_ITEM, needs: ['ob_wheat_seed'] });
        expect(Fields.seedNeededOf(field)).toEqual({ itemId: 'ob_wheat_seed', needed: 1 });
        expect(BoardState.workerOf(field.id)).toBeNull();
        expect(Flags.pinnedIdOf('farmer')).toBe(field.id);
        expect(said.length).toBeGreaterThan(0);
        expect(said[0]).toEqual({ instanceId: field.id, heroId: 'farmer', itemId: 'ob_wheat_seed', needed: 1 });
    });

    it('the bubble says Needs Wheat Seed until the Bank holds the seed, and the Field sows', () => {
        const field = stoppedField();
        Orders.orderAt('farmer', AT);
        const { container } = mount(['farmer']);
        act(() => run(3_000));
        expect(bubbles(container, 'farmer')).toEqual(['Needs Wheat Seed']);
        act(() => { InventoryManager.addItem('ob_wheat_seed', 1); });
        expect(bubbles(container, 'farmer')).toEqual([]);
        act(() => run(200));
        expect(Fields.stageOf(field)).toBe(Fields.STAGE.GROWING);
    });

    it('a growing Field is waited out in silence', () => {
        const field = stoppedField();
        InventoryManager.addItem('ob_wheat_seed', 1);
        Orders.orderAt('farmer', AT);
        const said = saidWhile(() => run(3_000));
        expect(Fields.stageOf(field)).toBe(Fields.STAGE.GROWING);
        expect(said).toEqual([]);
    });
});

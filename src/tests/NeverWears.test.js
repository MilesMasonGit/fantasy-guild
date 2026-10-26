import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Charges from '../systems/board/Charges.js';
import * as Flags from '../systems/board/Flags.js';
import * as RecipeResolver from '../systems/board/RecipeResolver.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { ALERT, BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { neverWearsReason, neverWearsOut, NEVER_WEARS } from '../systems/core/wearRule.js';
import { getTokenType, registerTokenTypes, tokenStartingUses, neverWearsOutType } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { pickRecipe } from './fixtures/stations.js';
import { clearMat } from './fixtures/mat.js';

/**
 * Stations and supports never wear out (brief 230 S1a; owner, 2026-10-24: stations like gear,
 * supports "build once, help forever"). A `Works as` station and a Token whose rules help its
 * neighbours are unlimited whatever their type or a saved copy says. A gathering node keeps its
 * charges (they are what is gathered) even when it also helps its neighbours, but only its own
 * gathering spends them: help is free (owner, 2026-10-24). An enemy keeps the kills that clear it.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const gather = { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }] };
const process = { ...gather, inputs: [{ itemId: 'item_coal', quantity: 1 }] };
const yieldTo = (reach, extra = {}) => ({
    id: `stm_${Math.random().toString(36).slice(2)}`, keyword: KEYWORD.PROVIDES, to: { mode: 'all' }, reach,
    payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.05 }, ...extra
});

describe('the rule, read off what a Token has', () => {
    it('a Works as station never wears', () => {
        expect(neverWearsReason({ uses: 5000, statements: [{ keyword: KEYWORD.STATION, payload: { skill: 'cooking' } }] }))
            .toBe(NEVER_WEARS.STATION);
    });

    it('a support never wears: an Acts as rule, a legacy provided tag, a standing Provides or Grants reaching past itself', () => {
        expect(neverWearsReason({ uses: 20, statements: [{ keyword: KEYWORD.ACTS_AS, payload: { tag: 'anvil', tier: 1 } }] })).toBe(NEVER_WEARS.SUPPORT);
        expect(neverWearsReason({ uses: 20, provides: [{ tag: 'anvil', minTier: 1 }] })).toBe(NEVER_WEARS.SUPPORT);
        expect(neverWearsReason({ uses: 60, statements: [yieldTo('nearby')] })).toBe(NEVER_WEARS.SUPPORT);
        expect(neverWearsReason({ uses: 60, statements: [yieldTo(undefined)] })).toBe(NEVER_WEARS.SUPPORT);
        expect(neverWearsReason({ uses: 60, statements: [yieldTo('self_and_nearby')] })).toBe(NEVER_WEARS.SUPPORT);
        expect(neverWearsReason({ uses: 60, statements: [yieldTo('board')] })).toBe(NEVER_WEARS.SUPPORT);
        expect(neverWearsReason({ uses: 60, statements: [{ ...yieldTo('nearby'), keyword: KEYWORD.GRANTS,
            payload: { type: EFFECT_TYPES.BONUS_DROP, itemId: 'item_bones', chance: 10, quantity: 1 } }] })).toBe(NEVER_WEARS.SUPPORT);
    });

    it('a processing Token that helps its neighbours is a support (the Windmill’s shape)', () => {
        expect(neverWearsReason({ uses: 1000, config: process, statements: [yieldTo('nearby')] })).toBe(NEVER_WEARS.SUPPORT);
    });

    it('a gathering node keeps its charges, aura or not; so does an enemy', () => {
        expect(neverWearsReason({ uses: 25, config: gather, statements: [yieldTo('nearby')] })).toBeNull();
        expect(neverWearsReason({ uses: 5, config: gather })).toBeNull();
        expect(neverWearsReason({ uses: 3, enemy: { level: 2 }, statements: [yieldTo('nearby')] })).toBeNull();
    });

    it('a rule that reaches only itself, or fires on a moment, is not help by standing', () => {
        expect(neverWearsReason({ uses: 10, statements: [yieldTo('self')] })).toBeNull();
        expect(neverWearsReason({ uses: 10, statements: [yieldTo('nearby', { when: { event: 'CYCLE_COMPLETE', scope: 'nearby' } })] })).toBeNull();
        expect(neverWearsReason({ uses: 10 })).toBeNull();
        expect(neverWearsReason(null)).toBeNull();
        expect(neverWearsOut({ uses: 10 })).toBe(false);
    });
});

describe('⭐ shipped content', () => {
    it.each([
        ['token_grandma_s_kitchen', NEVER_WEARS.STATION],
        ['token_ceramics_kiln', NEVER_WEARS.STATION],
        ['token_windmill', NEVER_WEARS.STATION],
        ['token_coast', NEVER_WEARS.WATER],
        ['token_copper_anvil', NEVER_WEARS.SUPPORT]
    ])('%s never wears out and starts unlimited', (id, reason) => {
        const def = getTokenType(id);
        expect(def, `${id} is shipped`).toBeTruthy();
        expect(def.uses).toBeNull();                // the owner cleared the Charges once authored
        expect(neverWearsReason(def)).toBe(reason);
        expect(tokenStartingUses(id)).toBeNull();
    });

    it.each(['token_blackberry_bush', 'token_shrimp_coast', 'token_oak_tree', 'token_copper_ore_vein'])(
        '%s keeps its charges', (id) => {
            expect(neverWearsOutType(id)).toBe(false);
            expect(tokenStartingUses(id)).toBe(getTokenType(id).uses);
        });
});

// ---------------------------------------------------------------------------
// On the board
// ---------------------------------------------------------------------------

registerTokenTypes({
    nw_station: {
        id: 'nw_station', name: 'NW Station', tokenType: 'station', rarity: 'common', theme: 'fixture',
        uses: 10, sprite: 's_industry', config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 10000, xp: 1 },
        statements: [{ id: 'stm_nw_station', keyword: KEYWORD.STATION, payload: { skill: 'smithing' } }]
    },
    nw_vein: {
        id: 'nw_vein', name: 'NW Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 1000, sprite: 's_industry', config: gather
    },
    /** A Blackberry Bush's shape: a gathering node (3 s, 10 charges) with a bonus drop for its neighbours. */
    nw_bush: {
        id: 'nw_bush', name: 'NW Bush', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 10, sprite: 's_nature', config: { ...gather, skill: 'forestry' },
        statements: [{ id: 'stm_nw_bush', keyword: KEYWORD.GRANTS, to: { mode: 'all' },
            payload: { type: EFFECT_TYPES.BONUS_DROP, itemId: 'item_bones', chance: 10, quantity: 1 } }]
    }
});

function makeHero(id, level = 50) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level, skills, hp: { current: 100, max: 100 } };
}

const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });
function place(tile, typeId, heroId = null, uses = undefined) {
    const instance = BoardState.createTokenInstance(typeId, uses === undefined ? tokenStartingUses(typeId) : uses);
    Placement.placeTokenAt(instance, C(tile));
    pickRecipe(instance);
    TileModifiers.rebuildAround([instance]);
    if (heroId) Placement.plantFlagAt(heroId, C(tile));
    return instance;
}
const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const coal = () => InventoryManager.getItemCount('item_coal');

const STATION = 15, CONTEXT = 16, OTHER = 14;

beforeAll(() => {
    Flags.init();
    BoardRunner.init();
});
afterAll(() => Flags.teardown());

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    TriggerSystem.init();
    clearMat();
    GameState.state.heroes = [makeHero('hero_1'), makeHero('hero_2')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => clearMat());

describe('⭐ a station never wears out', () => {
    it('a new one is unlimited, and runs its recipe without spending a charge', () => {
        InventoryManager.addItem('item_coal', 5);
        const station = place(STATION, 'nw_station', 'hero_1');
        place(CONTEXT, 'fixture_charged_context_node');
        expect(station.usesRemaining).toBeNull();
        run(10300);
        expect(coal()).toBe(4);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(1);
        expect(station.usesRemaining).toBeNull();
    });

    it('a copy saved holding 2 charges, against a recipe costing 3, runs and keeps its 2', () => {
        InventoryManager.addItem('item_coal', 5);
        const station = place(STATION, 'nw_station', 'hero_1', 2);
        place(CONTEXT, 'fixture_charged_context_node');
        expect(Charges.isUnlimited(station)).toBe(true);
        run(10300);
        expect(station.alert ?? null).not.toBe(ALERT.CHARGES);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(1);
        expect(station.usesRemaining).toBe(2);
        expect(BoardState.getTokenById(station.id)).toBe(station);
    });

    it('a pure context Token pays nothing toward a recipe’s context cost', () => {
        InventoryManager.addItem('item_coal', 5);
        place(STATION, 'nw_station', 'hero_1');
        const context = place(CONTEXT, 'fixture_charged_context', null, 6);
        run(10300);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(1);
        expect(context.usesRemaining).toBe(6);
    });

    it('a gathering node that offers the context pays nothing either: help is free (owner, 2026-10-24)', () => {
        InventoryManager.addItem('item_coal', 5);
        place(STATION, 'nw_station', 'hero_1');
        const node = place(CONTEXT, 'fixture_charged_context_node');
        run(10300);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(1);   // the recipe ran on its context
        expect(node.usesRemaining).toBe(6);
    });
});

describe('⭐ a support never wears out', () => {
    it('a buff beside a worked vein keeps its charges, cycle after cycle', () => {
        const vein = place(STATION, 'nw_vein', 'hero_1');
        const buff = place(CONTEXT, 'fixture_buff_speed', null, 60);
        run(12000);
        expect(vein.usesRemaining).toBeLessThan(1000 - 2);   // it was worked
        expect(buff.usesRemaining).toBe(60);
        expect(BoardState.getTokenById(buff.id)).toBe(buff);
    });

    it('serving two veins does not wear it either', () => {
        const a = place(STATION, 'nw_vein', 'hero_1');
        const b = place(CONTEXT + 1, 'nw_vein', 'hero_2');
        const buff = place(CONTEXT, 'fixture_buff_yield', null, 1);
        run(12000);
        expect(a.usesRemaining).toBeLessThan(1000);
        expect(b.usesRemaining).toBeLessThan(1000);
        expect(buff.usesRemaining).toBe(1);
    });

    it('a kill beside it does not wear it', () => {
        const enemy = place(STATION, 'fixture_enemy', 'hero_1');
        const rack = place(CONTEXT, 'fixture_buff_yield', null, 10);
        let kills = 0;
        const off = EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, (p) => { if (p?.instanceId === enemy.id && p.outcome === 'victory') kills++; });
        run(60000);
        off();
        expect(kills).toBeGreaterThan(0);
        expect(rack.usesRemaining).toBe(10);
    });

    it('⭐ a gathering node that helps its neighbours keeps its charges while they work (help is free)', () => {
        // The Blackberry Bush's shape: berries of its own, and a bonus drop for the Tokens near it.
        const vein = place(STATION, 'nw_vein', 'hero_1');
        place(OTHER, 'nw_vein', 'hero_2');
        const bush = place(CONTEXT - 1 + 6, 'nw_bush');   // spot 21: beside 15, not 14
        expect(RecipeResolver.servesFrom(bush.id)).toContain(vein.id);
        run(6300);
        expect(vein.usesRemaining).toBeLessThan(1000 - 1);   // its neighbour worked
        expect(bush.usesRemaining).toBe(10);
    });

    it('its own harvest still spends them: one per cycle, and it leaves when spent', () => {
        const bush = place(STATION, 'nw_bush', 'hero_1', 2);
        run(3300);
        expect(bush.usesRemaining).toBe(1);
        run(3000);
        expect(BoardState.getTokenById(bush.id)).toBeNull();
    });

    it('a kill beside it spends none either', () => {
        const enemy = place(STATION, 'fixture_enemy', 'hero_1');
        const bush = place(CONTEXT, 'nw_bush', null, 10);
        let kills = 0;
        const off = EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, (p) => { if (p?.instanceId === enemy.id && p.outcome === 'victory') kills++; });
        run(60000);
        off();
        expect(kills).toBeGreaterThan(0);
        expect(bush.usesRemaining).toBe(10);
    });
});

describe('old saves', () => {
    it('a station or support saved with charges reads as unlimited once its board comes in', () => {
        const station = place(STATION, 'nw_station', null, 2);
        const buff = place(CONTEXT, 'fixture_buff_speed', null, 60);
        const vein = place(OTHER, 'nw_vein', null, 7);
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: null });
        expect(station.usesRemaining).toBeNull();
        expect(buff.usesRemaining).toBeNull();
        expect(vein.usesRemaining).toBe(7);
    });

    it('the repair names what it cleared, and nothing else', () => {
        const station = place(STATION, 'nw_station', null, 2);
        place(OTHER, 'nw_vein', null, 7);
        expect(Charges.clearNeverWearingCharges()).toEqual([station.id]);
        expect(Charges.clearNeverWearingCharges()).toEqual([]);
    });
});

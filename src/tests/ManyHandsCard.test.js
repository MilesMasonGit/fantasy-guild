// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { TokenCard } from '../ui/components/board/TokenCard.jsx';
import { tokenCardModel, CARD_BLOCK, SECOND_CLOSED } from '../ui/components/board/tokenCard.js';
import { watchWorkBar } from '../ui/components/board/workBar.js';
import { TokenBubbles } from '../ui/components/board/TokenBubbles.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Many Hands on the Token card (brief 800 P3, owner 2026-11-25): the second picker shows while the
 * station's own hero holds the perk, or once a second recipe is set (7); it lists every recipe but
 * the first (3) and picks or clears the second; the card names the second's problem while the mat's
 * mark stays the first's (4), and the second's cycle is a bar on the card fed by its own progress,
 * never the mat's bar (5).
 */

const material = (id, name) => ({ id, name, type: 'material', stackable: true, equipSlot: '', sprite: 'i_bones' });
registerItems({
    mhcd_wood: material('mhcd_wood', 'Card Wood'), mhcd_hide: material('mhcd_hide', 'Card Hide'),
    mhcd_charcoal: material('mhcd_charcoal', 'Card Charcoal'), mhcd_leather: material('mhcd_leather', 'Card Leather'),
    mhcd_rope: material('mhcd_rope', 'Card Rope')
});
const recipe = (id, name, input, output, durationMs) => ({
    id, name, levelRequirement: 1, requiresContext: [], durationMs, xp: 1,
    inputs: input ? [{ itemId: input, quantity: 1 }] : [], outputs: [{ itemId: output, chance: 100, minQty: 1, maxQty: 1 }]
});
const CHARCOAL = 'mhcd_recipe_charcoal';
const LEATHER = 'mhcd_recipe_leather';
const ROPE = 'mhcd_recipe_rope';
registerRecipePools({
    crafting: [
        recipe(CHARCOAL, 'Card Charcoal', 'mhcd_wood', 'mhcd_charcoal', 1000),
        recipe(LEATHER, 'Card Leather', 'mhcd_hide', 'mhcd_leather', 1500),
        recipe(ROPE, 'Card Rope', null, 'mhcd_rope', 1200)
    ]
});
registerTokenTypes({
    mhcd_bench: {
        id: 'mhcd_bench', name: 'Card Workbench', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_industry', requiresHero: true,
        config: { skill: 'crafting', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_mhcd_works', keyword: KEYWORD.STATION, payload: { skill: 'crafting' } }]
    }
});
registerEffects({
    mhcd_many_hands: {
        id: 'mhcd_many_hands', name: 'Many Hands',
        statements: [{ id: 'stm_mhcd_mh', keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby', payload: { type: EFFECT_TYPES.SECOND_RECIPE, bucket: 'flat', value: 1, category: 'crafting' } }]
    }
});

const hero = (id, crafting) => ({ id, name: id, status: 'idle', level: 10, hp: { current: 100, max: 100 }, skills: { crafting: { level: crafting, xp: 0 } } });
const AT = { x: 800, y: 500 };
const h = React.createElement;
const mount = (el) => render(h(DndContext, null, el));
const second = (instanceId) => tokenCardModel('mhcd_bench', instanceId).blocks.find(b => b.id === CARD_BLOCK.SECOND) || null;
const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

beforeAll(() => Flags.init());
afterAll(() => {
    registerSkillPerks({ crafting: { perks: [] } });
    Flags.teardown();
});
afterEach(() => cleanup());
beforeEach(() => {
    registerSkillPerks({ crafting: { perks: [{ level: 99, effectId: 'mhcd_many_hands' }] } });
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.clearAll();
    BoardRunner.init();
    Flags.init();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [hero('master', 99), hero('novice', 50)];
    GameState.state.inventory.maxSlots = 50;
});

function bench(heroId, { secondId = null } = {}) {
    const token = placeAt('mhcd_bench', AT.x, AT.y);
    StationRecipe.setSelectedRecipe(token, CHARCOAL);
    if (secondId) StationRecipe.setSecondRecipe(token, secondId);
    TileModifiers.rebuildAround([AT]);
    if (heroId) {
        Orders.orderAt(heroId, AT);
        for (let i = 0; i < 30 && BoardState.workerOf(token.id) !== heroId; i++) BoardRunner.tick(100);
        expect(BoardState.workerOf(token.id)).toBe(heroId);
    }
    return token;
}

describe('ruling 7: when the second picker shows', () => {
    it('not on a station nobody holding the perk works, with no second recipe set', () => {
        InventoryManager.addItem('mhcd_wood', 20);
        expect(second(bench(null).id)).toBeNull();
        clearMat();
        expect(second(bench('novice').id)).toBeNull();
    });

    it('while the station\'s own hero holds it: nothing chosen yet, and a button to choose', () => {
        InventoryManager.addItem('mhcd_wood', 20);
        const b = second(bench('master').id);
        expect(b).toMatchObject({ open: true, recipeId: null, change: { label: 'Choose a second recipe', chosen: false, empty: 'No second recipe chosen' } });
        expect(b.problem).toBeNull();
    });

    it('once a second recipe is set, whoever works it: closed, it says why', () => {
        InventoryManager.addItem('mhcd_wood', 20);
        const token = bench('novice', { secondId: LEATHER });
        const b = second(token.id);
        expect(b).toMatchObject({ open: false, recipeId: LEATHER, recipeName: 'Card Leather', change: { label: 'Change second recipe', chosen: true } });
        expect(b.problem).toMatchObject({ kind: SECOND_CLOSED });
        expect(b.problem.text).toMatch(/Second Recipe/);
        // Nobody on it at all: still shown, since one is set.
        Flags.sendHome('novice');
        run(100);
        expect(second(token.id)).toMatchObject({ open: false, recipeId: LEATHER });
    });
});

describe('what the second\'s section says', () => {
    it('its needs against the Bank, its loot, its time; the first recipe\'s block is untouched', () => {
        InventoryManager.addItem('mhcd_wood', 20);
        InventoryManager.addItem('mhcd_hide', 3);
        const token = bench('master', { secondId: LEATHER });
        const model = tokenCardModel('mhcd_bench', token.id);
        const first = model.blocks.find(b => b.id === CARD_BLOCK.RECIPE);
        expect(first).toMatchObject({ recipeId: CHARCOAL, needs: [{ itemId: 'mhcd_wood', need: 1, have: 20 }] });
        const b = model.blocks.find(b => b.id === CARD_BLOCK.SECOND);
        expect(b).toMatchObject({ open: true, recipeId: LEATHER, needs: [{ itemId: 'mhcd_hide', need: 1, have: 3 }], cycleMs: 1500, tools: [] });
        expect(b.makes).toEqual([{ itemId: 'mhcd_leather', min: 1, max: 1, chance: null }]);
        // Right after the first recipe's block.
        const ids = model.blocks.map(x => x.id);
        expect(ids.indexOf(CARD_BLOCK.SECOND)).toBe(ids.indexOf(CARD_BLOCK.RECIPE) + 1);
    });

    it('ruling 4: the second short names its own want on the card; the mat\'s mark stays clear', () => {
        InventoryManager.addItem('mhcd_wood', 20);
        const token = bench('master', { secondId: LEATHER });
        run(500);
        expect(token.alert ?? null).toBeNull();
        expect(token.secondAlert).toBe(ALERT.INPUTS);
        expect(second(token.id).problem).toMatchObject({ kind: ALERT.INPUTS, text: 'Needs Card Hide' });
        const view = mount(h(TokenCard, { typeId: 'mhcd_bench', instanceId: token.id, onClose: () => {} }));
        const root = view.container;
        expect(root.querySelector('[data-card-second-problem="inputs"]')?.textContent).toBe('Needs Card Hide');
        // The card's own problem line is the first recipe's: nothing wrong there.
        expect(root.querySelector('[data-card-block="problem"]')).toBeNull();
        expect(root.querySelector('[data-card-block="second-requires"]')).not.toBeNull();
        expect(root.querySelector('[data-card-block="second-makes"]')).not.toBeNull();
    });

    it('ruling 4: the first short names its want on the card\'s problem line, the second runs clear', () => {
        InventoryManager.addItem('mhcd_hide', 20);
        const token = bench('master', { secondId: LEATHER });
        run(500);
        const view = mount(h(TokenCard, { typeId: 'mhcd_bench', instanceId: token.id, onClose: () => {} }));
        const root = view.container;
        expect(root.querySelector('[data-card-block="problem"]')?.textContent).toMatch(/Needs Card Wood/);
        expect(root.querySelector('[data-card-second-problem]')).toBeNull();
        expect(root.querySelector('[data-card-second-progress]')).not.toBeNull();
    });
});

describe('the second picker', () => {
    it('lists every recipe but the first, picks the second, and clears it', () => {
        InventoryManager.addItem('mhcd_wood', 20);
        const token = bench('master');
        const view = mount(h(TokenCard, { typeId: 'mhcd_bench', instanceId: token.id, onClose: () => {} }));
        const root = view.container;
        act(() => { fireEvent.click(root.querySelector('[data-card-change-second]')); });
        expect(root.querySelector('[data-token-card]').getAttribute('data-card-view')).toBe('second');
        const offered = [...root.querySelectorAll('[data-recipe-id]')].map(el => el.getAttribute('data-recipe-id'));
        expect(offered).toEqual(expect.arrayContaining([LEATHER, ROPE]));
        expect(offered).not.toContain(CHARCOAL);
        // Nothing set yet: no way to clear.
        expect(root.querySelector('[data-recipe-clear]')).toBeNull();
        act(() => { fireEvent.click(root.querySelector(`[data-recipe-id="${ROPE}"]`)); });
        expect(token.secondRecipeId).toBe(ROPE);
        expect(token.selectedRecipeId).toBe(CHARCOAL);
        expect(root.querySelector('[data-token-card]').getAttribute('data-card-view')).toBe('card');
        expect(root.querySelector(`[data-card-second-link="${ROPE}"]`)).not.toBeNull();

        act(() => { fireEvent.click(root.querySelector('[data-card-change-second]')); });
        expect(root.querySelector(`[data-recipe-id="${ROPE}"]`)?.getAttribute('data-recipe-selected')).toBe('true');
        act(() => { fireEvent.click(root.querySelector('[data-recipe-clear]')); });
        expect(token.secondRecipeId).toBeUndefined();
        expect(root.querySelector('[data-card-second-link]')).toBeNull();
    });

    it('the first recipe\'s list is the whole pool still', () => {
        InventoryManager.addItem('mhcd_wood', 20);
        const token = bench('master', { secondId: LEATHER });
        const view = mount(h(TokenCard, { typeId: 'mhcd_bench', instanceId: token.id, onClose: () => {} }));
        const root = view.container;
        act(() => { fireEvent.click(root.querySelector('[data-card-change-recipe]')); });
        const offered = [...root.querySelectorAll('[data-recipe-id]')].map(el => el.getAttribute('data-recipe-id'));
        expect(offered).toEqual(expect.arrayContaining([CHARCOAL, LEATHER, ROPE]));
    });
});

describe('ruling 5: the second\'s cycle is the card\'s bar, never the mat\'s', () => {
    it('the card\'s bar follows the second\'s own progress', () => {
        InventoryManager.addItem('mhcd_wood', 20);
        InventoryManager.addItem('mhcd_hide', 20);
        const token = bench('master', { secondId: LEATHER });
        const view = mount(h(TokenCard, { typeId: 'mhcd_bench', instanceId: token.id, onClose: () => {} }));
        const fill = view.container.querySelector('[data-card-second-fill]');
        expect(fill).not.toBeNull();
        act(() => { EventBus.publish(BOARD_EVENTS.SECOND_PROGRESS, { instanceId: token.id, percent: 40, elapsedMs: 600, cycleTimeMs: 1500 }); });
        expect(fill.style.width).toBe('40%');
    });

    it('the mat\'s work bar does not empty when the second finishes; the first\'s end empties it', () => {
        const token = bench(null, { secondId: LEATHER });
        mount(h(TokenBubbles, { instanceId: token.id, token: { typeId: 'mhcd_bench', heroId: 'master', alert: null } }));
        let bar = null;
        const off = watchWorkBar(token.id, (b) => { bar = b; });
        expect(bar).not.toBeNull();
        act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: token.id, percent: 60, elapsedMs: 600, cycleTimeMs: 1000 }); });
        act(() => { EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: token.id, typeId: 'mhcd_bench', heroId: 'master', failed: false, produced: [], lane: 2 }); });
        expect(bar.read(performance.now()).elapsedMs).toBeGreaterThanOrEqual(600);
        act(() => { EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: token.id, typeId: 'mhcd_bench', heroId: 'master', failed: false, produced: [] }); });
        expect(bar.read(performance.now()).elapsedMs).toBeLessThan(300);
        off();
    });
});

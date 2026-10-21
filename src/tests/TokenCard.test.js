// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { pickRecipe } from './fixtures/stations.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { resolveSpritePath } from '../utils/AssetManager.js';
import { TokenCard, coverScale } from '../ui/components/board/TokenCard.jsx';
import { requestRecipeList } from '../ui/components/board/recipeFlip.js';
import { TokenInspectPopup } from '../ui/components/board/TokenInspectPopup.jsx';
import { tokenCardModel, cardArtOf, activityOf, CARD_BLOCK } from '../ui/components/board/tokenCard.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/** The Token card: its blocks in order per kind, the enemy card, one card at a time, its art. */

const CARD_TOKENS = {
    card_pick: {
        id: 'card_pick', name: 'Card Pick', tokenType: 'context', rarity: 'common', uses: 50,
        sprite: 's_industry', isTool: true, provides: [{ tag: 'ctx_card_pick', minTier: 1, chargeCost: 0 }]
    },
    card_vein: {
        id: 'card_vein', name: 'Card Vein', tokenType: 'resource', rarity: 'common', uses: 37,
        sprite: 's_nature',
        acceptedTokens: [{ tag: 'ctx_card_pick', minTier: 1 }],
        respawn: { mode: 'refill', afterMs: 12000 },
        config: {
            skill: 'mining', skillRequired: 20, cycleTimeMs: 4000, xp: 35,
            inputs: [{ itemId: 'fixture_oak_wood', quantity: 3 }],
            outputs: [
                { itemId: 'item_copper_ore', chance: 100, minQty: 1, maxQty: 2 },
                { itemId: 'item_coal', chance: 10, minQty: 1, maxQty: 1 }
            ]
        }
    },
    card_tree: {
        id: 'card_tree', name: 'Card Tree', tokenType: 'resource', rarity: 'common', uses: 10,
        sprite: 's_nature',
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 6000, xp: 2, inputs: [], outputs: [{ itemId: 'fixture_oak_wood', chance: 100, minQty: 1, maxQty: 1 }] }
    },
    card_sapling: {
        id: 'card_sapling', name: 'Card Sapling', tokenType: 'resource', rarity: 'common', uses: null,
        sprite: 's_nature', config: null, grows: { into: 'card_vein', afterMs: 125000 }
    },
    card_spawner: {
        id: 'card_spawner', name: 'Card Mine', tokenType: 'spawner', rarity: 'common', uses: null,
        sprite: 's_nature', requiresHero: false, config: null,
        spawner: { spawns: [{ typeId: 'card_sapling', weight: 1 }], allowance: 5, intervalMs: 40000, upkeep: [] }
    },
    card_enemy: {
        id: 'card_enemy', name: 'Card Goblin', tokenType: 'enemy', rarity: 'common', uses: 1,
        sprite: 'e_goblin', requiresHero: true,
        enemy: { level: 3, style: 'melee', budgetScale: 1 },
        config: {
            skill: '', skillRequired: 1, cycleTimeMs: 12000, xp: 0, inputs: [],
            outputs: [
                { itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 },
                { itemId: 'item_copper_ore', chance: 30, minQty: 1, maxQty: 1 }
            ]
        }
    },
    card_own_art: {
        id: 'card_own_art', name: 'Card Own Art', tokenType: 'resource', rarity: 'common', uses: 5,
        sprite: 's_nature', cardArt: 'b_forge',
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] }
    },
    card_bad_art: {
        id: 'card_bad_art', name: 'Card Bad Art', tokenType: 'resource', rarity: 'common', uses: 5,
        sprite: 's_nature', cardArt: 'b_no_such_picture',
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] }
    }
};
registerTokenTypes(CARD_TOKENS);

const h = React.createElement;
const mount = (...els) => render(
    h(DndContext, null, ...els)
);

function put(typeId, x = 400, y = 300) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, { x, y });
    return instance;
}

const ids = (model) => model.blocks.map(b => b.id);
const domOrder = (root) => [...root.querySelectorAll('[data-card-block]')].map(el => el.getAttribute('data-card-block'));

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());
afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => {
    vi.clearAllMocks();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [];
});

describe('the blocks, top to bottom, per kind', () => {
    it('a gathering node: name, work, cycle, recipe (needs, tools, makes), lifecycle', () => {
        const vein = put('card_vein');
        const model = tokenCardModel('card_vein', vein.id);
        expect(ids(model)).toEqual([CARD_BLOCK.NAME, CARD_BLOCK.WORK, CARD_BLOCK.CYCLE, CARD_BLOCK.RECIPE, CARD_BLOCK.LIFECYCLE]);

        const work = model.blocks[1];
        expect(work).toMatchObject({ skillId: 'mining', level: 20, xp: 35 });
        expect(model.blocks[2]).toMatchObject({ cycleMs: 4000, uses: 37 });
        const recipe = model.blocks[3];
        expect(recipe.needs).toEqual([{ itemId: 'fixture_oak_wood', need: 3, have: 0 }]);
        expect(recipe.tools.map(t => t.typeId)).toEqual(['card_pick']);
        expect(recipe.makes).toEqual([
            { itemId: 'item_copper_ore', min: 1, max: 2, chance: null },
            { itemId: 'item_coal', min: 1, max: 1, chance: 10 }
        ]);
        expect(recipe.change).toBeNull();
        expect(model.blocks[4].lines.map(l => l.icon)).toEqual(['regrow']);

        const { container } = mount(h(TokenCard, { typeId: 'card_vein', instanceId: vein.id }));
        expect(domOrder(container)).toEqual(['name', 'work', 'cycle', 'recipe', 'lifecycle']);
        expect(container.querySelector('[data-card-cycle]').textContent).toBe('4s');
        expect(container.querySelector('[data-card-charges]').textContent).toBe('37');
        // The tool is a hollow bar with no count.
        const tool = container.querySelector('[data-card-tool="card_pick"]');
        expect(tool.className).toContain('bg-transparent');
        expect(tool.querySelector('[data-item-bar-count]').textContent).toBe('');
    });

    it('needs read have/need, red when short', () => {
        const vein = put('card_vein');
        InventoryManager.addItem('fixture_oak_wood', 1);
        const { container } = mount(h(TokenCard, { typeId: 'card_vein', instanceId: vein.id }));
        const need = container.querySelector('[data-card-needs] [data-item-bar]');
        expect(need.textContent).toContain('1/3');
        expect(need.className).toContain('border-gi-danger/40');
    });

    it('a station: the current recipe only, with Change recipe', () => {
        const station = pickRecipe(put('fixture_station'), 'recipe_a');
        const model = tokenCardModel('fixture_station', station.id);
        expect(ids(model)).toEqual([CARD_BLOCK.NAME, CARD_BLOCK.WORK, CARD_BLOCK.CYCLE, CARD_BLOCK.RECIPE]);
        const recipe = model.blocks[3];
        expect(recipe.needs.map(n => n.itemId)).toEqual(['item_coal']);
        expect(recipe.makes.map(m => m.itemId)).toEqual(['fixture_spider_silk']);
        expect(recipe.tools.map(t => t.typeId)).toEqual(['fixture_context_a']);
        expect(recipe.change).toEqual({ label: 'Change recipe', chosen: true });

    });

    it('Change recipe flips the card to its list on the same art; a click on a row chooses it and flips back', () => {
        GameState.state.heroes = [{ id: 'smith', name: 'Smith', skills: { fixture_station_skill: { level: 10, xp: 0 } } }];
        const station = pickRecipe(put('fixture_station'), 'recipe_a');
        const { container } = mount(h(TokenCard, { typeId: 'fixture_station', instanceId: station.id }));
        const card = () => container.querySelector('[data-token-card]');
        fireEvent.click(container.querySelector('[data-card-change-recipe]'));
        // In place: no window opens over the mat.
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        expect(card().dataset.cardView).toBe('recipes');
        expect(container.querySelector('[data-recipe-selected="true"]').dataset.recipeId).toBe('recipe_a');
        expect(container.querySelector('[data-card-block="name"] h3').textContent).toBe('Fixture Station');

        fireEvent.click(container.querySelector('[data-recipe-id="recipe_b"]'));
        expect(BoardState.getTokenById(station.id).selectedRecipeId).toBe('recipe_b');
        expect(card().dataset.cardView).toBe('card');
    });

    it('the list covers the card with the art at a whole multiple', () => {
        expect(coverScale(256, 256)).toBe(1);
        expect(coverScale(257, 100)).toBe(2);
        expect(coverScale(300, 600)).toBe(3);
        expect(coverScale(0, 0)).toBe(1);
    });

    it('a list asked for before the card opens (the mat gear) opens the card on it', () => {
        GameState.state.heroes = [{ id: 'smith', name: 'Smith', skills: { fixture_station_skill: { level: 10, xp: 0 } } }];
        const station = put('fixture_station');
        requestRecipeList(station.id);
        const { container } = mount(h(TokenCard, { typeId: 'fixture_station', instanceId: station.id }));
        expect(container.querySelector('[data-token-card]').dataset.cardView).toBe('recipes');
        cleanup();
        // Taken once: the next opening is the card.
        const again = mount(h(TokenCard, { typeId: 'fixture_station', instanceId: station.id }));
        expect(again.container.querySelector('[data-token-card]').dataset.cardView).toBe('card');
        act(() => requestRecipeList(station.id));
        expect(again.container.querySelector('[data-token-card]').dataset.cardView).toBe('recipes');
    });

    it('a station with nothing chosen still offers the picker', () => {
        const station = put('fixture_station');
        const recipe = tokenCardModel('fixture_station', station.id).blocks.find(b => b.id === CARD_BLOCK.RECIPE);
        expect(recipe.change).toEqual({ label: 'Change recipe', chosen: false });
        expect(recipe.needs).toEqual([]);
    });

    it('a spawner: name and its spawn line, nothing else', () => {
        const spawner = put('card_spawner');
        const model = tokenCardModel('card_spawner', spawner.id);
        expect(ids(model)).toEqual([CARD_BLOCK.NAME, CARD_BLOCK.LIFECYCLE]);
        const line = model.blocks[1].lines[0];
        expect(line.icon).toBe('spawn');
        expect(line.text).toMatch(/^\d+\/\d+/);
        expect(line.tip).toContain('Spawns Card Sapling');
    });

    it('a growing Token: its grow line counts down', () => {
        const sapling = put('card_sapling');
        const model = tokenCardModel('card_sapling', sapling.id);
        expect(ids(model)).toEqual([CARD_BLOCK.NAME, CARD_BLOCK.LIFECYCLE]);
        expect(model.blocks[1].lines).toEqual([
            expect.objectContaining({ icon: 'grow', text: '2:05', tip: expect.stringContaining('Grows into Card Vein') })
        ]);
    });

    it('a Shop card (no instance) shows the type: starting charges, no recipe picker', () => {
        const model = tokenCardModel('card_vein');
        expect(ids(model)).toEqual([CARD_BLOCK.NAME, CARD_BLOCK.WORK, CARD_BLOCK.CYCLE, CARD_BLOCK.RECIPE]);
        expect(model.blocks[2].uses).toBe(37);
    });

    it('unlimited charges read ∞', () => {
        const station = put('fixture_kitchen');
        station.usesRemaining = null;
        const { container } = mount(h(TokenCard, { typeId: 'fixture_kitchen', instanceId: station.id }));
        expect(container.querySelector('[data-card-charges]').textContent).toBe('∞');
    });
});

describe('the enemy card', () => {
    it('name, HP with numbers, combat line, drops with chances', () => {
        const goblin = put('card_enemy');
        const model = tokenCardModel('card_enemy', goblin.id);
        expect(model.enemy).toBe(true);
        expect(ids(model)).toEqual([CARD_BLOCK.NAME, CARD_BLOCK.HP, CARD_BLOCK.COMBAT, CARD_BLOCK.DROPS]);
        const hp = model.blocks[1];
        expect(hp.cur).toBe(hp.max);
        expect(hp.max).toBeGreaterThan(0);
        expect(model.blocks[2]).toMatchObject({ skillId: 'melee', level: 3 });
        expect(model.blocks[2].xp).toBeGreaterThan(0);
        expect(model.blocks[3].drops.map(d => [d.itemId, d.chance])).toEqual([['item_bones', 100], ['item_copper_ore', 30]]);

        const { container } = mount(h(TokenCard, { typeId: 'card_enemy', instanceId: goblin.id }));
        expect(container.querySelector('[data-token-card]').getAttribute('data-token-card')).toBe('enemy');
        expect(domOrder(container)).toEqual(['name', 'hp', 'combat', 'drops']);
        expect(container.querySelector('[data-card-hp-text]').textContent).toBe(`${hp.max}/${hp.max}`);
        expect(container.querySelectorAll('[data-card-block="drops"] [data-item-bar]')).toHaveLength(2);
    });

    it('shows the fight’s live HP', () => {
        const goblin = put('card_enemy');
        const spy = vi.spyOn(BoardCombat, 'getFight').mockReturnValue({ combat: { enemyHp: { current: 7, max: 20 } } });
        try {
            const hp = tokenCardModel('card_enemy', goblin.id).blocks.find(b => b.id === CARD_BLOCK.HP);
            expect(hp).toMatchObject({ cur: 7, max: 20 });
        } finally {
            spy.mockRestore();
        }
    });
});

describe('the art', () => {
    it('by activity: a mining Token shows the mine scene; a spawner its spawns’ activity', () => {
        expect(cardArtOf(getTokenType('card_vein'))).toEqual({ path: resolveSpritePath('b_mine'), source: 'activity' });
        expect(activityOf(getTokenType('card_spawner'))).toBe('mining');
        expect(cardArtOf(getTokenType('card_spawner'))?.path).toBe(resolveSpritePath('b_mine'));
        expect(cardArtOf(getTokenType('fixture_kitchen'))?.path).toBe(resolveSpritePath('b_kitchen'));
    });

    it('a Token with no scene for its activity gets a plain card', () => {
        expect(cardArtOf(getTokenType('card_tree'))).toBeNull();
        expect(cardArtOf(getTokenType('card_enemy'))).toBeNull();
        const tree = put('card_tree');
        const { container } = mount(h(TokenCard, { typeId: 'card_tree', instanceId: tree.id }));
        expect(container.querySelector('[data-token-card]').getAttribute('data-card-art')).toBe('none');
        expect(container.querySelector('[data-card-art-img]')).toBeNull();
    });

    it('the CMS override is read when present, and an unknown picture falls back to the activity', () => {
        expect(cardArtOf(getTokenType('card_own_art'))).toEqual({ path: resolveSpritePath('b_forge'), source: 'override' });
        expect(cardArtOf(getTokenType('card_bad_art'))).toEqual({ path: resolveSpritePath('b_mine'), source: 'activity' });

        const own = put('card_own_art');
        const { container } = mount(h(TokenCard, { typeId: 'card_own_art', instanceId: own.id }));
        expect(container.querySelector('[data-token-card]').getAttribute('data-card-art')).toBe('override');
        const img = container.querySelector('[data-card-art-img]');
        expect(img.getAttribute('src')).toBe(resolveSpritePath('b_forge'));
        expect(img.style.width).toBe('256px');
        expect(img.style.imageRendering).toBe('pixelated');
    });
});

describe('one card at a time', () => {
    const rect = { left: 400, top: 300, right: 464, bottom: 364, width: 64, height: 64, x: 400, y: 300 };
    const popup = (instance, onClose) => h(TokenInspectPopup, {
        typeId: instance.typeId, instanceId: instance.id, anchorRect: rect, onClose
    });

    it('clicking another Token replaces the card: still one, now the other Token’s', () => {
        const vein = put('card_vein');
        const tree = put('card_tree', 700, 300);
        const onClose = vi.fn();
        const view = mount(popup(vein, onClose));
        expect(document.querySelectorAll('[data-token-card]')).toHaveLength(1);
        view.rerender(h(DndContext, null, popup(tree, onClose)));
        const cards = document.querySelectorAll('[data-token-card]');
        expect(cards).toHaveLength(1);
        expect(cards[0].querySelector('h3').textContent).toBe('Card Tree');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('Escape, the X and a click on bare mat close it; a click on a Token does not', async () => {
        vi.useFakeTimers();
        const vein = put('card_vein');
        const onClose = vi.fn();
        mount(popup(vein, onClose));
        await act(async () => { vi.advanceTimersByTime(60); });

        const token = document.createElement('div');
        token.setAttribute('data-token-id', 'someone_else');
        document.body.appendChild(token);
        fireEvent.click(token);
        expect(onClose).not.toHaveBeenCalled();
        token.remove();

        // A window open over the card (its recipe list) takes the Escape instead.
        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        document.body.appendChild(dialog);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();
        dialog.remove();

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);

        fireEvent.click(document.body);
        expect(onClose).toHaveBeenCalledTimes(2);

        fireEvent.click(document.querySelector('[data-card-close]'));
        expect(onClose).toHaveBeenCalledTimes(3);
    });

    it('wears the chamfer frame, at the art’s width', () => {
        const vein = put('card_vein');
        mount(popup(vein, () => {}));
        const frame = document.querySelector('[data-pixel-frame]');
        expect(frame.getAttribute('data-pixel-frame')).toBe('chamfer');
        expect(document.querySelector('[data-token-card-popup]').style.minWidth).toBe(`${256 + 12}px`);
    });

    it('flipping to the list and choosing a recipe keep the card open; Escape in the list goes back first', async () => {
        vi.useFakeTimers();
        GameState.state.heroes = [{ id: 'smith', name: 'Smith', skills: { fixture_station_skill: { level: 10, xp: 0 } } }];
        const station = pickRecipe(put('fixture_station'), 'recipe_a');
        const onClose = vi.fn();
        mount(popup(station, onClose));
        await act(async () => { vi.advanceTimersByTime(60); });
        const view = () => document.querySelector('[data-token-card]').dataset.cardView;

        fireEvent.click(document.querySelector('[data-card-change-recipe]'));
        expect(view()).toBe('recipes');
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(view()).toBe('card');
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(document.querySelector('[data-card-change-recipe]'));
        fireEvent.click(document.querySelector('[data-recipe-id="recipe_b"]'));
        expect(view()).toBe('card');
        expect(onClose).not.toHaveBeenCalled();
        // In the browser the flip has already removed the clicked element when the click
        // reaches the window: that click is still inside the card.
        const gone = document.createElement('button');
        document.querySelector('[data-token-card]').appendChild(gone);
        gone.addEventListener('click', () => gone.remove());
        fireEvent.click(gone);
        expect(onClose).not.toHaveBeenCalled();
    });
});

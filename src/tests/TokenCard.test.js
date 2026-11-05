// @vitest-environment jsdom
import { pushEscapeLayer } from '../ui/utils/escapeLayers.js';
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
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';
import { resolveSpritePath } from '../utils/AssetManager.js';
import { TokenCard, coverScale, artPlacement } from '../ui/components/board/TokenCard.jsx';
import { CARD_LOOKS, getCardLook, setCardLook } from '../ui/components/board/cardLook.js';
import { requestRecipeList } from '../ui/components/board/recipeFlip.js';
import { TokenInspectPopup } from '../ui/components/board/TokenInspectPopup.jsx';
import { tokenCardModel, cardArtOf, activityOf, CARD_BLOCK, cardLifecycle, drivenBy } from '../ui/components/board/tokenCard.js';

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
    card_old_anvil: {
        id: 'card_old_anvil', name: 'Card Old Anvil', tokenType: 'context', rarity: 'common', uses: null,
        sprite: 's_industry', provides: [{ tag: 'ctx_card_retired', minTier: 1, chargeCost: 0 }]
    },
    card_bad_art: {
        id: 'card_bad_art', name: 'Card Bad Art', tokenType: 'resource', rarity: 'common', uses: 5,
        sprite: 's_nature', cardArt: 'b_no_such_picture',
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] }
    },
    card_water: {
        id: 'card_water', name: 'Card Water', tokenType: 'resource', rarity: 'common', uses: null,
        sprite: 't_lake_small', requiresHero: true,
        config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] },
        catchPools: [
            { tool: 'fishing_rod', catches: [{ itemId: 'card_trout', weight: 3 }, { itemId: 'card_salmon', weight: 1 }] },
            { tool: 'fishing_rod', bait: 'card_worm', catches: [{ itemId: 'card_salmon', weight: 1 }] },
            { tool: 'fishing_net', catches: [{ itemId: 'card_shrimp', weight: 1 }] }
        ]
    }
};
registerItems({
    card_trout: { id: 'card_trout', name: 'Card Trout', type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw' },
    card_salmon: { id: 'card_salmon', name: 'Card Salmon', type: 'material', stackable: true, equipSlot: '', sprite: 'i_salmon_raw' },
    card_shrimp: { id: 'card_shrimp', name: 'Card Shrimp', type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw' },
    card_worm: { id: 'card_worm', name: 'Card Worm', type: 'material', stackable: true, equipSlot: 'consumable', sprite: 'i_fish_bait' },
    card_rod: { id: 'card_rod', name: 'Card Rod', type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_rod_wood', tool: { kind: 'fishing_rod', tier: 1 } }
});
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
        expect(domOrder(container)).toEqual(['name', 'stats', 'requires', 'makes', 'lifecycle']);
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
        expect(recipe.change).toEqual({ label: 'Change recipe', chosen: true, empty: 'No recipe chosen' });

        const { container } = mount(h(TokenCard, { typeId: 'fixture_station', instanceId: station.id }));
        expect(domOrder(container)).toEqual(['name', 'stats', 'recipe', 'requires', 'makes']);
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
        expect(recipe.change).toEqual({ label: 'Change recipe', chosen: false, empty: 'No recipe chosen' });
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

    it('a Stump: counts down naming its cost; with no Forest in reach it waits; short of its seedling it is stopped (brief 230 S2a)', () => {
        const names = { tree: 'Oak Sapling', forest: 'Oak Forest', seed: 'Oak Seedling' };
        const growth = (extra) => ({
            inMs: 65000, totalMs: 120000, into: 'tree', paused: false, stopped: false,
            needsNearby: ['forest'], cost: [{ itemId: 'seed', quantity: 1 }], short: [], ...extra
        });
        const line = (g) => cardLifecycle({ id: 'st1', typeId: 'stump' }, { grows: { into: 'tree' } }, {
            tokenName: (id) => names[id] || id, itemName: (id) => names[id] || id, nextGrowth: () => g
        })[0];
        expect(line(growth())).toEqual({ icon: 'grow', text: '1:05', tip: 'Grows into Oak Sapling in 1 min 5 s, for 1 Oak Seedling from the Bank' });
        expect(line(growth({ paused: true }))).toEqual({ icon: 'grow', text: '–', tip: 'Grows into Oak Sapling only with Oak Forest nearby', tone: 'warning' });
        expect(line(growth({ stopped: true, inMs: 0, short: ['seed'] }))).toEqual({ icon: 'grow', text: '–', tip: 'Stopped: needs 1 Oak Seedling to grow into Oak Sapling', tone: 'warning' });
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

describe('what the card says', () => {
    it('the cycle shows the time the work really takes, sped up by what is in reach', () => {
        const vein = put('card_vein', 400, 300);
        const speed = put('fixture_buff_speed', 450, 300);
        TileModifiers.rebuildAround([vein, speed]);
        const cycle = tokenCardModel('card_vein', vein.id).blocks.find(b => b.id === CARD_BLOCK.CYCLE);
        // The very number the engine runs the cycle at.
        expect(cycle).toMatchObject({ cycleMs: TileModifiers.workTimeOf(vein.id, 4000, 'mining'), baseMs: 4000 });
        expect(cycle.cycleMs).toBeCloseTo(3600);
        const { container } = mount(h(TokenCard, { typeId: 'card_vein', instanceId: vein.id }));
        expect(container.querySelector('[data-card-cycle]').textContent).toBe('3.6s');
    });

    it('with nothing in reach, and in the Shop, the cycle is the authored time', () => {
        const vein = put('card_vein', 400, 300);
        expect(tokenCardModel('card_vein', vein.id).blocks.find(b => b.id === CARD_BLOCK.CYCLE).cycleMs).toBe(4000);
        expect(tokenCardModel('card_vein').blocks.find(b => b.id === CARD_BLOCK.CYCLE).cycleMs).toBe(4000);
    });

    it('a Token nothing uses any more says nothing about what it drives', () => {
        expect(drivenBy(getTokenType('card_old_anvil'))).toEqual([]);
        const anvil = put('card_old_anvil');
        expect(ids(tokenCardModel('card_old_anvil', anvil.id))).toEqual([CARD_BLOCK.NAME]);
        const { container } = mount(h(TokenCard, { typeId: 'card_old_anvil', instanceId: anvil.id }));
        expect(container.textContent).not.toMatch(/nothing yet/i);
        expect(container.textContent).not.toMatch(/Drives/);
    });

    it('a tool names what accepts it', () => {
        expect(drivenBy(getTokenType('card_pick'))).toContain('card_vein');
        const pick = put('card_pick');
        const { container } = mount(h(TokenCard, { typeId: 'card_pick', instanceId: pick.id }));
        expect(container.textContent).toContain('Card Vein');
    });

    it('long names in a card ribbon wrap instead of being cut off', () => {
        const vein = put('card_vein');
        const { container } = mount(h(TokenCard, { typeId: 'card_vein', instanceId: vein.id }));
        const names = [...container.querySelectorAll('[data-card-block="makes"] [data-item-bar-name]')];
        expect(names.length).toBeGreaterThan(0);
        for (const el of names) {
            expect(el.className).toContain('break-words');
            expect(el.className).not.toContain('truncate');
        }
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
        expect(domOrder(container)).toEqual(['name', 'stats', 'drops']);
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
        expect(img.style.width).toBe('512px');
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

        // A window opened over the card is the top layer and takes the Escape instead.
        const windowOver = vi.fn();
        const closeWindow = pushEscapeLayer(windowOver);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(windowOver).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
        closeWindow();

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);

        fireEvent.click(document.body);
        expect(onClose).toHaveBeenCalledTimes(2);

        fireEvent.click(document.querySelector('[data-card-close]'));
        expect(onClose).toHaveBeenCalledTimes(3);
    });

    it('wears the chamfer frame, at the card’s width', () => {
        const vein = put('card_vein');
        mount(popup(vein, () => {}));
        const frame = document.querySelector('[data-pixel-frame]');
        expect(frame.getAttribute('data-pixel-frame')).toBe('chamfer');
        expect(document.querySelector('[data-token-card-popup]').style.minWidth).toBe(`${getCardLook().plainWidth + 12}px`);
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

describe('the sections', () => {
    it('the stat block holds skill, XP, time and charges; the name is the header', () => {
        const vein = put('card_vein');
        const { container } = mount(h(TokenCard, { typeId: 'card_vein', instanceId: vein.id, onClose: () => {} }));
        const header = container.querySelector('[data-card-block="name"]');
        expect(header.tagName).toBe('HEADER');
        expect(header.querySelector('h3').textContent).toBe('Card Vein');
        expect(header.querySelector('[data-card-close]')).not.toBeNull();
        const stats = container.querySelector('[data-card-block="stats"]');
        expect(stats.querySelector('[data-card-skill="mining"]').textContent).toContain('20');
        expect(stats.textContent).toContain('+35');
        expect(stats.querySelector('[data-card-cycle]')).not.toBeNull();
        expect(stats.querySelector('[data-card-charges]')).not.toBeNull();
    });

    it('Requires holds the tool and what is used up; Makes what comes out; Events the regrowing', () => {
        const vein = put('card_vein');
        const { container } = mount(h(TokenCard, { typeId: 'card_vein', instanceId: vein.id }));
        const requires = container.querySelector('[data-card-block="requires"]');
        expect(requires.querySelector('[data-card-tool="card_pick"]')).not.toBeNull();
        expect(requires.querySelector('[data-card-needs] [data-item-bar]').textContent).toContain('0/3');
        expect(container.querySelectorAll('[data-card-block="makes"] [data-item-bar]')).toHaveLength(2);
        const events = container.querySelector('[data-card-block="lifecycle"]');
        expect(events.textContent).toContain('Events');
        expect(events.querySelector('[data-card-life="regrow"]').textContent).toContain('Regrows');
    });

    it('a card with nothing for a section leaves it out', () => {
        const tree = put('card_tree');
        const a = mount(h(TokenCard, { typeId: 'card_tree', instanceId: tree.id }));
        expect(domOrder(a.container)).toEqual(['name', 'stats', 'makes']);
        cleanup();
        const b = mount(h(TokenCard, { typeId: 'card_sapling' }));
        expect(domOrder(b.container)).toEqual(['name']);
    });

    it('a demolition or a camp line names itself rather than taking its icon’s word', () => {
        const lines = cardLifecycle({ id: 'x', typeId: 'y', demolish: true }, {}, { workerOf: () => null, demolishMs: 1000 });
        expect(lines[0].label).toBe('Demolition');
    });
});

describe('a water’s catches', () => {
    const fisher = (grid) => ({ id: 'angler', name: 'Angler', status: 'idle', level: 1, skills: { fishing: { level: 5, xp: 0 } },
        hp: { current: 10, max: 10 }, equipment: Array.from({ length: 9 }, (_, i) => grid[i] || null),
        heldCopies: Array.from({ length: 9 }, (_, i) => !!grid[i] && getAllItems()[grid[i]]?.equipSlot === 'hand') });
    const open = (el) => fireEvent.click(el.querySelector('[data-card-collapse]'));

    it('with no hero: everything is in lists by tool, shut until clicked, bait nested inside', () => {
        const water = put('card_water');
        const { container } = mount(h(TokenCard, { typeId: 'card_water', instanceId: water.id }));
        expect(container.querySelector('[data-card-block="makes"]')).toBeNull();
        expect(container.querySelector('[data-card-catch-setup]')).toBeNull();
        const section = container.querySelector('[data-card-block="catch"]');
        const rod = section.querySelector('[data-card-catch-tool="fishing_rod"]');
        expect(section.querySelector('[data-card-catch-tool="fishing_net"]')).not.toBeNull();
        expect(section.querySelectorAll('[data-item-bar]')).toHaveLength(0);
        open(rod);
        expect(rod.querySelector('[data-card-collapse]').dataset.cardCollapse).toBe('open');
        expect(rod.querySelector('[data-card-catch-pool="plain"]').textContent).toContain('No bait');
        expect(rod.querySelector('[data-card-catch-pool="plain"]').textContent).toContain('75%');
        expect(rod.querySelector('[data-card-catch-pool="card_worm"]').textContent).toContain('With Card Worm');
        open(rod);
        expect(rod.querySelector('[data-card-catch-pool="plain"]')).toBeNull();
    });

    it('with a hero: what they land stands open, naming their gear; the rest stay shut', () => {
        const water = put('card_water');
        GameState.state.heroes = [fisher(['card_rod'])];
        const spy = vi.spyOn(BoardState, 'workerOf').mockReturnValue('angler');
        try {
            const { container } = mount(h(TokenCard, { typeId: 'card_water', instanceId: water.id }));
            const setup = container.querySelector('[data-card-catch-setup]');
            expect(setup.textContent).toContain('Angler catches');
            expect(container.querySelector('[data-card-catch-gear]').textContent).toBe('Card Rod, no bait');
            expect(setup.querySelectorAll('[data-item-bar]')).toHaveLength(2);
            expect(setup.textContent).toContain('25%');
            expect([...container.querySelectorAll('[data-card-catch-tool]')].map(el => el.dataset.cardCatchTool)).toEqual(['fishing_rod', 'fishing_net']);
            expect([...container.querySelectorAll('[data-card-collapse]')].every(el => el.dataset.cardCollapse === 'shut')).toBe(true);
        } finally {
            spy.mockRestore();
        }
    });
});

describe('the art and the looks', () => {
    afterEach(() => act(() => setCardLook('banner')));

    it('the art draws at a whole multiple, at least 2×, at whole-pixel offsets', () => {
        expect(artPlacement(320, 160)).toEqual({ scale: 2, left: -96, top: -176 });
        expect(artPlacement(321, 161)).toEqual({ scale: 2, left: Math.round((321 - 512) / 2), top: Math.round((161 - 512) / 2) });
        expect(artPlacement(600, 100).scale).toBe(3);
        for (const [w, h] of [[320, 160], [333, 777], [1025, 5], [0, 0]]) {
            const { scale, left, top } = artPlacement(w, h);
            expect(Number.isInteger(scale) && Number.isInteger(left) && Number.isInteger(top)).toBe(true);
            expect(left === 0 ? 0 : left).toBeLessThanOrEqual(0);
            expect(scale).toBeGreaterThanOrEqual(2);
        }
    });

    it.each(Object.keys(CARD_LOOKS))('look %s lays out the same sections around pixelated art', (id) => {
        act(() => setCardLook(id));
        const vein = put('card_vein');
        const { container } = mount(h(TokenCard, { typeId: 'card_vein', instanceId: vein.id }));
        const card = container.querySelector('[data-token-card]');
        expect(card.dataset.cardLook).toBe(id);
        expect(card.style.width).toBe(`${CARD_LOOKS[id].width}px`);
        expect(domOrder(container)).toEqual(['name', 'stats', 'requires', 'makes', 'lifecycle']);
        const img = container.querySelector('[data-card-art-img]');
        expect(img.style.imageRendering).toBe('pixelated');
        expect(img.style.maxWidth).toBe('none');
        expect(Number(img.dataset.cardArtScale)).toBeGreaterThanOrEqual(2);
    });

    it.each(Object.keys(CARD_LOOKS))('look %s: a card with no art is the plain panel', (id) => {
        act(() => setCardLook(id));
        const tree = put('card_tree');
        const { container } = mount(h(TokenCard, { typeId: 'card_tree', instanceId: tree.id }));
        expect(container.querySelector('[data-card-art-window]')).toBeNull();
        expect(container.querySelector('[data-token-card]').style.width).toBe(`${CARD_LOOKS[id].plainWidth}px`);
    });

    it('an open card follows the QA panel’s pick at once', () => {
        const vein = put('card_vein');
        const { container } = mount(h(TokenCard, { typeId: 'card_vein', instanceId: vein.id }));
        expect(container.querySelector('[data-token-card]').dataset.cardLook).toBe('banner');
        act(() => setCardLook('side'));
        expect(container.querySelector('[data-token-card]').dataset.cardLook).toBe('side');
    });

    it.each(Object.keys(CARD_LOOKS))('look %s: the recipe list keeps the name header', (id) => {
        act(() => setCardLook(id));
        GameState.state.heroes = [{ id: 'smith', name: 'Smith', skills: { fixture_station_skill: { level: 10, xp: 0 } } }];
        const station = pickRecipe(put('fixture_station'), 'recipe_a');
        requestRecipeList(station.id);
        const { container } = mount(h(TokenCard, { typeId: 'fixture_station', instanceId: station.id }));
        expect(container.querySelector('[data-token-card]').dataset.cardView).toBe('recipes');
        expect(container.querySelector('[data-card-block="name"] h3').textContent).toBe('Fixture Station');
        expect(container.querySelector('[data-card-panel] [data-recipe-list]')).not.toBeNull();
    });
});

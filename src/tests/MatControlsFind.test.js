// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { SpriteLayerView } from '../ui/components/board/SpriteLayerView.jsx';
import { MatControls, FIND_BUTTONS } from '../ui/components/board/MatControls.jsx';
import { DOCK_STRIP_PX } from '../ui/components/dock/dockHeroView.js';
import { foundOnMat, findMarkOf, madeItemIds } from '../ui/components/board/matFind.js';
import {
    FIND_CATEGORY, getMatFind, setFindCategory, setFindText, clearMatFind, getFindText
} from '../ui/hooks/useMatFind.js';
import { escapeLayerCount } from '../ui/utils/escapeLayers.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **The Controls strip's Find** (playmat declutter §9): Heroes, Tokens, Enemies and Items light
 * every match while hovered; the search box lights names and Tokens that make the item named while
 * it has text. Matches wear the white outline; everything else fades a little.
 */

const h = React.createElement;

registerTokenTypes({
    fixture_find_vein: {
        id: 'fixture_find_vein', name: 'Copper Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 12000, xp: 4, inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }] }
    },
    fixture_find_tree: {
        id: 'fixture_find_tree', name: 'Find Oak', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 12000, xp: 4, inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }] }
    }
});

// --- What matches (pure) -----------------------------------------------------------------------

const readers = {
    tokenName: (typeId) => ({ vein: 'Copper Vein', smelter: 'Smelter', forest: 'Oak Forest', goblin: 'Goblin' }[typeId]),
    isEnemy: (typeId) => typeId === 'goblin',
    itemName: (itemId) => ({ bar: 'Copper Bar', wood: 'Oak Wood', ore: 'Copper Ore' }[itemId]),
    madeItemIds: (id) => ({ s1: ['bar'], s2: [], f1: ['wood'], v1: ['ore'] }[id] || [])
};
const mat = {
    tokens: [
        { id: 'v1', typeId: 'vein' }, { id: 's1', typeId: 'smelter' }, { id: 's2', typeId: 'smelter' },
        { id: 'f1', typeId: 'forest' }, { id: 'g1', typeId: 'goblin' }
    ],
    heroes: [{ heroId: 'h1', name: 'Coppelia' }, { heroId: 'h2', name: 'Slate' }],
    loot: [{ id: 'l1' }, { id: 'l2' }]
};
const ids = (found) => ({ tokens: [...found.tokens], heroes: [...found.heroes], loot: [...found.loot] });

describe('⭐ what a find lights', () => {
    it('nothing asked, nothing lit: the mat draws as always', () => {
        expect(foundOnMat(null, mat, readers)).toBeNull();
        expect(foundOnMat({ text: '   ' }, mat, readers)).toBeNull();
        expect(findMarkOf(null, 'tokens', 'v1')).toBeNull();
    });

    it('⭐ each category lights every match of its kind and nothing else', () => {
        expect(ids(foundOnMat({ category: FIND_CATEGORY.HEROES }, mat, readers))).toEqual({ tokens: [], heroes: ['h1', 'h2'], loot: [] });
        expect(ids(foundOnMat({ category: FIND_CATEGORY.TOKENS }, mat, readers))).toEqual({ tokens: ['v1', 's1', 's2', 'f1'], heroes: [], loot: [] });
        expect(ids(foundOnMat({ category: FIND_CATEGORY.ENEMIES }, mat, readers))).toEqual({ tokens: ['g1'], heroes: [], loot: [] });
        expect(ids(foundOnMat({ category: FIND_CATEGORY.ITEMS }, mat, readers))).toEqual({ tokens: [], heroes: [], loot: ['l1', 'l2'] });
    });

    it('⭐ the search lights names (heroes, Tokens, enemies) and Tokens making the item named, any case; never floor loot', () => {
        // Copper lights the Copper Vein (its name), the Smelter making Copper Bars, and Coppelia; not the idle Smelter.
        expect(ids(foundOnMat({ text: 'copper' }, mat, readers))).toEqual({ tokens: ['v1', 's1'], heroes: [], loot: [] });
        expect(ids(foundOnMat({ text: 'COPP' }, mat, readers))).toEqual({ tokens: ['v1', 's1'], heroes: ['h1'], loot: [] });
        expect(ids(foundOnMat({ text: 'goblin' }, mat, readers)).tokens).toEqual(['g1']);
        expect(ids(foundOnMat({ text: 'wood' }, mat, readers)).tokens).toEqual(['f1']);
        expect(ids(foundOnMat({ text: 'slate' }, mat, readers)).heroes).toEqual(['h2']);
    });

    it('a match is marked, the rest fade', () => {
        const found = foundOnMat({ category: FIND_CATEGORY.ENEMIES }, mat, readers);
        expect(findMarkOf(found, 'tokens', 'g1')).toBe('match');
        expect(findMarkOf(found, 'tokens', 'v1')).toBe('dim');
        expect(findMarkOf(found, 'heroes', 'h1')).toBe('dim');
        expect(findMarkOf(found, 'loot', 'l1')).toBe('dim');
    });

    it('the live reader: a Token makes its own work\'s output', () => {
        GameState.initNew();
        clearMat();
        const vein = placeAt('fixture_find_vein', 400, 400);
        expect(madeItemIds(vein.id)).toEqual(['fixture_copper_ore']);
        expect(madeItemIds('no_such_token')).toEqual([]);
    });
});

describe('⭐ the find store', () => {
    afterEach(() => clearMatFind());

    it('a hovered category wins over the box\'s text, and the text comes back after', () => {
        setFindText('  oak ');
        expect(getMatFind()).toEqual({ text: 'oak' });
        setFindCategory(FIND_CATEGORY.HEROES);
        expect(getMatFind()).toEqual({ category: 'heroes' });
        setFindCategory(null);
        expect(getMatFind()).toEqual({ text: 'oak' });
        expect(getFindText()).toBe('  oak ');
    });

    it('the same find keeps its identity, so the mat does not work it out again', () => {
        setFindText('oak');
        const first = getMatFind();
        setFindText('oak ');
        expect(getMatFind()).toBe(first);
        setFindCategory('not a category');
        expect(getMatFind()).toBe(first);
    });
});

// --- The strip ---------------------------------------------------------------------------------

describe('⭐ the Controls button and its panel', () => {
    afterEach(() => { cleanup(); clearMatFind(); });

    const button = (c) => c.querySelector('[data-mat-controls-button]');
    const panel = (c) => c.querySelector('[data-mat-controls-panel]');
    const mountOpen = () => {
        const view = render(h(MatControls));
        fireEvent.click(button(view.container));
        return view;
    };

    it('⭐ one square button the hero bar\'s height, laid over the foot at its left, taking no room', () => {
        const { container } = render(h(MatControls));
        const b = button(container);
        expect(b.style.width).toBe(`${DOCK_STRIP_PX}px`);
        expect(b.style.height).toBe(`${DOCK_STRIP_PX}px`);
        expect(b.getAttribute('aria-label')).toBe('Controls');
        expect(b.getAttribute('aria-expanded')).toBe('false');
        const root = container.querySelector('[data-mat-controls]');
        expect(root.className.split(' ')).toEqual(expect.arrayContaining(['absolute', 'left-0', 'bottom-0']));
        expect(panel(container)).toBeNull();
    });

    it('⭐ a click opens the panel upward from the button: Demolish, then Heroes, Tokens, Enemies, Items, then the search box, one per row', () => {
        const { container } = mountOpen();
        const p = panel(container);
        expect(button(container).getAttribute('aria-expanded')).toBe('true');
        expect(p.className.split(' ')).toEqual(expect.arrayContaining(['absolute', 'bottom-full', 'left-0']));
        expect(p.getAttribute('data-pixel-frame')).toBe('chamfer');
        expect(p.querySelector('.ui-frame-chamfer').className).toContain('flex-col');
        const order = [...p.querySelectorAll('[data-map-mode-toggle], [data-find-category], [data-find-search]')]
            .map(e => e.getAttribute('data-map-mode-toggle') || e.getAttribute('data-find-category') || 'search');
        expect(order).toEqual(['demolish', 'heroes', 'tokens', 'enemies', 'items', 'search']);
        expect(FIND_BUTTONS.map(b => b.category)).toEqual(['heroes', 'tokens', 'enemies', 'items']);
        expect([...p.querySelectorAll('[data-find-category]')].map(e => e.textContent)).toEqual(['Heroes', 'Tokens', 'Enemies', 'Items']);
    });

    it('⭐ a second click, Esc or a click outside closes it', () => {
        const { container } = mountOpen();
        fireEvent.click(button(container));
        expect(panel(container)).toBeNull();
        fireEvent.click(button(container));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(panel(container)).toBeNull();
        fireEvent.click(button(container));
        // A press inside the panel keeps it.
        fireEvent.pointerDown(panel(container).querySelector('[data-find-category="heroes"]'));
        expect(panel(container)).not.toBeNull();
        fireEvent.pointerDown(document.body);
        expect(panel(container)).toBeNull();
    });

    it('⭐ a Find row lights its category while hovered, and moving off ends it', () => {
        const { container } = mountOpen();
        const enemies = container.querySelector('[data-find-category="enemies"]');
        fireEvent.pointerEnter(enemies);
        expect(getMatFind()).toEqual({ category: 'enemies' });
        expect(enemies.getAttribute('data-lit')).toBe('true');
        fireEvent.pointerLeave(enemies);
        expect(getMatFind()).toBeNull();
        expect(enemies.getAttribute('data-lit')).toBe('false');
    });

    it('⭐ a hover shows the row\'s tooltip', () => {
        const { container } = mountOpen();
        fireEvent.pointerEnter(container.querySelector('[data-find-category="items"]'), { clientX: 10, clientY: 10 });
        expect(document.body.textContent).toContain('lying on the mat');
    });

    it('⭐ the search box lights while it has text and the panel is open; emptying it, Esc or closing the panel ends it', () => {
        const { container } = mountOpen();
        const input = () => container.querySelector('[data-find-search-input]');
        fireEvent.change(input(), { target: { value: 'copper' } });
        expect(getMatFind()).toEqual({ text: 'copper' });
        fireEvent.change(input(), { target: { value: '' } });
        expect(getMatFind()).toBeNull();
        fireEvent.change(input(), { target: { value: 'oak' } });
        expect(escapeLayerCount()).toBeGreaterThan(0);
        fireEvent.keyDown(input(), { key: 'Escape' });
        expect(getMatFind()).toBeNull();
        expect(input().value).toBe('');
        // Esc cleared the text first; the panel is still open, and closing it ends a new search.
        expect(panel(container)).not.toBeNull();
        fireEvent.change(input(), { target: { value: 'oak' } });
        fireEvent.click(button(container));
        expect(getMatFind()).toBeNull();
        expect(getFindText()).toBe('');
    });

    it('⭐ leaving the playmat closes the panel and ends the find', () => {
        const { container, rerender } = mountOpen();
        fireEvent.change(container.querySelector('[data-find-search-input]'), { target: { value: 'oak' } });
        rerender(h(MatControls, { away: true }));
        expect(getMatFind()).toBeNull();
        expect(container.querySelector('[data-mat-controls]').style.visibility).toBe('hidden');
        expect(panel(container)).toBeNull();
    });
});

// --- On the mat --------------------------------------------------------------------------------

describe('⭐ matches on the mat: a white outline, the rest faded', () => {
    beforeAll(() => Flags.init());
    afterAll(() => Flags.teardown());
    beforeEach(() => {
        GameState.initNew();
        GameState.state.heroes = [];
        InventoryManager.init();
        SpriteLayer.init();
        clearMat();
    });
    afterEach(() => { cleanup(); clearMatFind(); });

    const mount = () => render(h(DeckDndProvider, null, h(MatFitProvider, { value: 1 }, h(MatBoard))));
    const art = (c, id) => c.querySelector(`[data-token-art][data-token-id="${id}"]`);
    const hero = (c, id) => c.querySelector(`[data-board-hero="${id}"]`);

    it('⭐ Tokens: every Token outlined white, the hero faded; no find, neither', () => {
        const vein = placeAt('fixture_find_vein', 300, 300);
        const tree = placeAt('fixture_find_tree', 900, 300);
        GameState.state.heroes.push({ id: 'h1', name: 'Coppelia', spriteId: 'recruit', status: 'idle', level: 5, skills: {}, hp: { current: 100, max: 100 } });
        Orders.orderAt('h1', { x: 600, y: 700 });
        const { container } = mount();
        expect(art(container, vein.id).hasAttribute('data-find')).toBe(false);
        expect(hero(container, 'h1').hasAttribute('data-find')).toBe(false);

        act(() => setFindCategory(FIND_CATEGORY.TOKENS));
        for (const t of [vein, tree]) {
            expect(art(container, t.id).getAttribute('data-find')).toBe('match');
            expect(art(container, t.id).getAttribute('data-outline')).toBe('hover');
        }
        expect(hero(container, 'h1').getAttribute('data-find')).toBe('dim');

        act(() => setFindCategory(FIND_CATEGORY.HEROES));
        expect(hero(container, 'h1').getAttribute('data-find')).toBe('match');
        expect(hero(container, 'h1').getAttribute('data-outline')).toBe('hover');
        expect(art(container, vein.id).getAttribute('data-find')).toBe('dim');
        expect(art(container, vein.id).hasAttribute('data-outline')).toBe(false);

        act(() => setFindCategory(null));
        expect(art(container, vein.id).hasAttribute('data-find')).toBe(false);
        expect(hero(container, 'h1').hasAttribute('data-outline')).toBe(false);
    });

    it('⭐ the search: copper lights the hero by name and the vein by what it makes, the oak fades', () => {
        const vein = placeAt('fixture_find_vein', 300, 300);
        const tree = placeAt('fixture_find_tree', 900, 300);
        const { container } = mount();
        act(() => setFindText('Copper Ore'));
        expect(art(container, vein.id).getAttribute('data-find')).toBe('match');
        expect(art(container, tree.id).getAttribute('data-find')).toBe('dim');
        act(() => setFindText('find oak'));
        expect(art(container, tree.id).getAttribute('data-find')).toBe('match');
        expect(art(container, vein.id).getAttribute('data-find')).toBe('dim');
    });

    it('⭐ Items: floor loot outlined white; any other find fades it', () => {
        SpriteLayer.addSprite('item', 'fixture_oak_wood', 2, { centre: { x: 400, y: 400 } });
        const { container } = render(h(MatFitProvider, { value: 1 }, h(SpriteLayerView)));
        const loot = () => container.querySelector('[data-item-sprite]');
        expect(loot().hasAttribute('data-find')).toBe(false);
        act(() => setFindCategory(FIND_CATEGORY.ITEMS));
        expect(loot().getAttribute('data-find')).toBe('match');
        act(() => setFindCategory(FIND_CATEGORY.HEROES));
        expect(loot().getAttribute('data-find')).toBe('dim');
        act(() => setFindText('oak'));
        act(() => setFindCategory(null));
        expect(loot().getAttribute('data-find')).toBe('dim');
    });

    it('the fade is one stylesheet rule, a little: what is not a match stays readable', () => {
        const css = fs.readFileSync('src/styles/components.css', 'utf8');
        const rule = css.match(/\[data-find="dim"\]\s*\{([^}]*)\}/);
        expect(rule).not.toBeNull();
        const opacity = Number(rule[1].match(/opacity:\s*([\d.]+)/)[1]);
        expect(opacity).toBeGreaterThan(0.3);
        expect(opacity).toBeLessThan(0.8);
    });
});

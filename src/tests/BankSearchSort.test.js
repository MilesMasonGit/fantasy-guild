// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { registerItems, getItem } from '../config/registries/itemRegistry.js';
import { homeTabOf } from '../systems/inventory/bankTabs.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BankTab } from '../ui/components/drawer/BankTab.jsx';
import { bankSearchMatches, sortForBank } from '../ui/components/drawer/bankSort.js';

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

// Brief 310 B2: the Bank's search matches name, tag, type and the hands label; Sort orders a
// tab, or every tab in place, by type, then tier, then name.

const item = (id, name, type, extra = {}) => ({ id, name, type, stackable: true, equipSlot: '', ...extra });
const FIXTURES = {
    srt_dagger_cu: item('srt_dagger_cu', 'Srt Copper Dagger', 'weapon', { equipSlot: 'hand', tier: 1, tags: ['Blade'] }),
    srt_sword_fe: item('srt_sword_fe', 'Srt Iron Sword', 'weapon', { equipSlot: 'hand', tier: 2 }),
    srt_club: item('srt_club', 'Srt Club', 'weapon', { equipSlot: 'hand' }),
    srt_axe: item('srt_axe', 'Srt Axe', 'weapon', { equipSlot: 'hand', tier: 1 }),
    srt_pick: item('srt_pick', 'Srt Pickaxe', 'tool', { equipSlot: 'hand', tool: { kind: 'pickaxe', tier: 1 } }),
    srt_pick_fe: item('srt_pick_fe', 'Srt Iron Pickaxe', 'tool', { equipSlot: 'hand', tool: { kind: 'pickaxe', tier: 2 } }),
    srt_pick_cu: item('srt_pick_cu', 'Srt Copper Pickaxe', 'tool', { equipSlot: 'hand', tool: { kind: 'pickaxe', tier: 1 } }),
    srt_ore: item('srt_ore', 'Srt Copper Ore', 'material', { tags: ['Ore', 'Metal'] }),
    srt_bread: item('srt_bread', 'Srt Bread', 'food', { equipSlot: 'food' }),
    srt_apple: item('srt_apple', 'Srt Apple', 'food', { equipSlot: 'food', tags: ['Fruit'] })
};
registerItems(FIXTURES);
const ALL = Object.keys(FIXTURES);

const h = React.createElement;
const mountBank = () => render(h(DeckDndProvider, null, h(BankTab)));
const shownIds = (view) => [...view.container.querySelectorAll('[data-bank-item]')].map(e => e.getAttribute('data-bank-item'));
const inv = () => GameState.state.inventory;

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.items = {};
    GameState.state.progress.guildUpgrades = { bank_tabs: 1 };
    GuildUpgradeManager.recompute();
});
afterEach(cleanup);

describe('the Bank search', () => {
    it('matches the name, a tag, the type and the hands label', () => {
        const dagger = FIXTURES.srt_dagger_cu;
        for (const term of ['Srt Copper Dagger', 'copper dag', 'Blade', 'Weapon', 'Hand']) {
            expect(bankSearchMatches(dagger, term), term).toBe(true);
        }
        expect(bankSearchMatches(dagger, 'Ore')).toBe(false);
        expect(bankSearchMatches(FIXTURES.srt_ore, 'Metal')).toBe(true);
        expect(bankSearchMatches(FIXTURES.srt_ore, 'Material')).toBe(true);
        expect(bankSearchMatches(FIXTURES.srt_ore, 'Hand')).toBe(false);
        expect(bankSearchMatches(FIXTURES.srt_bread, 'Food')).toBe(true);
    });

    it('matches from the start of a word, case-blind, words in order', () => {
        const forestMap = item('srt_map', 'Forest Map', 'map');
        const ironOre = item('srt_ironore', 'Iron Ore', 'material');
        expect(bankSearchMatches(ironOre, 'ore')).toBe(true);
        expect(bankSearchMatches(FIXTURES.srt_ore, 'ORE')).toBe(true);
        expect(bankSearchMatches(forestMap, 'ore')).toBe(false);
        expect(bankSearchMatches(FIXTURES.srt_dagger_cu, 'Dagger')).toBe(true);
        expect(bankSearchMatches(FIXTURES.srt_dagger_cu, 'agger')).toBe(false);
        expect(bankSearchMatches(FIXTURES.srt_dagger_cu, 'Srt Copper Dagger')).toBe(true);
        expect(bankSearchMatches(FIXTURES.srt_dagger_cu, 'dagger copper')).toBe(false);
    });

    it('finds every weapon across tabs, every hand item, and one item by name', () => {
        ALL.forEach(id => InventoryManager.addItem(id, 1));
        const [, second] = inv().groupOrder;
        InventoryManager.moveItemToGroup('srt_sword_fe', second);
        InventoryManager.moveItemToGroup('srt_pick', second);
        const view = mountBank();
        const search = view.container.querySelector('input[data-bank-search]');
        fireEvent.change(search, { target: { value: 'Weapon' } });
        expect(shownIds(view).sort()).toEqual(['srt_axe', 'srt_club', 'srt_dagger_cu', 'srt_sword_fe']);
        fireEvent.change(search, { target: { value: 'Hand' } });
        expect(shownIds(view).sort()).toEqual(['srt_axe', 'srt_club', 'srt_dagger_cu', 'srt_pick', 'srt_pick_cu', 'srt_pick_fe', 'srt_sword_fe']);
        fireEvent.change(search, { target: { value: 'Srt Copper Dagger' } });
        expect(shownIds(view)).toEqual(['srt_dagger_cu']);
    });
});

describe('Bank order', () => {
    it('is type, then tier (none after), then name', () => {
        const sorted = sortForBank([...ALL].reverse(), getItem);
        expect(sorted).toEqual([
            'srt_apple', 'srt_bread',                                 // Food
            'srt_ore',                                                // Material
            'srt_pick_cu', 'srt_pick', 'srt_pick_fe',                 // Tool: tool tier 1, 1, 2

            'srt_axe', 'srt_dagger_cu', 'srt_sword_fe', 'srt_club'     // Weapon: tier 1, 1, 2, then none
        ]);
    });

    it('sorts a tool with no tier of its own by its tool tier, copper before iron', () => {
        expect(sortForBank(['srt_pick_fe', 'srt_pick_cu'], getItem)).toEqual(['srt_pick_cu', 'srt_pick_fe']);
        const none = item('srt_toolless', 'Srt Aaa Tool', 'tool');
        registerItems({ srt_toolless: none });
        expect(sortForBank(['srt_toolless', 'srt_pick_fe'], getItem)).toEqual(['srt_pick_fe', 'srt_toolless']);
    });

    it('puts an id it does not know last', () => {
        expect(sortForBank(['srt_gone', 'srt_ore', 'srt_apple'], getItem)).toEqual(['srt_apple', 'srt_ore', 'srt_gone']);
    });
});

describe('the Sort button', () => {
    function setUpTwoTabs() {
        ['srt_sword_fe', 'srt_ore', 'srt_club', 'srt_apple', 'srt_dagger_cu', 'srt_pick', 'srt_bread', 'srt_axe']
            .forEach(id => InventoryManager.addItem(id, 1));
        const [first, second] = inv().groupOrder;
        for (const id of ['srt_bread', 'srt_axe', 'srt_pick']) InventoryManager.moveItemToGroup(id, second);
        return { first, second };
    }
    const order = (gid) => inv().groupDefs[gid].orderedItems.filter(id => homeTabOf(inv(), id) === gid);
    const openSort = (view) => fireEvent.click(view.container.querySelector('[data-bank-sort]'));

    it('sits beside Select and asks this tab or the entire Bank', () => {
        const view = mountBank();
        const select = [...view.container.querySelectorAll('button')].find(b => b.textContent.trim() === 'Select');
        const sort = view.container.querySelector('[data-bank-sort]');
        expect(select.nextElementSibling?.contains(sort) || select.parentElement.nextElementSibling?.contains(sort)).toBe(true);
        expect(view.container.querySelector('[data-bank-sort-menu]')).toBeNull();
        openSort(view);
        const menu = view.container.querySelector('[data-bank-sort-menu]');
        expect(menu.textContent).toContain('This tab');
        expect(menu.textContent).toContain('Entire Bank');
        act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
        expect(view.container.querySelector('[data-bank-sort-menu]')).toBeNull();
    });

    it('sorts this tab only, and keeps the manual order until pressed', async () => {
        const { first, second } = setUpTwoTabs();
        const view = mountBank();
        const before = shownIds(view);
        const secondBefore = order(second);
        expect(before).not.toEqual(sortForBank(before, getItem));
        openSort(view);
        await act(async () => { fireEvent.click(view.container.querySelector('[data-bank-sort-tab]')); });
        expect(shownIds(view)).toEqual(['srt_apple', 'srt_ore', 'srt_dagger_cu', 'srt_sword_fe', 'srt_club']);
        expect(order(first)).toEqual(['srt_apple', 'srt_ore', 'srt_dagger_cu', 'srt_sword_fe', 'srt_club']);
        expect(order(second)).toEqual(secondBefore);
        expect(view.container.querySelector('[data-bank-sort-menu]')).toBeNull();

        // A new kind joins at the end; nothing re-sorts until Sort is pressed again.
        registerItems({ srt_gem: item('srt_gem', 'Srt Gem', 'material') });
        await act(async () => { InventoryManager.addItem('srt_gem', 1); });
        expect(shownIds(view).at(-1)).toBe('srt_gem');
    });

    it('sorts every tab in place: no item changes tab', () => {
        const { first, second } = setUpTwoTabs();
        const homes = Object.fromEntries(Object.keys(inv().items).map(id => [id, homeTabOf(inv(), id)]));
        const view = mountBank();
        openSort(view);
        fireEvent.click(view.container.querySelector('[data-bank-sort-all]'));
        expect(order(first)).toEqual(['srt_apple', 'srt_ore', 'srt_dagger_cu', 'srt_sword_fe', 'srt_club']);
        expect(order(second)).toEqual(['srt_bread', 'srt_pick', 'srt_axe']);
        for (const [id, home] of Object.entries(homes)) expect(homeTabOf(inv(), id), id).toBe(home);
    });
});

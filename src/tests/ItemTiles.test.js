// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems, ITEMS, ITEM_TYPES } from '../config/registries/itemRegistry.js';
import { EQUIPMENT_CATEGORIES } from '../config/registries/equipmentConstants.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BankTab } from '../ui/components/drawer/BankTab.jsx';
import { DockEquipmentGrid } from '../ui/components/dock/DockEquipmentGrid.jsx';
import { itemTintName, itemTintStyle } from '../ui/components/base/itemTint.js';
import { SLOT_GLYPHS, slotGlyphName } from '../ui/components/base/PixelGlyph.jsx';

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Item tiles say what they are.** The Bank has no inspect column: a tile's hover tooltip
 * carries everything about the item, its search box sits in the Bank's header, and every tile
 * sits on its type's surface. A hero's filled loadout slot shows a mark of its kind.
 */

const h = React.createElement;
const SRC = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const FIXTURES = {
    fixture_tile_pick: {
        id: 'fixture_tile_pick', name: 'Tile Pickaxe', type: 'tool', equipSlot: 'hand', stackable: true,
        tags: ['metal'], description: 'A sturdy pick.', tool: { kind: 'pickaxe', tier: 2 }
    },
    fixture_tile_bread: {
        id: 'fixture_tile_bread', name: 'Tile Bread', type: 'food', equipSlot: 'food', stackable: true,
        restoreAmount: 7
    },
    fixture_tile_ore: { id: 'fixture_tile_ore', name: 'Tile Ore', type: 'material', equipSlot: '', stackable: true }
};
registerItems(FIXTURES);

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.items = {};
});
afterEach(cleanup);

const mountBank = () => render(h(DeckDndProvider, null, h(BankTab)));
const tile = (view, id) => view.container.querySelector(`button[data-bank-item="${id}"]`);
const hover = (el) => act(() => { fireEvent.pointerEnter(el, { clientX: 10, clientY: 10, pointerType: 'mouse', buttons: 0 }); });
const tipText = () => document.querySelector('[data-tooltip]')?.textContent || '';

describe('the Bank tile tooltip carries everything', () => {
    it('a tool: name, type, count, what it equips as, its tool and tier, tags and description', () => {
        InventoryManager.addItem('fixture_tile_pick', 1234);
        const view = mountBank();
        hover(tile(view, 'fixture_tile_pick'));
        const text = tipText();
        for (const part of ['Tile Pickaxe', 'Tool', '×1,234', 'Equippable: Hand', 'Pickaxe, tier 2', 'metal', 'A sturdy pick.']) {
            expect(text).toContain(part);
        }
    });

    it('food says what it restores and that it equips as Food', () => {
        InventoryManager.addItem('fixture_tile_bread', 3);
        const view = mountBank();
        hover(tile(view, 'fixture_tile_bread'));
        expect(tipText()).toContain('Restores 7 HP');
        expect(tipText()).toContain('Equippable: Food');
    });

    it('a material equips as nothing, and no tile tells the player how to drag', () => {
        InventoryManager.addItem('fixture_tile_ore', 5);
        const view = mountBank();
        hover(tile(view, 'fixture_tile_ore'));
        expect(tipText()).toContain('Material');
        expect(tipText()).not.toContain('Equippable');
        expect(tipText()).not.toMatch(/Drag to sort/);
        expect(read('ui/components/drawer/BankTab.jsx')).not.toMatch(/Drag to sort/);
    });

    it('is drawn only while hovered', () => {
        InventoryManager.addItem('fixture_tile_ore', 5);
        const view = mountBank();
        expect(document.querySelector('[data-item-tip]')).toBeNull();
        hover(tile(view, 'fixture_tile_ore'));
        expect(document.querySelector('[data-item-tip]')).not.toBeNull();
        act(() => { fireEvent.pointerLeave(tile(view, 'fixture_tile_ore')); });
        expect(document.querySelector('[data-item-tip]')).toBeNull();
    });
});

describe('the Bank has no inspect column; its search is in its header', () => {
    it('the drawer no longer mounts the inspection panel', () => {
        expect(read('ui/components/drawer/BankDrawer.jsx')).not.toMatch(/InspectionPanel/);
    });

    it('the search box sits between Select and the slot count, and searches', () => {
        InventoryManager.addItem('fixture_tile_pick', 1);
        InventoryManager.addItem('fixture_tile_ore', 1);
        const view = mountBank();
        const search = view.container.querySelector('input[data-bank-search]');
        expect(search).not.toBeNull();
        const select = [...view.container.querySelectorAll('button')].find(b => b.textContent.trim() === 'Select');
        const count = [...view.container.querySelectorAll('span')].find(s => /^\d+\/\d+$/.test(s.textContent.trim()));
        expect(select.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(search.compareDocumentPosition(count) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        fireEvent.change(search, { target: { value: 'pick' } });
        expect(tile(view, 'fixture_tile_pick')).not.toBeNull();
        expect(tile(view, 'fixture_tile_ore')).toBeNull();
    });
});

describe('tiles sit on their type\'s surface', () => {
    it('every type the game knows maps to a surface the theme defines', () => {
        const css = read('tailwind.css');
        for (const type of [...Object.values(ITEM_TYPES), 'something_new']) {
            const name = itemTintName({ type });
            expect(css).toMatch(new RegExp(`--color-item-tint-${name}\\s*:`));
        }
        expect(css).toMatch(/\.ui-item-tile:hover\s*\{[^}]*color-mix\(/);
    });

    it('the authored types read apart: food, drink, tool, material, map', () => {
        const names = ['food', 'drink', 'tool', 'material', 'map'].map(type => itemTintName({ type }));
        expect(new Set(names).size).toBe(5);
        expect(itemTintStyle({ type: 'food' })).toEqual({ '--item-tint': 'var(--color-item-tint-food)' });
    });

    it('a Bank tile wears its surface', () => {
        InventoryManager.addItem('fixture_tile_bread', 1);
        const view = mountBank();
        const el = tile(view, 'fixture_tile_bread');
        expect(el.classList.contains('ui-item-tile')).toBe(true);
        expect(el.getAttribute('data-item-tint')).toBe('food');
        expect(el.style.getPropertyValue('--item-tint')).toBe('var(--color-item-tint-food)');
    });

    it('every item type in the content has a surface of its own or the plain one', () => {
        for (const item of Object.values(ITEMS)) expect(typeof itemTintName(item)).toBe('string');
    });
});

describe('a hero\'s loadout slot shows a mark of its kind', () => {
    it('every equip category has its own mark; an unknown one gets the stand-in', () => {
        for (const category of EQUIPMENT_CATEGORIES) expect(slotGlyphName(category)).toBe(`slot_${category}`);
        expect(slotGlyphName('boots')).toBe('slot_unknown');
        for (const rows of Object.values(SLOT_GLYPHS)) {
            expect(rows).toHaveLength(8);
            for (const row of rows) expect(row).toMatch(/^[.#]{8}$/);
        }
    });

    it('a filled slot shows its kind; an empty one shows none', () => {
        GameState.state.heroes = [{
            id: 'h1', name: 'Aldric', spriteId: 'hn_recruit_por',
            hp: { current: 100, max: 100 }, status: 'idle',
            equipment: ['fixture_tile_pick', null, 'fixture_tile_bread', null, null, null, null, null, null]
        }];
        const view = render(h(DeckDndProvider, null, h(DockEquipmentGrid, { heroId: 'h1' })));
        const marks = [...view.container.querySelectorAll('[data-slot-kind]')].map(el => el.getAttribute('data-slot-kind'));
        expect(marks).toEqual(['hand', 'food']);
        expect(view.container.querySelector('[data-glyph="slot_hand"]')).not.toBeNull();
    });
});

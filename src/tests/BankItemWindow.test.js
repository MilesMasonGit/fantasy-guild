// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BankTab } from '../ui/components/drawer/BankTab.jsx';
import { escapeLayerCount } from '../ui/utils/escapeLayers.js';
import { EventBus } from '../systems/core/EventBus.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **A click on a Bank tile opens its inspection window at the Bank's foot**: the sprite at 4×,
 * name, count, kind, the details the tooltip leaves out, how many were collected this run, and
 * the book to its Encyclopedia page. A drag is still a drag (no window), Select still selects,
 * and the window closes on its X, Escape, a second click or when the item is used up.
 */

const h = React.createElement;
const ptr = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0 });
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });

registerItems({
    bw_sword: {
        id: 'bw_sword', name: 'Window Sword', type: 'weapon', equipSlot: 'hand', stackable: true,
        damage: 4, tags: ['metal'], description: 'Sharp on both sides.'
    },
    bw_ore: { id: 'bw_ore', name: 'Window Ore', type: 'material', stackable: true }
});

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.items = {};
});
afterEach(async () => {
    await new Promise(r => setTimeout(r, 30));
    cleanup();
    document.body.classList.remove('gi-dnd-active');
});

const mountBank = () => render(h(DeckDndProvider, null, h(BankTab)));
const tile = (view, id) => view.container.querySelector(`button[data-bank-item="${id}"]`);
const windowOf = (view) => view.container.querySelector('[data-bank-item-window]');

describe('the inspection window', () => {
    it('a click opens it: sprite at 4×, name, count, kind, details, collected this run, the book', () => {
        InventoryManager.addItem('bw_sword', 1500);
        GameState.state.collection = { ...(GameState.state.collection || {}), itemLifetimeCounts: { bw_sword: 2345 } };
        const view = mountBank();
        expect(windowOf(view)).toBeNull();
        fireEvent.click(tile(view, 'bw_sword'));
        const win = windowOf(view);
        expect(win.getAttribute('data-bank-item-window')).toBe('bw_sword');
        expect(win.querySelector('[data-bank-item-window-sprite] .gi-icon-128')).not.toBeNull();
        const text = win.textContent;
        for (const part of ['Window Sword', '×1,500', 'Weapon', 'Equippable: Hand', 'metal', 'DMG', '4', 'Sharp on both sides.', 'Collected this run: 2,345']) {
            expect(text).toContain(part);
        }
        expect(win.querySelector('[data-bank-item-window-look-up] [data-glyph="book"]')).not.toBeNull();
        expect(tile(view, 'bw_sword').hasAttribute('data-bank-item-inspected')).toBe(true);
        // It sits under the list, at the Bank's foot.
        const list = view.container.querySelector('[data-bank-item]').closest('.overflow-y-auto');
        expect(list.compareDocumentPosition(win) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('the book opens the item\'s Encyclopedia page', () => {
        InventoryManager.addItem('bw_ore', 2);
        const view = mountBank();
        fireEvent.click(tile(view, 'bw_ore'));
        const heard = [];
        const off = EventBus.subscribe(UI_EVENTS.OPEN_ENCYCLOPEDIA, d => heard.push(d.key));
        fireEvent.click(view.container.querySelector('[data-bank-item-window-look-up]'));
        off();
        expect(heard).toEqual(['item:bw_ore']);
    });

    it('closes on its X, on a second click of the same tile, and moves to another tile clicked', () => {
        InventoryManager.addItem('bw_sword', 1);
        InventoryManager.addItem('bw_ore', 1);
        const view = mountBank();
        fireEvent.click(tile(view, 'bw_sword'));
        fireEvent.click(tile(view, 'bw_ore'));
        expect(windowOf(view).getAttribute('data-bank-item-window')).toBe('bw_ore');
        fireEvent.click(tile(view, 'bw_ore'));
        expect(windowOf(view)).toBeNull();
        fireEvent.click(tile(view, 'bw_ore'));
        fireEvent.click(windowOf(view).querySelector('[data-close-x]'));
        expect(windowOf(view)).toBeNull();
    });

    it('Escape closes the window alone, as its own layer', () => {
        InventoryManager.addItem('bw_ore', 1);
        const view = mountBank();
        const before = escapeLayerCount();
        fireEvent.click(tile(view, 'bw_ore'));
        expect(escapeLayerCount()).toBe(before + 1);
        act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
        expect(windowOf(view)).toBeNull();
        expect(escapeLayerCount()).toBe(before);
    });

    it('an item used up closes its window', async () => {
        InventoryManager.addItem('bw_ore', 1);
        const view = mountBank();
        fireEvent.click(tile(view, 'bw_ore'));
        expect(windowOf(view)).not.toBeNull();
        await act(async () => {
            InventoryManager.removeItem('bw_ore', 1);
            await new Promise(r => setTimeout(r, 50));
        });
        expect(windowOf(view)).toBeNull();
    });

    it('in Select mode a click selects and opens nothing', () => {
        InventoryManager.addItem('bw_ore', 1);
        const view = mountBank();
        const select = [...view.container.querySelectorAll('button')].find(b => b.textContent.trim() === 'Select');
        fireEvent.click(select);
        fireEvent.click(tile(view, 'bw_ore'));
        expect(windowOf(view)).toBeNull();
        expect(view.container.textContent).toContain('1 selected');
    });

    it('a drag is not a click: past 8 px the press is a drag, and the click that ends it opens nothing', () => {
        InventoryManager.addItem('bw_ore', 1);
        const view = mountBank();
        const el = tile(view, 'bw_ore');
        el.getBoundingClientRect = () => box(2000, 2000, 64, 64);
        act(() => {
            fireEvent.pointerDown(el, ptr(2020, 2020));
            fireEvent.pointerMove(document, ptr(2060, 2020));
        });
        expect(document.body.classList.contains('gi-dnd-active')).toBe(true);
        act(() => { fireEvent.pointerMove(document, ptr(2300, 2300)); });
        act(() => { fireEvent.pointerUp(document, ptr(2300, 2300)); });
        // The browser's click after the release lands on the tile's common ancestor or the tile.
        fireEvent.click(el);
        expect(windowOf(view)).toBeNull();
    });
});

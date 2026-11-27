// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BankDrawer } from '../ui/components/drawer/BankDrawer.jsx';
import { resetBankInspection } from '../ui/components/drawer/bankInspection.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ The Item drawer's Use (brief 400 B4, in the actions row of brief 570 D3, beside 870 C1's Sell):
 * an item with a Use offers 1, 50 %, All -1 and All and a slider over the stack, and its button
 * pays the drops at once into the Bank; a line under it says what came, and what the Bank had no
 * room for waits on the mat as loot. An item with no Use shows Sell alone.
 */

const h = React.createElement;

registerItems({
    du_crate: { id: 'du_crate', name: 'Use Crate', type: 'material', stackable: true, use: { drops: [{ itemId: 'du_seed', minQty: 3, maxQty: 3 }] } },
    du_bag: {
        id: 'du_bag', name: 'Use Bag', type: 'material', stackable: true,
        use: { drops: ['du_a', 'du_b', 'du_c', 'du_d', 'du_e'].map(itemId => ({ itemId })) }
    },
    du_seed: { id: 'du_seed', name: 'Use Seed', type: 'material', stackable: true },
    du_ore: { id: 'du_ore', name: 'Use Ore', type: 'material', stackable: true },
    ...Object.fromEntries(['du_a', 'du_b', 'du_c', 'du_d', 'du_e'].map(id => [id, { id, name: id.toUpperCase(), type: 'material', stackable: true }]))
});

SpriteLayer.init();

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.items = {};
    GameState.state.board.sprites = [];
    resetBankInspection();
});
afterEach(async () => {
    await new Promise(r => setTimeout(r, 30));
    cleanup();
});

const OPEN = { isOpen: true, panes: ['bank'], filters: {}, closePane: () => {} };
const mountBank = (drawer = OPEN) => render(h(DeckDndProvider, null, h(BankDrawer, { drawer, menuRight: false })));
const tile = (view, id) => view.container.querySelector(`button[data-bank-item="${id}"]`);
const drawerOf = (view) => view.container.querySelector('[data-item-drawer]');
const q = (view, sel) => drawerOf(view)?.querySelector(sel) ?? null;
const open = (id) => {
    const view = mountBank();
    fireEvent.click(tile(view, id));
    return view;
};
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 50)); });
const preset = (view, name) => q(view, `[data-item-use-preset="${name}"]`);

describe('the Use control, beside Sell', () => {
    it('an item with no Use shows Sell alone', () => {
        InventoryManager.addItem('du_ore', 4);
        const view = open('du_ore');
        expect(q(view, '[data-item-drawer-use]')).toBeNull();
        expect(q(view, '[data-item-use-amounts]')).toBeNull();
        expect(q(view, '[data-item-drawer-sell]').textContent).toBe('Sell');
    });

    it('an item with a Use: the amounts above the actions, Use before Sell in the row, 1 to start', () => {
        InventoryManager.addItem('du_crate', 10);
        const view = open('du_crate');
        const amounts = q(view, '[data-item-use-amounts]');
        const actions = q(view, '[data-item-drawer-actions]');
        expect(amounts.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect([...amounts.querySelectorAll('[data-item-use-preset]')].map(b => b.textContent)).toEqual(['1', '50%', 'All -1', 'All']);
        const buttons = [...actions.querySelectorAll('button')].map(b => b.textContent);
        expect(buttons).toEqual(['Use 1', 'Sell']);
        expect(preset(view, 'one').getAttribute('data-picked')).toBe('true');
        expect(q(view, '[data-item-use-slider]')).toMatchObject({ min: '1', max: '10', value: '1' });
    });

    it('each preset sets the amount, the slider any amount, and the button says it', () => {
        InventoryManager.addItem('du_crate', 10);
        const view = open('du_crate');
        const button = () => q(view, '[data-item-drawer-use]').textContent;
        fireEvent.click(preset(view, 'half'));
        expect(button()).toBe('Use 5');
        expect(preset(view, 'half').getAttribute('data-picked')).toBe('true');
        fireEvent.click(preset(view, 'allButOne'));
        expect(button()).toBe('Use 9');
        fireEvent.click(preset(view, 'all'));
        expect(button()).toBe('Use 10');
        fireEvent.change(q(view, '[data-item-use-slider]'), { target: { value: '7' } });
        expect(button()).toBe('Use 7');
        expect([...q(view, '[data-item-use-amounts]').querySelectorAll('[data-picked="true"]')]).toHaveLength(0);
        fireEvent.click(preset(view, 'one'));
        expect(button()).toBe('Use 1');
    });

    it('a stack of one: no slider, 50 % and All -1 greyed', () => {
        InventoryManager.addItem('du_crate', 1);
        const view = open('du_crate');
        expect(q(view, '[data-item-use-slider]')).toBeNull();
        expect(preset(view, 'half').disabled).toBe(true);
        expect(preset(view, 'allButOne').disabled).toBe(true);
        expect(preset(view, 'all').disabled).toBe(false);
    });

    it('Use pays out at once, into the Bank, and says what came; no confirm', async () => {
        InventoryManager.addItem('du_crate', 10);
        const view = open('du_crate');
        fireEvent.click(preset(view, 'half'));
        fireEvent.click(q(view, '[data-item-drawer-use]'));
        expect(InventoryManager.getItemCount('du_crate')).toBe(5);
        expect(InventoryManager.getItemCount('du_seed')).toBe(15);
        await settle();
        expect(q(view, '[data-item-drawer-count]').textContent).toBe('×5');
        expect(q(view, '[data-item-use-result]').textContent).toBe('Used 5 Use Crate: 15 Use Seed.');
        expect(q(view, '[data-item-use-waiting]')).toBeNull();
        // The amount stays where it was, within what is left.
        expect(q(view, '[data-item-drawer-use]').textContent).toBe('Use 5');
    });

    it('All takes the whole stack; the drawer moves on and still says what the Use gave', async () => {
        InventoryManager.addItem('du_ore', 1);
        InventoryManager.addItem('du_crate', 3);
        const view = open('du_crate');
        fireEvent.click(preset(view, 'all'));
        fireEvent.click(q(view, '[data-item-drawer-use]'));
        await settle();
        expect(InventoryManager.getItemCount('du_crate')).toBe(0);
        expect(drawerOf(view).getAttribute('data-item-drawer')).not.toBe('du_crate');
        expect(q(view, '[data-item-use-result]').textContent).toBe('Used 3 Use Crate: 9 Use Seed.');
        // Another item picked lets it go.
        const shown = drawerOf(view).getAttribute('data-item-drawer');
        fireEvent.click(tile(view, shown === 'du_ore' ? 'du_seed' : 'du_ore'));
        expect(q(view, '[data-item-use-result]')).toBeNull();
    });

    it('names three things it gave and counts the rest', async () => {
        InventoryManager.addItem('du_bag', 2);
        const view = open('du_bag');
        fireEvent.click(q(view, '[data-item-drawer-use]'));
        await settle();
        expect(q(view, '[data-item-use-result]').textContent).toBe('Used 1 Use Bag: 1 DU_A, 1 DU_B, 1 DU_C and 2 more.');
    });

    it('a nearly full Bank: what has no room waits on the mat as loot, and the line says so', async () => {
        GameState.state.inventory.maxSlots = 2;
        InventoryManager.addItem('du_crate', 4);
        InventoryManager.addItem('du_ore', 1);
        const view = open('du_crate');
        fireEvent.click(q(view, '[data-item-drawer-use]'));
        await settle();
        expect(InventoryManager.getItemCount('du_seed')).toBe(0);
        expect(SpriteLayer.countOnBoard('du_seed')).toBe(3);
        expect(q(view, '[data-item-use-waiting]').textContent).toBe('No room in the Bank for 1 kind: it waits on the mat as loot.');
    });

    it('while Sell asks to confirm, the Use control steps aside', () => {
        InventoryManager.addItem('du_crate', 4);
        const view = open('du_crate');
        fireEvent.click(q(view, '[data-item-drawer-sell]'));
        expect(q(view, '[data-item-drawer-sell-confirm]')).not.toBeNull();
        expect(q(view, '[data-item-drawer-use]')).toBeNull();
        expect(q(view, '[data-item-use-amounts]')).toBeNull();
        fireEvent.click(q(view, '[data-item-drawer-sell-no]'));
        expect(q(view, '[data-item-drawer-use]')).not.toBeNull();
    });

    it('the Bank closed and opened again shows no old result', async () => {
        InventoryManager.addItem('du_crate', 4);
        const view = open('du_crate');
        fireEvent.click(q(view, '[data-item-drawer-use]'));
        await settle();
        expect(q(view, '[data-item-use-result]')).not.toBeNull();
        view.rerender(h(DeckDndProvider, null, h(BankDrawer, { drawer: { ...OPEN, isOpen: false, panes: [] }, menuRight: false })));
        await act(async () => { await new Promise(r => setTimeout(r, 400)); });
        view.rerender(h(DeckDndProvider, null, h(BankDrawer, { drawer: OPEN, menuRight: false })));
        await settle();
        expect(drawerOf(view).getAttribute('data-item-drawer')).toBe('du_crate');
        expect(q(view, '[data-item-use-result]')).toBeNull();
    });
});

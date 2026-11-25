// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { getCoins, addCoins } from '../systems/inventory/Coins.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BankDrawer } from '../ui/components/drawer/BankDrawer.jsx';
import { resetBankInspection } from '../ui/components/drawer/bankInspection.js';
import { MatCoinCount } from '../ui/components/board/MatCoinCount.jsx';
import { TOP_BAR_ICON } from '../ui/components/board/MatTopBar.jsx';

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Gold Coins on screen: the coin count in the mat's top bar, with its coin icon, in the middle
 * the Token cap and Upkeep left (while no map mode is on); and the Bank's select mode selling
 * every selected stack at once, after one confirm with the total.
 */

const h = React.createElement;

registerItems({
    gu_ore: { id: 'gu_ore', name: 'Sale Ore', type: 'material', stackable: true, coinWorth: 3 },
    gu_gem: { id: 'gu_gem', name: 'Sale Gem', type: 'material', stackable: true, coinWorth: 40 },
    gu_dust: { id: 'gu_dust', name: 'Sale Dust', type: 'material', stackable: true }
});

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.items = {};
    resetBankInspection();
});
afterEach(async () => {
    await new Promise(r => setTimeout(r, 30));
    cleanup();
});

describe('⭐ the coin count in the top bar', () => {
    it('shows the guild\'s coins with the coin icon, and follows every change and a load', async () => {
        const { container } = render(h(MatCoinCount));
        const badge = container.querySelector('[data-mat-coins]');
        expect(badge).not.toBeNull();
        expect(badge.querySelector('img').getAttribute('src')).toBe(TOP_BAR_ICON.COINS);
        const count = () => container.querySelector('[data-mat-coins-count]').textContent;
        expect(count()).toBe('0');
        await act(async () => { addCoins(1234); });
        expect(count()).toBe('1,234');
        await act(async () => {
            GameState.state.progress.coins = 7;
            EventBus.publish(ENGINE_EVENTS.GAME_LOADED);
        });
        expect(count()).toBe('7');
    });

    it('stands in the bar\'s middle while no map mode is on, where the Token cap and Upkeep were', () => {
        const code = fs.readFileSync('src/ui/ReactRoot.jsx', 'utf8');
        expect(code).toMatch(/SHOW_MAT_COUNTS \? <><MatCapBadge \/><MatUpkeepBadge \/><\/> : <MatCoinCount \/>/);
    });
});

describe('⭐ Sell selected in the Bank\'s select mode', () => {
    const OPEN = { isOpen: true, panes: ['bank'], filters: {}, closePane: () => {} };
    const mountBank = () => render(h(DeckDndProvider, null, h(BankDrawer, { drawer: OPEN })));
    const tile = (view, id) => view.container.querySelector(`button[data-bank-item="${id}"]`);
    const q = (view, sel) => view.container.querySelector(sel);
    const button = (view, text) => [...view.container.querySelectorAll('button')].find(b => b.textContent.trim() === text);
    const selectAll = (view, ids) => {
        fireEvent.click(button(view, 'Select'));
        for (const id of ids) fireEvent.click(tile(view, id));
    };
    const stock = () => {
        InventoryManager.addItem('gu_ore', 2);
        InventoryManager.addItem('gu_gem', 3);
        InventoryManager.addItem('gu_dust', 9);
    };

    it('is offered only in select mode, and only once something is selected', () => {
        stock();
        const view = mountBank();
        expect(q(view, '[data-bank-sell-selected]')).toBeNull();
        fireEvent.click(button(view, 'Select'));
        expect(q(view, '[data-bank-sell-selected]').disabled).toBe(true);
        fireEvent.click(tile(view, 'gu_ore'));
        expect(q(view, '[data-bank-sell-selected]').disabled).toBe(false);
    });

    it('one confirm with the total; Cancel sells nothing', () => {
        stock();
        const view = mountBank();
        selectAll(view, ['gu_ore', 'gu_gem', 'gu_dust']);
        fireEvent.click(q(view, '[data-bank-sell-selected]'));
        expect(q(view, '[data-bank-sell-confirm]').textContent).toMatch(/Sell 3 stacks \(14 items\) for 126 coins\?.*Worn gear stays worn/);
        fireEvent.click(q(view, '[data-bank-sell-no]'));
        expect(q(view, '[data-bank-sell-confirm]')).toBeNull();
        expect(InventoryManager.getItemCount('gu_gem')).toBe(3);
        expect(getCoins()).toBe(0);
    });

    it('Confirm sells every selected stack, the coins rise by the total, and the rest stays', () => {
        stock();
        const view = mountBank();
        selectAll(view, ['gu_ore', 'gu_gem']);
        fireEvent.click(q(view, '[data-bank-sell-selected]'));
        expect(q(view, '[data-bank-sell-confirm]').textContent).toMatch(/Sell 2 stacks \(5 items\) for 126 coins\?/);
        fireEvent.click(q(view, '[data-bank-sell-yes]'));
        expect(InventoryManager.getItemCount('gu_ore')).toBe(0);
        expect(InventoryManager.getItemCount('gu_gem')).toBe(0);
        expect(InventoryManager.getItemCount('gu_dust')).toBe(9);
        expect(getCoins()).toBe(126);
        expect(q(view, '[data-bank-sell-confirm]')).toBeNull();
        expect(view.container.textContent).toContain('0 selected');
    });

    it('one stack reads as one', () => {
        InventoryManager.addItem('gu_ore', 1);
        const view = mountBank();
        selectAll(view, ['gu_ore']);
        fireEvent.click(q(view, '[data-bank-sell-selected]'));
        expect(q(view, '[data-bank-sell-confirm]').textContent).toMatch(/Sell 1 stack \(1 item\) for 3 coins\?/);
    });
});

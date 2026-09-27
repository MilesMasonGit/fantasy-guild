import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';

// The drawer's panes are stood in: this checks which columns the drawer lays
// out, not what the Bank or the Shop draw inside them.
vi.mock('../ui/components/drawer/InspectionPanel.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'inspect-column' })
}));
vi.mock('../ui/components/drawer/BankTab.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'bank-pane' })
}));
vi.mock('../ui/components/drawer/CartographerTab.jsx', async (importOriginal) => ({
    ...(await importOriginal()),
    default: () => React.createElement('div', { 'data-testid': 'shop-pane' })
}));

import { BottomFolderDrawer } from '../ui/components/drawer/BottomFolderDrawer.jsx';
import { ShopRow } from '../ui/components/drawer/CartographerTab.jsx';

const drawerFor = (pane) => ({ isOpen: true, panes: [pane], filters: {}, closePane: () => {} });
const inspect = { set: () => {}, clear: () => {}, getByPane: () => null, selection: null };

/**
 * ⭐ **The Shop without an inspect panel, prices as item rows** (Token
 * Lifecycle feedback Q7: FB-24, FB-26).
 */
describe('Shop drawer', () => {
    afterEach(() => cleanup());

    it('shows the Shop with no inspect column beside it (FB-24)', () => {
        const view = render(React.createElement(BottomFolderDrawer, { drawer: drawerFor('cartographer'), inspect }));
        expect(view.getByTestId('shop-pane')).toBeTruthy();
        expect(view.queryByTestId('inspect-column')).toBeNull();
    });

    it('keeps the inspect column for the Bank', () => {
        const view = render(React.createElement(BottomFolderDrawer, { drawer: drawerFor('bank'), inspect }));
        expect(view.getByTestId('bank-pane')).toBeTruthy();
        expect(view.getByTestId('inspect-column')).toBeTruthy();
    });
});

describe('Shop row', () => {
    afterEach(() => cleanup());

    const item = (price, success = true) => ({
        typeId: 'token_test_forest',
        name: 'Test Forest',
        price,
        affordability: success ? { success: true } : { success: false, reason: 'Need 3× Oak Wood' }
    });

    it('draws each price line as a standard item row, have / need (FB-26)', () => {
        const view = render(React.createElement(ShopRow, {
            item: item([
                { itemId: 'item_oak_wood', name: 'Oak Wood', need: 5, have: 2, enough: false },
                { itemId: 'item_stone', name: 'Stone', need: 1, have: 4, enough: true }
            ], false),
            onBuy: () => {}
        }));
        const price = view.container.querySelector('[data-shop-price]');
        expect(price).toBeTruthy();
        expect(price.children).toHaveLength(2);
        expect(price.textContent).toContain('Oak Wood');
        expect(price.textContent).toContain('2/5');
        expect(price.textContent).toContain('4/1');
        // Short lines are red, met lines are not (EntityRibbon's own colouring).
        const [short, met] = price.children;
        expect(short.className).toContain('border-gi-danger');
        expect(met.className).not.toContain('border-gi-danger');
    });

    it('opens nothing from the sprite, and Buy still buys (FB-24)', () => {
        const onBuy = vi.fn();
        const view = render(React.createElement(ShopRow, {
            item: item([{ itemId: 'item_oak_wood', name: 'Oak Wood', need: 1, have: 1, enough: true }]),
            onBuy
        }));
        // The only button in the row is Buy.
        const buttons = view.container.querySelectorAll('button');
        expect(buttons).toHaveLength(1);
        fireEvent.click(view.getByText('Buy'));
        expect(onBuy).toHaveBeenCalledTimes(1);
    });

    it('names what is missing on the Buy button when it cannot be bought', () => {
        const view = render(React.createElement(ShopRow, {
            item: item([{ itemId: 'item_oak_wood', name: 'Oak Wood', need: 3, have: 0, enough: false }], false),
            onBuy: () => {}
        }));
        const buy = view.container.querySelector('button');
        expect(buy.disabled).toBe(true);
        expect(buy.textContent).toBe('Need 3× Oak Wood');
    });
});

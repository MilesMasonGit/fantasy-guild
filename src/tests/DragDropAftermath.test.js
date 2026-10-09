// @vitest-environment jsdom
// ⚠️ First: it must be in place before React loads.
import { renders } from './fixtures/renderCounter.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import '../systems/core/NotificationSubscriptions.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { EventBus } from '../systems/core/EventBus.js';
import { EngineContext } from '../ui/context/EngineContext';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { Board } from '../ui/components/board/Board.jsx';
import { ShopDrawer } from '../ui/components/drawer/ShopDrawer.jsx';
import ToastContainer from '../ui/components/base/ToastContainer.jsx';

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **What a drop sets off is drawn after the drop.** Buying from the Shop pays its price, which
 * re-reads every row's price and updates the notification column (the item spent), and each
 * re-measures its layout. Drawn in the same commit as the drop, they made the drop's frame the
 * longest of the drag. They now follow it, a frame later at most.
 */

const h = React.createElement;
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
const ptr = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0 });
const WOOD = 'item_oak_wood';

registerTokenTypes({
    fixture_da_grove: {
        id: 'fixture_da_grove', name: 'Fixture Da Grove', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 5 }], section: 'forestry' }
    }
});

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    EngineBootstrap.createDefaultGameData();
    for (const t of BoardState.tokens()) if (t.typeId !== 'token_guild_hall') BoardState.removeToken(t.id);
    GameState.state.inventory.items = {};
    InventoryManager.addItem(WOOD, 30);
    NotificationSystem.dismissAll?.();
});
afterEach(async () => {
    renders.stop();
    await new Promise(r => setTimeout(r, 80));
    cleanup();
    document.body.classList.remove('gi-dnd-active');
});

describe('⭐ a purchase drop: the Shop\'s prices and the notification column follow the drop', () => {
    it('the drop commits first; the Shop list and the toasts draw in later commits', async () => {
        const view = render(
            h(EngineContext.Provider, { value: { GameState, EventBus } },
                h(DeckDndProvider, null,
                    h(Board, { onInspectToken: () => {}, onClearInspect: () => {} }),
                    h(ShopDrawer, { isOpen: true, onClose: () => {} }),
                    h(ToastContainer)))
        );
        view.container.querySelector('[data-board-origin]').getBoundingClientRect = () => box(0, 0, matW(), matH());
        view.container.querySelector('[data-mat-board]').getBoundingClientRect = () => box(0, 0, matW(), matH());
        const row = view.container.querySelector('[data-shop-row="fixture_da_grove"]');
        expect(row.getAttribute('data-shop-affordable')).toBe('true');
        row.getBoundingClientRect = () => box(2000, 2000, 100, 100);

        act(() => {
            fireEvent.pointerDown(row, ptr(2050, 2050));
            fireEvent.pointerMove(document, ptr(2080, 2050));
        });
        act(() => { fireEvent.pointerMove(document, ptr(700, 500)); });
        expect(document.body.classList.contains('gi-dnd-active')).toBe(true);

        renders.start();
        await act(async () => { fireEvent.pointerUp(document, ptr(700, 500)); });
        renders.stop();

        expect(BoardState.tokens().some(t => t.typeId === 'fixture_da_grove')).toBe(true);
        expect(view.container.textContent).toContain('Oak');
        const commits = renders.commits();
        const drop = commits.findIndex(c => c.has('DeckDndProvider'));
        expect(drop).toBeGreaterThanOrEqual(0);
        const shop = commits.findIndex(c => c.has('ShopContents'));
        const toasts = commits.findIndex(c => c.has('ToastContainer'));
        expect(shop).toBeGreaterThan(drop);
        expect(toasts).toBeGreaterThan(drop);
        // And neither is in any commit before React has moved on from the drop's own work.
        expect(commits.slice(0, drop + 1).some(c => c.has('ShopContents') || c.has('ToastContainer'))).toBe(false);
    });
});

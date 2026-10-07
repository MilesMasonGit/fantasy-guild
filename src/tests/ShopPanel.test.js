// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, renderHook, act, waitFor } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as MatCap from '../systems/board/MatCap.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { DeckDndProvider, DeckDndContext, DragSurfaceContext } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../ui/dnd/dragConstants.js';
import { matAccepts } from '../ui/components/board/Board.jsx';
import { useUIModals } from '../ui/hooks/useUIModals.js';

// The Bank drawer's panes are stood in: this checks which panes the drawer
// lays out, not what the Bank draws inside them.
vi.mock('../ui/components/drawer/InspectionPanel.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'inspect-column' })
}));
vi.mock('../ui/components/drawer/BankTab.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'bank-pane' })
}));
vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

import { BottomFolderDrawer } from '../ui/components/drawer/BottomFolderDrawer.jsx';
import {
    ShopDrawer, ShopRow, shopDrawerState, shopDrawerTransform, shopRowPayload,
    isShopPayload, SHOP_LIP_PX
} from '../ui/components/drawer/ShopDrawer.jsx';

const h = React.createElement;
const WOOD = 'item_oak_wood';

registerTokenTypes({
    fixture_sp_forest: {
        id: 'fixture_sp_forest', name: 'Fixture Sp Forest', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 10 }], section: 'logging' }
    }
});

const drawerFor = (pane) => ({ isOpen: true, panes: [pane], filters: {}, closePane: () => {} });
const inspect = { set: () => {}, clear: () => {}, getByPane: () => null, selection: null };

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    EngineBootstrap.createDefaultGameData();
    for (const t of BoardState.tokens()) if (t.typeId !== 'token_guild_hall') BoardState.removeToken(t.id);
    GameState.state.inventory.items = {};
});
afterEach(() => { cleanup(); resetMatTuning(); });

/** The drawer inside a drag system, optionally with a drag in the hand and
 * over a given surface (the lip/open state now depends on it). */
function mountDrawer({ isOpen = true, carrying = null, surface = undefined } = {}) {
    let inner = h(ShopDrawer, { isOpen, onClose: () => {} });
    if (surface !== undefined) {
        inner = h(DragSurfaceContext.Provider, { value: surface }, inner);
    }
    const withDrag = carrying
        ? h(DeckDndContext.Provider, { value: { activePayload: carrying, isDragging: true } }, inner)
        : inner;
    return render(h(DeckDndProvider, null, withDrag));
}

const row = (view, typeId) => view.container.querySelector(`[data-shop-row="${typeId}"]`);

/**
 * ⭐ **B4: the Shop leaves the Bank drawer**.
 */
describe('the Bank drawer keeps the Bank only (B4)', () => {
    it('has no Shop pane: asking for the old pane draws nothing', () => {
        const view = render(h(BottomFolderDrawer, { drawer: drawerFor('shop'), inspect }));
        expect(view.queryByText('Shop')).toBeNull();
        expect(view.queryByTestId('bank-pane')).toBeNull();
    });

    it('keeps the Bank with its inspect column', () => {
        const view = render(h(BottomFolderDrawer, { drawer: drawerFor('bank'), inspect }));
        expect(view.getByTestId('bank-pane')).toBeTruthy();
        expect(view.getByTestId('inspect-column')).toBeTruthy();
    });

    it('the nav Shop bubble opens and closes the Shop drawer, not a Bank pane', async () => {
        const opened = vi.fn();
        const unsub = EventBus.subscribe('ui_modal:opened', opened);
        const { result } = renderHook(() => useUIModals(null));
        act(() => result.current.nav.toggle('shop'));
        await waitFor(() => expect(result.current.shop.isOpen).toBe(true));
        expect(result.current.drawer.panes).toEqual([]);
        expect(result.current.nav.isActive('shop')).toBe(true);
        // The quest wiring still hears the Shop open.
        expect(opened).toHaveBeenCalledWith({ modalId: 'shop' });

        act(() => result.current.nav.toggle('shop'));
        expect(result.current.shop.isOpen).toBe(false);
        unsub();
    });
});

describe('the Shop drawer (B4)', () => {
    it('slides from the left: closed, open, and a lip while a Shop row is carried (FB-27)', () => {
        const shopDrag = { kind: DRAG_KIND.TOKEN, ...shopRowPayload('fixture_sp_forest') };
        const matDrag = { kind: DRAG_KIND.TOKEN, typeId: 'x', from: { instanceId: 't1' } };
        expect(shopDrawerState(false, null)).toBe('closed');
        expect(shopDrawerState(false, shopDrag)).toBe('closed');
        expect(shopDrawerState(true, null)).toBe('open');
        expect(shopDrawerState(true, matDrag)).toBe('open');
        expect(shopDrawerState(true, shopDrag)).toBe('lip');
        expect(shopDrawerTransform('open')).toBe('translateX(0)');
        expect(shopDrawerTransform('lip')).toBe(`translateX(calc(-100% + ${SHOP_LIP_PX}px))`);
        expect(shopDrawerTransform('closed')).toBe('translateX(-100%)');
    });

    describe('⭐ the slide tracks WHERE the row is carried, not just that it is (CR3-402)', () => {
        const shopDrag = { kind: DRAG_KIND.TOKEN, ...shopRowPayload('fixture_sp_forest') };

        it('is a lip over the playmat, and open again back over the drawer', () => {
            expect(shopDrawerState(true, shopDrag, DND_SURFACE.BOARD)).toBe('lip');
            expect(shopDrawerState(true, shopDrag, DND_SURFACE.DRAWER)).toBe('open');
        });

        it('defaults to the old always-a-lip behaviour when no surface is tracked', () => {
            expect(shopDrawerState(true, shopDrag)).toBe('lip');
        });

        it('a non-Shop payload never slides the drawer, whatever the surface', () => {
            const matDrag = { kind: DRAG_KIND.TOKEN, typeId: 'x', from: { instanceId: 't1' } };
            expect(shopDrawerState(true, matDrag, DND_SURFACE.BOARD)).toBe('open');
            expect(shopDrawerState(true, matDrag, DND_SURFACE.DRAWER)).toBe('open');
        });

        it('mounted: slides to the lip over the board, and reopens back over the drawer', () => {
            const overBoard = mountDrawer({ carrying: shopDrag, surface: DND_SURFACE.BOARD });
            expect(overBoard.container.querySelector('[data-shop-drawer]').getAttribute('data-shop-drawer-state')).toBe('lip');
            cleanup();

            const overDrawer = mountDrawer({ carrying: shopDrag, surface: DND_SURFACE.DRAWER });
            expect(overDrawer.container.querySelector('[data-shop-drawer]').getAttribute('data-shop-drawer-state')).toBe('open');
        });
    });

    it('draws open, a third of the screen, anchored left', () => {
        const view = mountDrawer();
        const el = view.container.querySelector('[data-shop-drawer]');
        expect(el.getAttribute('data-shop-drawer-state')).toBe('open');
        expect(el.className).toContain('w-[33.333vw]');
        expect(el.className).toMatch(/left-/);
        expect(el.style.transform).toBe('translateX(0)');
    });

    it('slides to the lip while a Shop Token is in the hand, and stays open after', () => {
        const carried = { kind: DRAG_KIND.TOKEN, ...shopRowPayload('fixture_sp_forest') };
        const view = mountDrawer({ carrying: carried });
        const el = view.container.querySelector('[data-shop-drawer]');
        expect(el.getAttribute('data-shop-drawer-state')).toBe('lip');
        cleanup();
        const after = mountDrawer();
        expect(after.container.querySelector('[data-shop-drawer]').getAttribute('data-shop-drawer-state')).toBe('open');
    });

    it('closed, it is hidden and lists nothing', () => {
        const view = mountDrawer({ isOpen: false });
        const el = view.container.querySelector('[data-shop-drawer]');
        expect(el.getAttribute('data-shop-drawer-state')).toBe('closed');
        expect(el.style.visibility).toBe('hidden');
        expect(el.querySelector('[data-shop-row]')).toBeNull();
    });

    it('has no Buy buttons: the only button is Close (FB-25)', () => {
        InventoryManager.addItem(WOOD, 10);
        const view = mountDrawer();
        expect(row(view, 'fixture_sp_forest')).toBeTruthy();
        const buttons = [...view.container.querySelectorAll('button')];
        expect(buttons).toHaveLength(1);
        expect(buttons[0].title).toBe('Close Shop');
    });

    it('an affordable row can be picked up; its payload lands through the mat (from.shop)', () => {
        InventoryManager.addItem(WOOD, 10);
        const view = mountDrawer();
        const r = row(view, 'fixture_sp_forest');
        expect(r.getAttribute('data-shop-affordable')).toBe('true');
        expect(r.getAttribute('aria-roledescription')).toBe('draggable');
        expect(r.querySelector('[data-shop-missing]')).toBeNull();
        const payload = { kind: DRAG_KIND.TOKEN, ...shopRowPayload('fixture_sp_forest') };
        expect(isShopPayload(payload)).toBe(true);
        expect(matAccepts(payload)).toBe(true);
    });

    it('an unaffordable row is dimmed, says what is missing in red, and cannot be picked up', () => {
        InventoryManager.addItem(WOOD, 3);
        const view = mountDrawer();
        const r = row(view, 'fixture_sp_forest');
        expect(r.getAttribute('data-shop-affordable')).toBe('false');
        expect(r.className).toContain('opacity-50');
        expect(r.getAttribute('aria-roledescription')).toBeNull();
        const missing = r.querySelector('[data-shop-missing]');
        expect(missing.textContent).toBe('Need 7× Oak Wood');
        expect(missing.className).toContain('text-gi-danger');
    });

    it('a row over the mat cap is gated the same way', () => {
        InventoryManager.addItem(WOOD, 10);
        const t = BoardState.createTokenInstance('fixture_sp_forest', 1, null, BoardState.ORIGIN.PLACED);
        BoardState.addToken(t, 1200, 900);
        setMatTuning('matCap', MatCap.placedCount());
        const view = mountDrawer();
        const r = row(view, 'fixture_sp_forest');
        expect(r.getAttribute('data-shop-affordable')).toBe('false');
        expect(r.querySelector('[data-shop-missing]').textContent).toMatch(/Mat is full/);
    });

    it('re-enables live when the Bank fills', () => {
        const view = mountDrawer();
        expect(row(view, 'fixture_sp_forest').getAttribute('data-shop-affordable')).toBe('false');
        act(() => { InventoryManager.addItem(WOOD, 10); });
        expect(row(view, 'fixture_sp_forest').getAttribute('data-shop-affordable')).toBe('true');
    });
});

describe('Shop row prices (FB-26)', () => {
    const item = (price, success = true) => ({
        typeId: 'fixture_sp_forest',
        name: 'Test Forest',
        price,
        affordability: success ? { success: true } : { success: false, reason: 'Need 3× Oak Wood' }
    });

    it('draws each price line as a standard item row, have / need', () => {
        const view = render(h(DeckDndProvider, null, h(ShopRow, {
            item: item([
                { itemId: 'item_oak_wood', name: 'Oak Wood', need: 5, have: 2, enough: false },
                { itemId: 'item_stone', name: 'Stone', need: 1, have: 4, enough: true }
            ], false)
        })));
        const price = view.container.querySelector('[data-shop-price]');
        expect(price.children).toHaveLength(2);
        expect(price.textContent).toContain('Oak Wood');
        expect(price.textContent).toContain('2/5');
        expect(price.textContent).toContain('4/1');
        const [short, met] = price.children;
        expect(short.className).toContain('border-gi-danger');
        expect(met.className).not.toContain('border-gi-danger');
    });
});

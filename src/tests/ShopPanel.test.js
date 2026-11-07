// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, renderHook, act, waitFor, fireEvent } from '@testing-library/react';
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

import { BankDrawer } from '../ui/components/drawer/BankDrawer.jsx';
import {
    ShopPanel, ShopCard, shopPanelState, shopPanelTransform, shopCardPayload, pointerOverShopPanel,
    isShopPayload, SHOP_LIP_PX, SHOP_CARD_W, SHOP_CARD_H, SHOP_ART_PX
} from '../ui/components/drawer/ShopPanel.jsx';

const h = React.createElement;
const WOOD = 'item_oak_wood';

registerTokenTypes({
    fixture_sp_forest: {
        id: 'fixture_sp_forest', name: 'Fixture Sp Forest', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 10 }], section: 'forestry' }
    }
});

registerTokenTypes({
    fixture_pnl_big: {
        id: 'fixture_pnl_big', name: 'Fixture Pnl Big', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 20 }], section: 'forestry', group: 'Fixture Panel Group' }
    },
    fixture_pnl_small: {
        id: 'fixture_pnl_small', name: 'Fixture Pnl Small', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 4 }], section: 'forestry', group: 'Fixture Panel Group' }
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

/** jsdom has no layout: makes the Shop's row of cards wider than its box, which is when it has arrows. */
const overflowList = (view) => {
    const list = view.container.querySelector('[data-scroll-list]');
    Object.defineProperty(list, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(list, 'scrollWidth', { value: 2000, configurable: true });
    act(() => { list.dispatchEvent(new Event('scroll')); });
};

/** The panel inside a drag system, optionally with a drag in the hand and
 * over a given surface (the lip/open state depends on it). */
function mountDrawer({ isOpen = true, carrying = null, surface = undefined, menuRight = false } = {}) {
    let inner = h(ShopPanel, { isOpen, onClose: () => {}, menuRight });
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
        const view = render(h(BankDrawer, { drawer: drawerFor('shop'), inspect }));
        expect(view.queryByText('Shop')).toBeNull();
        expect(view.queryByTestId('bank-pane')).toBeNull();
    });

    // The inspect column is gone: an item's details are its tile's tooltip.
    it('keeps the Bank, with no inspect column', () => {
        const view = render(h(BankDrawer, { drawer: drawerFor('bank'), inspect }));
        expect(view.getByTestId('bank-pane')).toBeTruthy();
        expect(view.queryByTestId('inspect-column')).toBeNull();
    });

    it('the nav Shop bubble opens and closes the Shop panel, not a Bank pane', async () => {
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

describe('the Shop panel', () => {
    it('rises from the bottom: closed, open, and a lip while a Shop card is carried', () => {
        const shopDrag = { kind: DRAG_KIND.TOKEN, ...shopCardPayload('fixture_sp_forest') };
        const matDrag = { kind: DRAG_KIND.TOKEN, typeId: 'x', from: { instanceId: 't1' } };
        expect(shopPanelState(false, null)).toBe('closed');
        expect(shopPanelState(false, shopDrag)).toBe('closed');
        expect(shopPanelState(true, null)).toBe('open');
        expect(shopPanelState(true, matDrag)).toBe('open');
        expect(shopPanelState(true, shopDrag)).toBe('lip');
        expect(shopPanelTransform('open')).toBe('translateY(0)');
        expect(shopPanelTransform('lip')).toBe(`translateY(calc(100% - ${SHOP_LIP_PX}px))`);
        expect(shopPanelTransform('closed')).toBe('translateY(100%)');
    });

    describe('⭐ the drop to a lip tracks WHERE the card is carried, not just that it is', () => {
        const shopDrag = { kind: DRAG_KIND.TOKEN, ...shopCardPayload('fixture_sp_forest') };

        it('is a lip over the playmat, and up again back over the panel', () => {
            expect(shopPanelState(true, shopDrag, DND_SURFACE.BOARD)).toBe('lip');
            expect(shopPanelState(true, shopDrag, DND_SURFACE.DRAWER)).toBe('open');
        });

        it('defaults to always a lip when no surface is tracked', () => {
            expect(shopPanelState(true, shopDrag)).toBe('lip');
        });

        it('a non-Shop payload never drops the panel, whatever the surface', () => {
            const matDrag = { kind: DRAG_KIND.TOKEN, typeId: 'x', from: { instanceId: 't1' } };
            expect(shopPanelState(true, matDrag, DND_SURFACE.BOARD)).toBe('open');
            expect(shopPanelState(true, matDrag, DND_SURFACE.DRAWER)).toBe('open');
        });

        it('mounted: drops to the lip over the board, and rises back over the panel', () => {
            const overBoard = mountDrawer({ carrying: shopDrag, surface: DND_SURFACE.BOARD });
            const lip = overBoard.container.querySelector('[data-shop-drawer]');
            expect(lip.getAttribute('data-shop-drawer-state')).toBe('lip');
            expect(lip.style.transform).toBe(`translateY(calc(100% - ${SHOP_LIP_PX}px))`);
            expect(lip.querySelector('[data-shop-lip]').className).toContain('opacity-100');
            cleanup();

            const overDrawer = mountDrawer({ carrying: shopDrag, surface: DND_SURFACE.DRAWER });
            expect(overDrawer.container.querySelector('[data-shop-drawer]').getAttribute('data-shop-drawer-state')).toBe('open');
        });
    });

    it('draws open at the bottom, beside the nav on the left', () => {
        const view = mountDrawer();
        const el = view.container.querySelector('[data-shop-drawer]');
        expect(el.getAttribute('data-shop-drawer-state')).toBe('open');
        expect(el.className).toMatch(/(^| )bottom-0( |$)/);
        expect(el.className).toMatch(/(^| )left-0( |$)/);
        expect(el.className).toContain('[--nav-inset-l:84px]');
        expect(el.style.transform).toBe('translateY(0)');
    });

    it('with the nav on the right, it rises beside the nav at the right edge', () => {
        const el = mountDrawer({ menuRight: true }).container.querySelector('[data-shop-drawer]');
        expect(el.className).toMatch(/(^| )right-0( |$)/);
        expect(el.className).toContain('[--nav-inset-r:84px]');
        expect(el.className).not.toContain('--nav-inset-l');
        expect(el.className).not.toMatch(/(^| )left-0( |$)/);
    });

    it('stays a drop target for the mat\'s cancel check: a pointer over the open panel is over it', () => {
        const view = mountDrawer();
        const el = view.container.querySelector('[data-shop-drawer]');
        el.getBoundingClientRect = () => ({ left: 100, right: 900, top: 500, bottom: 800, width: 800, height: 300 });
        expect(pointerOverShopPanel({ x: 400, y: 600 })).toBe(true);
        expect(pointerOverShopPanel({ x: 400, y: 300 })).toBe(false);
    });

    it('slides to the lip while a Shop Token is in the hand, and stays open after', () => {
        const carried = { kind: DRAG_KIND.TOKEN, ...shopCardPayload('fixture_sp_forest') };
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
        expect(pointerOverShopPanel({ x: 0, y: 0 })).toBe(false);
        expect(el.querySelector('[data-shop-row]')).toBeNull();
    });

    it('has no Buy buttons: only Close and the two scroll arrows (FB-25)', () => {
        InventoryManager.addItem(WOOD, 10);
        const view = mountDrawer();
        expect(row(view, 'fixture_sp_forest')).toBeTruthy();
        overflowList(view);
        const buttons = [...view.container.querySelectorAll('button')];
        expect(buttons.map(b => b.title).sort()).toEqual(['Close Shop', 'Scroll left', 'Scroll right']);
    });

    it('an affordable card can be picked up; its payload lands through the mat (from.shop)', () => {
        InventoryManager.addItem(WOOD, 10);
        const view = mountDrawer();
        const r = row(view, 'fixture_sp_forest');
        expect(r.getAttribute('data-shop-affordable')).toBe('true');
        expect(r.getAttribute('aria-roledescription')).toBe('draggable');
        expect(r.querySelector('[data-shop-missing]')).toBeNull();
        const payload = { kind: DRAG_KIND.TOKEN, ...shopCardPayload('fixture_sp_forest') };
        expect(isShopPayload(payload)).toBe(true);
        expect(matAccepts(payload)).toBe(true);
    });

    it('an unaffordable card: the Token dimmed, only the short counts red, no Need line, and it cannot be picked up', () => {
        InventoryManager.addItem(WOOD, 3);
        const view = mountDrawer();
        const r = row(view, 'fixture_sp_forest');
        expect(r.getAttribute('data-shop-affordable')).toBe('false');
        // The card itself is not dimmed; its Token is.
        expect(r.className).not.toMatch(/opacity-/);
        expect(r.querySelector('[data-shop-art]').className).toContain('opacity-40');
        expect(r.getAttribute('aria-roledescription')).toBeNull();
        expect(r.querySelector('[data-shop-missing]')).toBeNull();
        expect(r.textContent).not.toMatch(/Need/);
        const pill = r.querySelector('[data-shop-pill="item_oak_wood"]');
        expect(pill.getAttribute('data-short')).toBe('true');
        expect(pill.textContent).toBe('3/10');
        expect(pill.querySelector('.text-gi-danger')).not.toBeNull();
    });

    it('an affordable card keeps its Token bright and no red', () => {
        InventoryManager.addItem(WOOD, 10);
        const r = row(mountDrawer(), 'fixture_sp_forest');
        expect(r.querySelector('[data-shop-art]').className).not.toContain('opacity-40');
        expect(r.querySelector('.text-gi-danger')).toBeNull();
    });

    it('a card over the mat cap is gated, and keeps its cap message', () => {
        InventoryManager.addItem(WOOD, 10);
        const t = BoardState.createTokenInstance('fixture_sp_forest', 1, null, BoardState.ORIGIN.PLACED);
        BoardState.addToken(t, 1200, 900);
        setMatTuning('tokenCap', MatCap.tokenCount());
        const view = mountDrawer();
        const r = row(view, 'fixture_sp_forest');
        expect(r.getAttribute('data-shop-affordable')).toBe('false');
        expect(r.querySelector('[data-shop-missing]').textContent).toMatch(/Token cap full/);
    });

    it('re-enables live when the Bank fills', () => {
        const view = mountDrawer();
        expect(row(view, 'fixture_sp_forest').getAttribute('data-shop-affordable')).toBe('false');
        act(() => { InventoryManager.addItem(WOOD, 10); });
        expect(row(view, 'fixture_sp_forest').getAttribute('data-shop-affordable')).toBe('true');
    });
});

describe('Shop layout', () => {
    it('every card is the same size: the name, then the Token at 128 px, then the skill icons, then the price', () => {
        InventoryManager.addItem(WOOD, 30);
        const view = mountDrawer();
        const rows = [...view.container.querySelectorAll('[data-shop-row]')];
        expect(rows.length).toBeGreaterThan(1);
        const sizes = new Set(rows.map(r => `${r.style.width} ${r.style.height}`));
        expect(sizes.size).toBe(1);
        expect([...sizes][0]).toBe(`${SHOP_CARD_W}px ${SHOP_CARD_H}px`);
        for (const r of rows) {
            const art = r.querySelector('[data-shop-art]');
            expect(art.style.width).toBe(`${SHOP_ART_PX}px`);
            const img = art.querySelector('img');
            if (img) expect(img.style.width).toBe(`${SHOP_ART_PX}px`);
            const face = r.querySelector('[data-shop-face]');
            const skills = r.querySelector('[data-shop-skills]');
            expect(face.nextElementSibling).toBe(skills);
            expect(face.lastElementChild).toBe(art);
        }
        expect(SHOP_CARD_H).toBeGreaterThan(SHOP_ART_PX);
        expect(SHOP_CARD_W).toBeGreaterThanOrEqual(SHOP_ART_PX);
    });

    it('the cards sit side by side in one row, with no skill headings', () => {
        InventoryManager.addItem(WOOD, 30);
        const view = mountDrawer();
        const list = view.container.querySelector('[data-scroll-list]');
        expect(list.className).toMatch(/(^| )flex( |$)/);
        expect(list.className).not.toContain('flex-col');
        expect(list.className).toContain('overflow-x-auto');
        expect(view.container.querySelector('[data-shop-section]')).toBeNull();
        expect(view.container.querySelector('h3')).toBeNull();
    });

    it('shows the authored skill icons, each naming its skill on hover', () => {
        registerTokenTypes({
            fixture_sp_icons: {
                id: 'fixture_sp_icons', name: 'Fixture Sp Icons', size: 1,
                shop: { price: [{ itemId: WOOD, quantity: 1 }], skills: ['mining', 'melee'], order: 1 }
            }
        });
        const view = mountDrawer();
        const r = row(view, 'fixture_sp_icons');
        expect([...r.querySelectorAll('[data-shop-skill]')].map(e => e.getAttribute('data-shop-skill'))).toEqual(['mining', 'melee']);
        fireEvent.pointerEnter(r.querySelector('[data-shop-skill="mining"]'), { pointerType: 'mouse', clientX: 5, clientY: 5 });
        expect(document.querySelector('[data-tooltip]').textContent).toBe('Mining');
        fireEvent.pointerLeave(r.querySelector('[data-shop-skill="mining"]'));
    });

    it('hovering a Foundation card lists what it builds', () => {
        const view = mountDrawer();
        const r = row(view, 'fixture_sp_forest');
        fireEvent.pointerEnter(r.querySelector('[data-shop-face]'), { pointerType: 'mouse', clientX: 5, clientY: 5 });
        // Not a Foundation: its name only.
        expect(document.querySelector('[data-tooltip]').textContent).toBe('Fixture Sp Forest');
        fireEvent.pointerLeave(r.querySelector('[data-shop-face]'));
        const wood = row(view, 'token_wood_foundation');
        fireEvent.pointerEnter(wood.querySelector('[data-shop-face]'), { pointerType: 'mouse', clientX: 5, clientY: 5 });
        expect(document.querySelector('[data-tooltip]').textContent).toMatch(/^Wood Foundation.*Builds: .*Workbench/);
        fireEvent.pointerLeave(wood.querySelector('[data-shop-face]'));
    });

    it('shows the price in the shorthand counts', () => {
        InventoryManager.addItem(WOOD, 12500);
        const r = row(mountDrawer(), 'fixture_sp_forest');
        expect(r.querySelector('[data-shop-pill="item_oak_wood"]').textContent).toBe('12.5k/10');
    });

    it('lays the price out as a two-column grid', () => {
        const view = mountDrawer();
        const price = view.container.querySelector('[data-shop-row="fixture_sp_forest"] [data-shop-price]');
        expect(price.className).toContain('grid');
        expect(price.className).toContain('grid-cols-2');
    });

    it('has arrow buttons left and right, and no visible scrollbar', () => {
        const view = mountDrawer();
        overflowList(view);
        const up = view.container.querySelector('[data-scroll-arrow="left"]');
        const down = view.container.querySelector('[data-scroll-arrow="right"]');
        expect(up).toBeTruthy();
        expect(down).toBeTruthy();
        expect(up.compareDocumentPosition(down) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        const list = view.container.querySelector('[data-scroll-list]');
        expect(list.className).toContain('[scrollbar-width:none]');
        expect(list.className).not.toContain('gi-scrollbar');
        let scrolled = null;
        list.scrollBy = (o) => { scrolled = o; };
        Object.defineProperty(list, 'scrollLeft', { value: 100, configurable: true });
        act(() => { list.dispatchEvent(new Event('scroll')); });
        expect(up.disabled).toBe(false);
        fireEvent.click(up);
        expect(scrolled.left).toBeLessThan(0);
        expect(scrolled.top).toBeUndefined();
    });
});

describe('Shop groups', () => {
    const groupRow = (view) => view.container.querySelector('[data-shop-group="Fixture Panel Group"]');

    it('a group is one card with a dropdown listing every entry, cheapest picked first', () => {
        InventoryManager.addItem(WOOD, 30);
        const view = mountDrawer();
        expect(view.container.querySelectorAll('[data-shop-group="Fixture Panel Group"]')).toHaveLength(1);
        const r = groupRow(view);
        const select = r.querySelector('[data-shop-select]');
        expect([...select.options].map(o => o.value)).toEqual(['fixture_pnl_small', 'fixture_pnl_big']);
        expect(select.value).toBe('fixture_pnl_small');
        expect(r.getAttribute('data-shop-row')).toBe('fixture_pnl_small');
        expect(r.querySelector('[data-shop-price]').textContent).toContain('30/4');
        // An ungrouped card has no dropdown.
        expect(row(view, 'fixture_sp_forest').querySelector('[data-shop-select]')).toBeNull();
    });

    it('picking an entry shows its price and drags that entry', () => {
        InventoryManager.addItem(WOOD, 30);
        const view = mountDrawer();
        fireEvent.change(groupRow(view).querySelector('[data-shop-select]'), { target: { value: 'fixture_pnl_big' } });
        const r = groupRow(view);
        expect(r.getAttribute('data-shop-row')).toBe('fixture_pnl_big');
        expect(r.querySelector('[data-shop-price]').textContent).toContain('30/20');
        expect(r.getAttribute('aria-roledescription')).toBe('draggable');
    });

    it('the picked entry is gated by its own price: affordable small, not big', () => {
        InventoryManager.addItem(WOOD, 5);
        const view = mountDrawer();
        expect(groupRow(view).getAttribute('data-shop-affordable')).toBe('true');
        fireEvent.change(groupRow(view).querySelector('[data-shop-select]'), { target: { value: 'fixture_pnl_big' } });
        const r = groupRow(view);
        expect(r.getAttribute('data-shop-affordable')).toBe('false');
        expect(r.querySelector('[data-shop-pill="item_oak_wood"]').getAttribute('data-short')).toBe('true');
        expect(r.getAttribute('aria-roledescription')).toBeNull();
    });
});

describe('Shop card prices', () => {
    const item = (price, success = true) => ({
        typeId: 'fixture_sp_forest',
        name: 'Test Forest',
        price,
        skills: [],
        affordability: success ? { success: true } : { success: false, reason: 'Need 3× Oak Wood' }
    });

    it('draws each price line as a pill, have / need, red when short, at most two by two', () => {
        const line = (itemId, need, have) => ({ itemId, name: itemId, need, have, enough: have >= need });
        const view = render(h(DeckDndProvider, null, h(ShopCard, {
            item: item([
                line('item_oak_wood', 5, 2), line('item_stone', 1, 4), line('item_a', 1, 1), line('item_b', 1, 1), line('item_c', 1, 1)
            ], false)
        })));
        const price = view.container.querySelector('[data-shop-price]');
        expect(price.className).toContain('grid-cols-2');
        expect(price.children).toHaveLength(4);
        expect(price.textContent).toContain('2/5');
        expect(price.textContent).toContain('4/1');
        const [short, met] = price.querySelectorAll('[data-shop-pill]');
        expect(short.getAttribute('data-short')).toBe('true');
        expect(met.getAttribute('data-short')).toBeNull();
        expect(met.querySelector('.text-gi-danger')).toBeNull();
    });
});

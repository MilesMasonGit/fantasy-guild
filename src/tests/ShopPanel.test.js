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
import { DeckDndProvider, DeckDndContext, interceptedDrop } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND, DRAG_SFX } from '../ui/dnd/dragConstants.js';
import * as Placement from '../systems/board/Placement.js';
import * as Shop from '../systems/board/Shop.js';
import * as Hand from '../systems/board/Hand.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import { matAccepts } from '../ui/components/board/Board.jsx';
import { useUIModals } from '../ui/hooks/useUIModals.js';

// The Bank drawer's panes are stood in: this checks which panes the drawer
// lays out, not what the Bank draws inside them.
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
    isShopPayload, isStripDrag, isRefundablePayload, stripHoverStart, stripHoverAt,
    SHOP_CARD_W, SHOP_CARD_H, SHOP_ART_PX
} from '../ui/components/drawer/ShopPanel.jsx';
import { DOCK_STRIP_PX, dockArtPx, dockLabelOverhangPx } from '../ui/components/dock/dockHeroView.js';
import { getLiveMatFit } from '../ui/components/board/MatFitContext.jsx';

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

const FOUND_PRICE = [{ itemId: WOOD, quantity: 6 }];
registerTokenTypes({
    fixture_sp_found: {
        id: 'fixture_sp_found', name: 'Fixture Sp Foundation', rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'sp_wood', skill: 'construction' },
        shop: { price: FOUND_PRICE, section: 'general' }
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

/** The panel inside a drag system, optionally with a drag in the hand. */
function mountDrawer({ isOpen = true, carrying = null, menuRight = false } = {}) {
    const inner = h(ShopPanel, { isOpen, onClose: () => {}, menuRight });
    const withDrag = carrying
        ? h(DeckDndContext.Provider, { value: { activePayload: carrying, isDragging: true } }, inner)
        : inner;
    return render(h(DeckDndProvider, null, withDrag));
}

/**
 * jsdom has no layout: a 1000 x 800 screen, the panel's foot 200 tall, so the lowered Shop's top
 * edge stands at 600, and the risen panel's top at 300 (its box 500 tall from the screen's bottom
 * edge). Lowered, its live box is drawn mid-slide, still higher than where it comes to rest.
 */
function fakeLayout() {
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function box() {
        const r = (top, bottom) => ({ left: 0, right: 1000, top, bottom, width: 1000, height: bottom - top, x: 0, y: top });
        if (this.hasAttribute?.('data-shop-drawer')) {
            return this.getAttribute('data-shop-drawer-state') === 'open' ? r(300, 800) : r(450, 950);
        }
        return r(0, 800);
    });
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function h() {
        if (this.hasAttribute?.('data-shop-foot')) return 200;
        return this.hasAttribute?.('data-shop-drawer') ? 500 : 0;
    });
    return () => { rect.mockRestore(); height.mockRestore(); };
}

/** The pointer moved to viewport height `y` during the drag. */
const move = (y) => act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 500, clientY: y })); });

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
    it('rises from the bottom: closed, open, and lowered to the hero bar during a Shop drag', () => {
        const shopDrag = { kind: DRAG_KIND.TOKEN, ...shopCardPayload('fixture_sp_forest') };
        const matDrag = { kind: DRAG_KIND.TOKEN, typeId: 'x', from: { instanceId: 't1' } };
        expect(shopPanelState(false, null)).toBe('closed');
        expect(shopPanelState(false, shopDrag)).toBe('closed');
        expect(shopPanelState(true, null)).toBe('open');
        expect(shopPanelState(true, matDrag)).toBe('open');
        expect(shopPanelState(true, shopDrag)).toBe('lip');
        expect(shopPanelState(true, shopDrag, { raised: true })).toBe('open');
        expect(shopPanelTransform('open')).toBe('translateY(0)');
        // Lowered, only its foot stays up: its top edge at the top of the bar's names and HP bars.
        expect(shopPanelTransform('lip', { foot: 112 })).toBe('translateY(calc(100% - 112px))');
        expect(shopPanelTransform('closed')).toBe('translateY(100%)');
        expect(shopPanelTransform('closed', { under: 64 })).toBe('translateY(calc(100% + 64px))');
    });

    it("reaches the screen's bottom edge behind the bar, its foot kept clear for the bar and the names over it", () => {
        const foot = DOCK_STRIP_PX + dockLabelOverhangPx(dockArtPx(getLiveMatFit()));
        expect(foot).toBeGreaterThan(DOCK_STRIP_PX);
        const view = mountDrawer();
        const el = view.container.querySelector('[data-shop-drawer]');
        // No gap between the panel and the screen's bottom edge, where the bar stands.
        expect(el.style.bottom).toBe('0px');
        expect(el.querySelector('[data-shop-foot]').style.height).toBe(`${foot}px`);
        // No separate strip: the drawer itself is what lowers.
        expect(view.container.querySelector('[data-shop-strip]')).toBeNull();
    });

    describe('⭐ the state machine: a Foundation from the mat lowers the Shop too', () => {
        const foundationDrag = { kind: DRAG_KIND.TOKEN, typeId: 'fixture_sp_found', from: { instanceId: 'f1' } };
        const builtDrag = { kind: DRAG_KIND.TOKEN, typeId: 'x', from: { instanceId: 't1' } };

        it('the Shop open: lowered, raised while hovered, open again after the drop', () => {
            expect(shopPanelState(true, foundationDrag, { refundable: true })).toBe('lip');
            expect(shopPanelState(true, foundationDrag, { refundable: true, raised: true })).toBe('open');
            expect(shopPanelState(true, null)).toBe('open');
        });

        it('the Shop closed: lowered the same way, raised while hovered, and closed again after the drop', () => {
            expect(shopPanelState(false, foundationDrag, { refundable: true })).toBe('lip');
            expect(shopPanelState(false, foundationDrag, { refundable: true, raised: true })).toBe('open');
            expect(shopPanelState(false, null)).toBe('closed');
        });

        it('a Token that cannot go back never drops or raises the Shop', () => {
            expect(shopPanelState(true, builtDrag, { refundable: false })).toBe('open');
            expect(shopPanelState(false, builtDrag, { refundable: false })).toBe('closed');
            expect(shopPanelState(false, builtDrag, { refundable: false, raised: true })).toBe('closed');
            expect(isStripDrag(false, builtDrag, false)).toBe(false);
            expect(isStripDrag(false, foundationDrag, true)).toBe(true);
        });

        it('only a placed, unbuilt Foundation on the mat counts as refundable', () => {
            for (const { itemId, quantity } of FOUND_PRICE) InventoryManager.addItem(itemId, quantity);
            const bought = Shop.buyAt('fixture_sp_found', { x: 560, y: 520 });
            expect(bought.success, bought.reason).toBe(true);
            expect(isRefundablePayload({ kind: DRAG_KIND.TOKEN, typeId: 'fixture_sp_found', from: { instanceId: bought.instance.id } })).toBe(true);
            expect(isRefundablePayload({ kind: DRAG_KIND.TOKEN, ...shopCardPayload('fixture_sp_found') })).toBe(false);
            expect(isRefundablePayload({ kind: DRAG_KIND.TOKEN, typeId: 'x', from: { instanceId: 'nothing-here' } })).toBe(false);
        });
    });

    describe('⭐ the lowered Shop hover: judged by where the Token is carried, against its lowered edge, not the drag-start snapshot', () => {
        const geo = { stripTop: 600, openTop: 300 };

        it('a Shop card starts on the risen panel, drops once carried above it, and rises again on its lowered edge', () => {
            let h0 = stripHoverStart({ kind: DRAG_KIND.TOKEN, ...shopCardPayload('fixture_sp_forest') });
            expect(h0).toEqual({ raised: true, armed: true });
            h0 = stripHoverAt(h0, 400, geo);                  // still over the risen panel
            expect(h0.raised).toBe(true);
            h0 = stripHoverAt(h0, 250, geo);                  // left it upward
            expect(h0.raised).toBe(false);
            h0 = stripHoverAt(h0, 400, geo);                  // where the panel was: the mat now
            expect(h0.raised).toBe(false);
            h0 = stripHoverAt(h0, 610, geo);                  // down onto the strip
            expect(h0.raised).toBe(true);
        });

        it('a Token picked up where the lowered edge appears is not armed until carried above it', () => {
            let h0 = stripHoverStart({ kind: DRAG_KIND.TOKEN, typeId: 'x', from: { instanceId: 'f1' } });
            expect(h0).toEqual({ raised: false, armed: false });
            h0 = stripHoverAt(h0, 620, geo);
            expect(h0).toEqual({ raised: false, armed: false });
            h0 = stripHoverAt(h0, 500, geo);
            expect(h0).toEqual({ raised: false, armed: true });
            h0 = stripHoverAt(h0, 620, geo);
            expect(h0).toEqual({ raised: true, armed: true });
        });

        it('a move that changes nothing returns the same object (no redraw)', () => {
            const h0 = { raised: false, armed: true };
            expect(stripHoverAt(h0, 450, geo)).toBe(h0);
        });

        it('mounted: the Shop lowers for a Foundation from the mat with the Shop closed, and rises on hover', () => {
            for (const { itemId, quantity } of FOUND_PRICE) InventoryManager.addItem(itemId, quantity);
            const f = Shop.buyAt('fixture_sp_found', { x: 560, y: 520 }).instance;
            const carried = { kind: DRAG_KIND.TOKEN, typeId: f.typeId, from: { instanceId: f.id } };
            const restore = fakeLayout();
            try {
                const view = mountDrawer({ isOpen: false, carrying: carried });
                const panel = view.container.querySelector('[data-shop-drawer]');
                const foot = DOCK_STRIP_PX + dockLabelOverhangPx(dockArtPx(getLiveMatFit()));
                expect(panel.getAttribute('data-shop-drawer-state')).toBe('lip');
                expect(panel.style.transform).toBe(`translateY(calc(100% - ${foot}px))`);
                expect(panel.style.visibility).toBe('visible');
                move(500);
                move(610);
                expect(panel.getAttribute('data-shop-drawer-state')).toBe('open');
                move(250);
                expect(panel.getAttribute('data-shop-drawer-state')).toBe('lip');
            } finally { restore(); }
        });

        it('mounted: a Shop card picked up is over the risen panel, and the Shop lowers once it leaves it upward', () => {
            const carried = { kind: DRAG_KIND.TOKEN, ...shopCardPayload('fixture_sp_forest') };
            const restore = fakeLayout();
            try {
                const view = mountDrawer({ carrying: carried });
                const panel = view.container.querySelector('[data-shop-drawer]');
                expect(panel.getAttribute('data-shop-drawer-state')).toBe('open');
                move(250);
                expect(panel.getAttribute('data-shop-drawer-state')).toBe('lip');
            } finally { restore(); }
        });
    });

    describe('⭐ the drop: a Foundation from the mat let go over the lowered Shop or the risen Shop goes back to it', () => {
        const over = { x: 500, y: 620 };
        const above = { x: 500, y: 200 };
        const buy = () => {
            for (const { itemId, quantity } of FOUND_PRICE) InventoryManager.addItem(itemId, quantity);
            return Shop.buyAt('fixture_sp_found', { x: 560, y: 520 }).instance;
        };
        const payloadOf = (f) => ({ kind: DRAG_KIND.TOKEN, typeId: f.typeId, from: { instanceId: f.id } });

        it('over the lowered Shop\'s edge, the Shop closed and not yet risen: refunded, put down, with the refund sound', () => {
            const f = buy();
            expect(InventoryManager.getItemCount(WOOD)).toBe(0);
            Hand.setInHand(f.id, true);
            const restore = fakeLayout();
            try {
                const view = mountDrawer({ isOpen: false, carrying: payloadOf(f) });
                move(500);                                   // carried above the lowered edge: armed
                // Let go the moment it reaches the edge: judged where the edge rests, not on the
                // panel's box mid-slide (450 here) nor the drag-start snapshot.
                expect(view.container.querySelector('[data-shop-drawer]').getAttribute('data-shop-drawer-state')).toBe('lip');
                expect(interceptedDrop(payloadOf(f), { pointer: over })).toEqual({ success: true, sfx: DRAG_SFX.refund });
            } finally { restore(); }
            expect(BoardState.getTokenById(f.id)).toBeNull();
            expect(InventoryManager.getItemCount(WOOD)).toBe(6);
            expect(Hand.isInHand(f.id)).toBe(false);
        });

        it('over the Shop risen by the hover, the Shop open before: refunded', () => {
            const f = buy();
            const restore = fakeLayout();
            try {
                const view = mountDrawer({ isOpen: true, carrying: payloadOf(f) });
                move(500);
                expect(view.container.querySelector('[data-shop-drawer]').getAttribute('data-shop-drawer-state')).toBe('lip');
                move(620);
                move(400);                                   // up over the risen panel's cards
                expect(view.container.querySelector('[data-shop-drawer]').getAttribute('data-shop-drawer-state')).toBe('open');
                expect(interceptedDrop(payloadOf(f), { pointer: { x: 500, y: 400 } })).toEqual({ success: true, sfx: DRAG_SFX.refund });
            } finally { restore(); }
            expect(BoardState.getTokenById(f.id)).toBeNull();
        });

        it('picked up where the lowered edge appears and let go there without leaving it: not taken (a plain put-down)', () => {
            const f = buy();
            const restore = fakeLayout();
            try {
                mountDrawer({ isOpen: false, carrying: payloadOf(f) });
                move(630);
                expect(interceptedDrop(payloadOf(f), { pointer: over })).toBeNull();
            } finally { restore(); }
            expect(BoardState.getTokenById(f.id)).toBeTruthy();
        });

        it('let go over the mat, above the lowered edge: not taken, the mat moves it as before', () => {
            const f = buy();
            const restore = fakeLayout();
            try {
                mountDrawer({ isOpen: false, carrying: payloadOf(f) });
                move(500);
                expect(interceptedDrop(payloadOf(f), { pointer: above })).toBeNull();
                // Just above where the edge comes to rest, though the sliding panel is still drawn there.
                expect(interceptedDrop(payloadOf(f), { pointer: { x: 500, y: 520 } })).toBeNull();
            } finally { restore(); }
            expect(BoardState.getTokenById(f.id)).toBeTruthy();
        });

        it('a Token that cannot go back, let go over the open Shop: not the Shop\'s, it lands on the mat under it as before', () => {
            const t = BoardState.createTokenInstance('fixture_sp_forest');
            Placement.placeTokenAt(t, { x: 300, y: 300 });
            const restore = fakeLayout();
            try {
                mountDrawer({ isOpen: true, carrying: payloadOf(t) });
                move(400);
                expect(interceptedDrop(payloadOf(t), { pointer: { x: 500, y: 400 } })).toBeNull();
            } finally { restore(); }
            expect(BoardState.getTokenById(t.id)).toBeTruthy();
        });

        it('a refund the Shop turns down at the drop: the reason said over the Token, which stays', () => {
            const f = buy();
            const said = [];
            const off = EventBus.subscribe(UI_EVENTS.UI_TOKEN_ALERT, (p) => said.push(p));
            const restore = fakeLayout();
            try {
                mountDrawer({ isOpen: false, carrying: payloadOf(f) });
                move(500);
                // No longer the player's to hand back by the time it is let go.
                BoardState.getTokenById(f.id).origin = BoardState.ORIGIN.SPAWNED;
                expect(interceptedDrop(payloadOf(f), { pointer: over })).toEqual({ success: false });
            } finally { restore(); off?.(); }
            expect(BoardState.getTokenById(f.id)).toBeTruthy();
            expect(said).toHaveLength(1);
            expect(said[0]).toMatchObject({ instanceId: f.id, severity: 'disallow', title: 'Fixture Sp Foundation was not bought at the Shop' });
        });

        it('a Shop card let go over the lowered Shop is not the Shop\'s to take: the mat cancels it as before', () => {
            const card = { kind: DRAG_KIND.TOKEN, ...shopCardPayload('fixture_sp_forest') };
            const restore = fakeLayout();
            try {
                mountDrawer({ carrying: card });
                move(250);
                expect(interceptedDrop(card, { pointer: over })).toBeNull();
                expect(pointerOverShopPanel(over)).toBe(true);
            } finally { restore(); }
        });
    });

    it('draws open at the bottom, beside the nav on the left', () => {
        const view = mountDrawer();
        const el = view.container.querySelector('[data-shop-drawer]');
        expect(el.getAttribute('data-shop-drawer-state')).toBe('open');
        expect(el.style.bottom).toBe('0px');
        expect(el.className).toMatch(/(^| )inset-x-0( |$)/);
        expect(el.className).toContain('[--nav-inset-l:84px]');
        expect(el.style.transform).toBe('translateY(0)');
    });

    it('with the nav on the right, it spans the screen the same way, its rows padded for the nav at the right', () => {
        const el = mountDrawer({ menuRight: true }).container.querySelector('[data-shop-drawer]');
        expect(el.className).toMatch(/(^| )inset-x-0( |$)/);
        expect(el.className).toContain('[--nav-inset-r:84px]');
        expect(el.className).not.toContain('--nav-inset-l');
    });

    it('stays a drop target for the mat\'s cancel check: a pointer over the open panel is over it', () => {
        const restore = fakeLayout();
        try {
            mountDrawer();
            expect(pointerOverShopPanel({ x: 400, y: 350 })).toBe(true);
            expect(pointerOverShopPanel({ x: 400, y: 250 })).toBe(false);
        } finally { restore(); }
    });

    it('lowers while a Shop Token is carried above it, and stays open after', () => {
        const carried = { kind: DRAG_KIND.TOKEN, ...shopCardPayload('fixture_sp_forest') };
        const restore = fakeLayout();
        try {
            const view = mountDrawer({ carrying: carried });
            move(250);
            expect(view.container.querySelector('[data-shop-drawer]').getAttribute('data-shop-drawer-state')).toBe('lip');
        } finally { restore(); }
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
        expect(r.className).toContain('cursor-grab');
        expect(r.hasAttribute('tabindex')).toBe(false);
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
        expect(r.className).toContain('cursor-not-allowed');
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
        expect(r.className).toContain('cursor-grab');
        expect(r.hasAttribute('tabindex')).toBe(false);
    });

    it('the picked entry is gated by its own price: affordable small, not big', () => {
        InventoryManager.addItem(WOOD, 5);
        const view = mountDrawer();
        expect(groupRow(view).getAttribute('data-shop-affordable')).toBe('true');
        fireEvent.change(groupRow(view).querySelector('[data-shop-select]'), { target: { value: 'fixture_pnl_big' } });
        const r = groupRow(view);
        expect(r.getAttribute('data-shop-affordable')).toBe('false');
        expect(r.querySelector('[data-shop-pill="item_oak_wood"]').getAttribute('data-short')).toBe('true');
        expect(r.className).toContain('cursor-not-allowed');
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

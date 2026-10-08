// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DndContext, useDndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as DiscardBin from '../systems/board/DiscardBin.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { EngineContext } from '../ui/context/EngineContext';
import { DeckDndContext, DeckDndProvider, DropTarget, useEntityDrag } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../ui/dnd/dragConstants.js';
import { BIN_DROP_ID } from '../ui/components/board/DiscardBinPanel.jsx';
import {
    NotificationSidebars, pointerAtSidebar, SIDEBAR_APPROACH_PX
} from '../ui/components/board/PopOutSidebars.jsx';
import { NOTIFICATION_STRIP_PX, NOTIFICATION_COLUMN, columnWidthAt } from '../ui/components/board/boardConstants.js';

vi.mock('../ui/components/base/ToastContainer.jsx', () => ({
    default: () => React.createElement('i', { 'data-toasts': true })
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The Notifications and Bin sidebars: slim tabs on the screen edge that pop out over the mat on
 * hover, so the mat keeps the width the old column took. A Token carried towards the bin opens
 * it, and the bin only catches drops while it is open.
 */

const h = React.createElement;

/** Exposes dnd-kit's droppable registry to the tests. */
let registry = null;
const Probe = () => { registry = useDndContext().droppableContainers; return null; };

function tree({ activePayload = null, menuRight = false } = {}) {
    return (
        h(EngineContext.Provider, { value: { GameState, EventBus } },
            h(DndContext, null,
                h(DeckDndContext.Provider, { value: { activePayload, isDragging: !!activePayload } },
                    h(NotificationSidebars, { menuRight }),
                    h(Probe))))
    );
}
const mount = (props) => render(tree(props));
/** The dragged pointer moves (dnd-kit's own pointer events reach the window). */
const movePointer = (x, y) => act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y })); });

const rect = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top });

/** The bin tab is on the right edge of a 1600 px window; its panel hangs off its left. */
function placeRects() {
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
        if (this.matches?.('[data-sidebar="bin"] [data-sidebar-tab]')) return rect(1572, 700, 1600, 812);
        if (this.parentElement?.matches?.('[data-sidebar="bin"]') && this.tagName === 'DIV' && !this.hasAttribute('data-sidebar-tab')) {
            return rect(1316, 500, 1572, 812);
        }
        return rect(0, 0, 0, 0);
    });
    return spy;
}

const binSidebar = (c) => c.querySelector('[data-sidebar="bin"]');
const noteSidebar = (c) => c.querySelector('[data-sidebar="notifications"]');
const isOpen = (el) => el.getAttribute('data-open') === 'true';
const binDropDisabled = () => registry.get(BIN_DROP_ID).disabled;

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    resetMatTuning();
    NotificationSystem.clearAll?.();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('the strip', () => {
    it('reserves far less than the old column, so the mat grows into the rest', () => {
        expect(NOTIFICATION_STRIP_PX).toBeLessThan(columnWidthAt(1280, NOTIFICATION_COLUMN) / 4);
        const { container } = mount();
        expect(container.querySelector('aside').style.width).toBe(`${NOTIFICATION_STRIP_PX}px`);
    });

    it('keeps both panels in the page while shut (the toast list holds state)', () => {
        const { container } = mount();
        expect(noteSidebar(container).textContent).toContain('Notifications');
        expect(container.querySelector('[data-discard-bin]')).not.toBeNull();
    });
});

describe('hover', () => {
    it('the notifications sidebar opens on hover and closes on leave', () => {
        const { container } = mount();
        const side = noteSidebar(container);
        expect(isOpen(side)).toBe(false);
        fireEvent.mouseEnter(side);
        expect(isOpen(side)).toBe(true);
        fireEvent.mouseLeave(side);
        expect(isOpen(side)).toBe(false);
    });

    it('the bin sidebar opens on hover and closes on leave', () => {
        const { container } = mount();
        const side = binSidebar(container);
        expect(isOpen(side)).toBe(false);
        fireEvent.mouseEnter(side);
        expect(isOpen(side)).toBe(true);
        fireEvent.mouseLeave(side);
        expect(isOpen(side)).toBe(false);
    });

    it('a shut panel cannot be tabbed into or clicked (inert), an open one can', () => {
        const { container } = mount();
        const panel = container.querySelector('[data-discard-bin]').parentElement;
        expect(panel.hasAttribute('inert')).toBe(true);
        fireEvent.mouseEnter(binSidebar(container));
        expect(panel.hasAttribute('inert')).toBe(false);
    });

    it('the tab counts the notifications waiting', async () => {
        const { container } = mount();
        expect(noteSidebar(container).querySelector('[data-sidebar-count]')).toBeNull();
        await act(async () => { NotificationSystem.info('one'); NotificationSystem.warning('two'); });
        expect(noteSidebar(container).querySelector('[data-sidebar-count]')?.textContent).toBe('2');
    });
});

describe('pointerAtSidebar', () => {
    const strip = rect(1572, 700, 1600, 812);
    const panel = rect(1316, 500, 1572, 812);
    const base = { strip, panel, towardMat: 'left' };

    it('shut: opens within the margin of the tab, over the height the panel would cover', () => {
        expect(pointerAtSidebar({ x: 1572 - SIDEBAR_APPROACH_PX + 1, y: 600 }, { ...base, open: false })).toBe(true);
        expect(pointerAtSidebar({ x: 1572 - SIDEBAR_APPROACH_PX - 5, y: 600 }, { ...base, open: false })).toBe(false);
        expect(pointerAtSidebar({ x: 1580, y: 400 }, { ...base, open: false })).toBe(false);
    });

    it('open: stays open across the whole panel, closes once the pointer leaves it', () => {
        expect(pointerAtSidebar({ x: 1330, y: 520 }, { ...base, open: true })).toBe(true);
        expect(pointerAtSidebar({ x: 1300, y: 520 }, { ...base, open: true })).toBe(false);
    });

    it('mirrors when the mat is on the right of the tab', () => {
        const left = { strip: rect(0, 700, 28, 812), panel: rect(28, 500, 284, 812), towardMat: 'right' };
        expect(pointerAtSidebar({ x: 60, y: 600 }, { ...left, open: false })).toBe(true);
        expect(pointerAtSidebar({ x: 28 + SIDEBAR_APPROACH_PX + 20, y: 600 }, { ...left, open: false })).toBe(false);
    });
});

describe('dragging to the bin', () => {
    function token() {
        const t = BoardState.createTokenInstance('fixture_producer', tokenStartingUses('fixture_producer'), null, BoardState.ORIGIN.PLACED);
        return BoardState.addToken(t, 300, 300);
    }
    const carry = (t) => ({ kind: DRAG_KIND.TOKEN, typeId: t.typeId, from: { instanceId: t.id } });

    it('a Token carried near the bin edge opens it and turns its drop target on', () => {
        const t = token();
        placeRects();
        const far = mount({ activePayload: carry(t) });
        movePointer(900, 600);
        expect(isOpen(binSidebar(far.container))).toBe(false);
        expect(binDropDisabled()).toBe(true);
        cleanup();

        const near = mount({ activePayload: carry(t) });
        movePointer(1540, 600);
        expect(isOpen(binSidebar(near.container))).toBe(true);
        expect(binDropDisabled()).toBe(false);
    });

    it('a Token carried near the edge does not open the notifications', () => {
        const t = token();
        placeRects();
        const { container } = mount({ activePayload: carry(t) });
        movePointer(1540, 600);
        expect(isOpen(noteSidebar(container))).toBe(false);
    });

    it('a drop on the open bin bins the Token', () => {
        const t = token();
        placeRects();
        mount({ activePayload: carry(t) });
        movePointer(1540, 600);
        const target = registry.get(BIN_DROP_ID);
        expect(target.disabled).toBe(false);
        expect(target.data.current.accepts(carry(t))).toBe(true);
        expect(target.data.current.onDrop(carry(t))).toBeUndefined();
        expect(DiscardBin.isBinned(t.id)).toBe(true);
    });

    it('a shut bin has no live drop target', () => {
        const { container } = mount();
        expect(isOpen(binSidebar(container))).toBe(false);
        expect(binDropDisabled()).toBe(true);
    });

    it('a binned Token dragged back out leaves the target off, so the mat under the panel wins', () => {
        const t = token();
        DiscardBin.binToken(t.id);
        placeRects();
        const payload = { kind: DRAG_KIND.TOKEN, typeId: t.typeId, from: { binnedId: t.id } };
        // The press happens on the open panel; the drag then starts with the pointer on it.
        const { container, rerender } = mount();
        fireEvent.mouseEnter(binSidebar(container));
        rerender(tree({ activePayload: payload }));
        movePointer(1400, 600);
        expect(isOpen(binSidebar(container))).toBe(true);
        expect(binDropDisabled()).toBe(true);
        // The slot being dragged is still in the page.
        expect(container.querySelector(`[data-bin-slot="${t.id}"]`)).not.toBeNull();
    });
});

/**
 * ⭐ The bin is drawn open within a few ms of the pointer move that opens it, but dnd-kit only
 * treats it as the drop target ~25 ms later (its target switches on in a passive effect, and its
 * `over` lags behind that). A release in that gap used to drop the Token on the mat under the
 * panel. The bin now answers for itself at the release (`useLiveDropTarget`).
 */
describe('a fast release on the bin', () => {
    let matDrops;
    beforeEach(() => { matDrops = []; });

    function token() {
        const t = BoardState.createTokenInstance('fixture_producer', tokenStartingUses('fixture_producer'), null, BoardState.ORIGIN.PLACED);
        return BoardState.addToken(t, 300, 300);
    }

    /** Something to pick up, carrying `payload`. */
    const Source = ({ payload }) => {
        const drag = useEntityDrag({ id: 'race-src', kind: DRAG_KIND.TOKEN, payload, sourceSurface: DND_SURFACE.BOARD });
        return h('div', { ref: drag.setNodeRef, ...drag.handleProps, 'data-race-src': true });
    };

    /** The real drag provider, a mat that takes any Token, the sidebars, and the source. */
    function mountRace(payload) {
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
            if (this.matches?.('[data-sidebar="bin"] [data-sidebar-tab]')) return rect(1572, 700, 1600, 812);
            if (this.matches?.('[data-discard-bin]')) return rect(1320, 504, 1568, 808);
            if (this.parentElement?.matches?.('[data-sidebar="bin"]') && this.tagName === 'DIV' && !this.hasAttribute('data-sidebar-tab')) {
                return rect(1316, 500, 1572, 812);
            }
            if (this.matches?.('[data-race-mat]')) return rect(0, 0, 1600, 1000);
            if (this.matches?.('[data-race-src]')) return rect(880, 580, 920, 620);
            return rect(0, 0, 0, 0);
        });
        const view = render(
            h(EngineContext.Provider, { value: { GameState, EventBus } },
                h(DeckDndProvider, null,
                    h(DropTarget, {
                        id: 'race-mat', surface: DND_SURFACE.BOARD, 'data-race-mat': true,
                        accepts: (p) => p?.kind === DRAG_KIND.TOKEN,
                        onDrop: (p) => { matDrops.push(p); }
                    }),
                    h(NotificationSidebars),
                    h(Source, { payload })))
        );
        const src = view.container.querySelector('[data-race-src]');
        const at = (type, x, y) => fireEvent[type](src, { pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0 });
        // Picked up over the mat, past the 8 px threshold.
        act(() => { at('pointerDown', 900, 600); });
        act(() => { at('pointerMove', 930, 600); });
        return { ...view, at };
    }

    it('released in the same instant as the move that opened the bin, the Token is binned', () => {
        const t = token();
        const { container, at } = mountRace({ typeId: t.typeId, from: { instanceId: t.id } });
        expect(document.body.classList.contains('gi-dnd-active')).toBe(true);
        expect(isOpen(binSidebar(container))).toBe(false);
        // One act: the move and the release land before React redraws anything (0 ms).
        act(() => {
            at('pointerMove', 1540, 650);
            at('pointerUp', 1540, 650);
        });
        expect(DiscardBin.isBinned(t.id)).toBe(true);
        expect(matDrops).toHaveLength(0);
    });

    it('released 8 ms after it, still binned', async () => {
        const t = token();
        const { at } = mountRace({ typeId: t.typeId, from: { instanceId: t.id } });
        // Still inside one act, so React has not redrawn: the release comes 8 ms after the move.
        await act(async () => {
            at('pointerMove', 1540, 650);
            await new Promise(r => setTimeout(r, 8));
            at('pointerUp', 1540, 650);
        });
        expect(DiscardBin.isBinned(t.id)).toBe(true);
        expect(matDrops).toHaveLength(0);
    });

    it('released over where the shut panel would be, it lands on the mat', () => {
        const t = token();
        const { at } = mountRace({ typeId: t.typeId, from: { instanceId: t.id } });
        // Straight to the middle of the panel's area, beyond the tab's opening margin: still shut.
        act(() => {
            at('pointerMove', 1400, 650);
            at('pointerUp', 1400, 650);
        });
        expect(DiscardBin.isBinned(t.id)).toBe(false);
        expect(matDrops).toHaveLength(1);
    });

    it('a binned Token dragged back out never drops back on the open bin', () => {
        const t = token();
        DiscardBin.binToken(t.id);
        const { container, at } = mountRace({ typeId: t.typeId, from: { binnedId: t.id } });
        act(() => { at('pointerMove', 1540, 650); });
        expect(isOpen(binSidebar(container))).toBe(true);
        act(() => {
            at('pointerMove', 1450, 650);
            at('pointerUp', 1450, 650);
        });
        expect(matDrops).toHaveLength(1);
        expect(matDrops[0].from.binnedId).toBe(t.id);
    });
});

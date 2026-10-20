// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { AtlasTome, TomeSpread } from '../ui/components/atlas/AtlasTome.jsx';
import { dropOnSlot, liftFromSlot } from '../ui/components/atlas/CartographyTable.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { act } from '@testing-library/react';
import { TOME_ART, PARCHMENT_ART, TOME_SCALES, DEFAULT_TOME_SCALE, spreadSize, pageRects } from '../ui/components/atlas/tomeArt.js';
import { placeBook, ribbonsTucked } from '../ui/components/atlas/AtlasTome.jsx';
import { getTomeScale, setTomeScale } from '../ui/components/atlas/tomeScale.js';

/**
 * The Atlas tome: the bookmark ribbons switch the section with a page turn (none under reduced
 * motion), and carrying maps onto the Cartography slots never slots more copies than the Bank
 * holds.
 */

const A = 'map_a';
const B = 'map_b';
const held = new Map([[A, { count: 2 }], [B, { count: 1 }]]);
const fromList = (itemId) => ({ kind: DRAG_KIND.MAP, itemId, fromSlot: null });
const fromSlot = (itemId, i) => ({ kind: DRAG_KIND.MAP, itemId, fromSlot: i });

describe('carrying maps onto the slots', () => {
    it('a map from the list fills an empty slot or replaces what is there', () => {
        expect(dropOnSlot([null, null, null], fromList(A), 1, held)).toEqual([null, A, null]);
        expect(dropOnSlot([B, null, null], fromList(A), 0, held)).toEqual([A, null, null]);
    });

    it('never slots more copies than the Bank holds', () => {
        expect(dropOnSlot([A, A, null], fromList(A), 2, held)).toBeNull();
        expect(dropOnSlot([B, null, null], fromList(B), 2, held)).toBeNull();
        // Over its own copy it is no more copies than before.
        expect(dropOnSlot([A, A, null], fromList(A), 1, held)).toEqual([A, A, null]);
        expect(dropOnSlot([null, null], fromList('map_unheld'), 0, held)).toBeNull();
    });

    it('a map lifted from a slot moves to an empty one, or swaps with a full one', () => {
        expect(dropOnSlot([A, null, B], fromSlot(A, 0), 1, held)).toEqual([null, A, B]);
        expect(dropOnSlot([A, null, B], fromSlot(A, 0), 2, held)).toEqual([B, null, A]);
        const slots = [A, null, B];
        expect(dropOnSlot(slots, fromSlot(A, 0), 0, held)).toBe(slots);
    });

    it('refuses a stale lift and a slot that is not there', () => {
        expect(dropOnSlot([B, null], fromSlot(A, 0), 1, held)).toBeNull();
        expect(dropOnSlot([null, null], fromList(A), 2, held)).toBeNull();
        expect(dropOnSlot([null, null], fromList(A), -1, held)).toBeNull();
        expect(dropOnSlot([null, null], { kind: DRAG_KIND.MAP }, 0, held)).toBeNull();
    });

    it('carrying a map off the slots empties its slot, if it still holds that map', () => {
        expect(liftFromSlot([A, B], 1, B)).toEqual([A, null]);
        const slots = [A, B];
        expect(liftFromSlot(slots, 1, A)).toBe(slots);
        expect(liftFromSlot([A, null], 1, null)).toEqual([A, null]);
    });
});

describe('the tome', () => {
    const TABS = [
        { id: 'cartography', label: 'Cartography', colour: '#700' },
        { id: 'regions', label: 'Regions', colour: '#007' }
    ];
    const tome = (tab = 'regions', onTab = vi.fn()) => render(React.createElement(
        AtlasTome, { tabs: TABS, tab, onTab, label: 'Atlas' },
        React.createElement(TomeSpread, { left: React.createElement('p', null, 'L'), right: React.createElement('p', null, 'R') })
    ));
    const reduceMotion = (on) => {
        window.matchMedia = vi.fn(() => ({ matches: on, addEventListener() {}, removeEventListener() {} }));
    };

    afterEach(() => {
        cleanup();
        delete window.matchMedia;
    });

    it('has a ribbon per section in page order, the open one selected', () => {
        const { container } = tome();
        const ribbons = [...container.querySelectorAll('[role="tab"]')];
        expect(ribbons.map(r => r.getAttribute('data-atlas-tab'))).toEqual(['cartography', 'regions']);
        expect(ribbons.map(r => r.getAttribute('aria-selected'))).toEqual(['false', 'true']);
        expect(container.querySelector('[data-tome-left]').textContent).toBe('L');
        expect(container.querySelector('[data-tome-right]').textContent).toBe('R');
    });

    it('turns the page back to an earlier section and forward to a later one', () => {
        reduceMotion(false);
        const onTab = vi.fn();
        const { container, rerender } = tome('regions', onTab);
        expect(container.querySelector('[data-page-turn]')).toBeNull();
        fireEvent.click(container.querySelector('[data-atlas-tab="cartography"]'));
        expect(onTab).toHaveBeenCalledWith('cartography');
        expect(container.querySelector('[data-page-turn]').getAttribute('data-page-turn')).toBe('back');
        rerender(React.createElement(AtlasTome, { tabs: TABS, tab: 'cartography', onTab, label: 'Atlas' }));
        fireEvent.click(container.querySelector('[data-atlas-tab="regions"]'));
        expect(container.querySelector('[data-page-turn]').getAttribute('data-page-turn')).toBe('forward');
    });

    it('does not turn the page for the open section, nor under reduced motion', () => {
        reduceMotion(false);
        const onTab = vi.fn();
        const { container } = tome('regions', onTab);
        fireEvent.click(container.querySelector('[data-atlas-tab="regions"]'));
        expect(onTab).not.toHaveBeenCalled();
        expect(container.querySelector('[data-page-turn]')).toBeNull();
        cleanup();

        reduceMotion(true);
        const second = tome('regions', onTab);
        fireEvent.click(second.container.querySelector('[data-atlas-tab="cartography"]'));
        expect(onTab).toHaveBeenCalledWith('cartography');
        expect(second.container.querySelector('[data-page-turn]')).toBeNull();
    });
});

describe('the owner book', () => {
    afterEach(() => {
        cleanup();
        act(() => setTomeScale(DEFAULT_TOME_SCALE));
    });
    const mount = () => render(React.createElement(AtlasTome, { tabs: [], tab: null, onTab: vi.fn(), label: 'Atlas' }));

    it('is the owner left and right pages side by side at a whole 2×, 3× or 4×, 2× by default', () => {
        expect(TOME_SCALES).toEqual([2, 3, 4]);
        expect(getTomeScale()).toBe(2);
        for (const scale of TOME_SCALES) {
            act(() => setTomeScale(scale));
            const { container } = mount();
            const screen = container.querySelector('[data-atlas-screen]');
            expect(screen.getAttribute('data-tome-scale')).toBe(String(scale));
            expect([screen.style.width, screen.style.height]).toEqual([`${512 * scale}px`, `${256 * scale}px`]);
            const left = container.querySelector('[data-tome-page="left"]');
            const right = container.querySelector('[data-tome-page="right"]');
            expect(left.getAttribute('src')).toBe(TOME_ART.left);
            expect(right.getAttribute('src')).toBe(TOME_ART.right);
            for (const img of [left, right]) {
                expect([img.style.width, img.style.imageRendering, img.style.transform]).toEqual([`${256 * scale}px`, 'pixelated', '']);
            }
            expect([left.style.left, right.style.left]).toEqual(['0px', `${256 * scale}px`]);
            cleanup();
        }
        act(() => setTomeScale(5));
        expect(getTomeScale()).toBe(4);
    });

    it('lays each page panels inside its own parchment', () => {
        for (const scale of TOME_SCALES) {
            const { left, right } = pageRects(scale);
            expect(left).toEqual({ left: PARCHMENT_ART.left.x0 * scale, top: PARCHMENT_ART.left.y0 * scale, width: (PARCHMENT_ART.left.x1 - PARCHMENT_ART.left.x0) * scale, height: (PARCHMENT_ART.left.y1 - PARCHMENT_ART.left.y0) * scale });
            expect(right.left).toBe((256 + PARCHMENT_ART.right.x0) * scale);
            expect(left.left + left.width).toBeLessThanOrEqual(256 * scale);
            expect(right.left + right.width).toBeLessThanOrEqual(512 * scale);
        }
    });

    it('a book bigger than its room is centred and cropped, and the panels keep to the parchment on screen', () => {
        // 4× in a 1450 × 850 mat column: 2048 × 1024, cropped on every side.
        const book = placeBook(4, 1450, 850);
        expect([book.left, book.top]).toEqual([-299, -87]);
        expect(book.visible).toEqual({ left: 299, top: 87, width: 1450, height: 850 });
        const { left, right } = pageRects(4, book.visible);
        for (const r of [left, right]) {
            expect(r.left).toBeGreaterThanOrEqual(299 + 8);
            expect(r.left + r.width).toBeLessThanOrEqual(299 + 1450 - 8);
            expect(r.top).toBeGreaterThanOrEqual(87 + 8);
            expect(r.top + r.height).toBeLessThanOrEqual(87 + 850 - 8);
            expect(r.width).toBeGreaterThan(300);
        }
        // 2× fits with its ribbons: centred, nothing cut.
        const small = placeBook(2, 1450, 850);
        expect(small.visible).toEqual({ left: 0, top: 0, width: 1024, height: 512 });
        expect(pageRects(2, small.visible).left).toEqual(pageRects(2).left);
        expect(spreadSize(3)).toEqual({ w: 1536, h: 768 });
        // The ribbons stand above the book while there is screen above it, else lie on its top.
        expect(ribbonsTucked(placeBook(2, 1128, 720), 2)).toBe(true);
        expect(ribbonsTucked(placeBook(3, 1448, 900), 3)).toBe(true);
        expect(ribbonsTucked(placeBook(4, 1448, 900), 4)).toBe(false);
    });
});

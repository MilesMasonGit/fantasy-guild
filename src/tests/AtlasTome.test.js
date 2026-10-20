// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { AtlasTome, TomeSpread } from '../ui/components/atlas/AtlasTome.jsx';
import { dropOnSlot, liftFromSlot } from '../ui/components/atlas/CartographyTable.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { TOME_ART, TOME_SCALE, PAGE_PX, SPREAD_W, SPREAD_H, PARCHMENT_ART, parchmentRects } from '../ui/components/atlas/tomeArt.js';

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
    afterEach(cleanup);

    it('is the page sprite at exactly 4×, the left page its mirror, spine to spine', () => {
        expect(TOME_SCALE).toBe(4);
        expect([PAGE_PX, SPREAD_W, SPREAD_H]).toEqual([512, 1024, 512]);
        const { container } = render(React.createElement(AtlasTome, { tabs: [], tab: null, onTab: vi.fn(), label: 'Atlas' }));
        const screen = container.querySelector('[data-atlas-screen]');
        expect([screen.style.width, screen.style.height]).toEqual(['1024px', '512px']);
        const left = container.querySelector('[data-tome-page="left"]');
        const right = container.querySelector('[data-tome-page="right"]');
        for (const img of [left, right]) {
            expect(img.getAttribute('src')).toBe(TOME_ART.page);
            expect([img.style.width, img.style.height, img.style.imageRendering]).toEqual(['512px', '512px', 'pixelated']);
        }
        expect(left.style.transform).toBe('scaleX(-1)');
        expect([left.style.left, right.style.left]).toEqual(['0px', '512px']);
        expect(right.style.transform).toBe('');
    });

    it('lays each page panels inside its parchment, mirrored about the spine', () => {
        const { left, right } = parchmentRects();
        expect(right.left).toBe(PAGE_PX + PARCHMENT_ART.x0 * 4);
        expect(left.left + left.width).toBe(PAGE_PX - PARCHMENT_ART.x0 * 4);
        expect(left.width).toBe(right.width);
        expect(right.left + right.width).toBeLessThanOrEqual(SPREAD_W);
        expect(left.left).toBeGreaterThanOrEqual(0);
        expect(left.top + left.height).toBeLessThanOrEqual(SPREAD_H);
        const { container } = render(React.createElement(TomeSpread, { left: 'L', right: 'R' }));
        const page = container.querySelector('[data-tome-right]');
        expect([page.style.left, page.style.top, page.style.width]).toEqual([`${right.left}px`, `${right.top}px`, `${right.width}px`]);
    });
});

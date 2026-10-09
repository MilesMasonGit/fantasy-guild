// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DeckDndProvider, DropTarget, useEntityDrag, measureDropTarget } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';

/**
 * ⭐ **Following the pointer reads no layout.** dnd-kit's own drop-target boxes re-read the
 * scroll position of every scrolling box around them each time a side is asked for, and the
 * target under the pointer is worked out on every pointer move and on every render of the drag
 * system: hundreds of `scrollTop` reads per pickup, each able to force the page's layout. The
 * drag now measures a target's scrolling boxes when it measures the target, and follows their
 * scrolling from their scroll events, so a target inside a box scrolled mid-drag is still found
 * where it is drawn.
 */

const h = React.createElement;
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
const ptr = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0 });

function Source() {
    const d = useEntityDrag({ id: 'src', kind: DRAG_KIND.ITEM, payload: { itemId: 'item_coal' } });
    return h('div', { ref: d.setNodeRef, ...d.handleProps, 'data-testid': 'src' });
}

let reads;
const originals = {};
beforeEach(() => {
    reads = 0;
    for (const key of ['scrollTop', 'scrollLeft']) {
        const desc = Object.getOwnPropertyDescriptor(Element.prototype, key);
        originals[key] = desc;
        Object.defineProperty(Element.prototype, key, {
            configurable: true,
            get() { reads++; return desc.get.call(this); },
            set(v) { desc.set.call(this, v); }
        });
    }
});
afterEach(async () => {
    for (const key of ['scrollTop', 'scrollLeft']) Object.defineProperty(Element.prototype, key, originals[key]);
    await new Promise(r => setTimeout(r, 80));
    cleanup();
    document.body.classList.remove('gi-dnd-active');
});

function scene() {
    const onInside = vi.fn();
    const onOutside = vi.fn();
    const view = render(
        h(DeckDndProvider, null,
            h(Source),
            h('div', { 'data-testid': 'scroller', style: { overflow: 'auto' } },
                h(DropTarget, { id: 'inside', accepts: () => true, onDrop: onInside, 'data-testid': 'inside' })),
            h(DropTarget, { id: 'outside', accepts: () => true, onDrop: onOutside, 'data-testid': 'outside' }))
    );
    view.getByTestId('src').getBoundingClientRect = () => box(0, 0, 50, 50);
    view.getByTestId('scroller').getBoundingClientRect = () => box(400, 100, 400, 800);
    view.getByTestId('inside').getBoundingClientRect = () => box(500, 700, 100, 100);
    view.getByTestId('outside').getBoundingClientRect = () => box(1000, 200, 100, 100);
    act(() => {
        fireEvent.pointerDown(view.getByTestId('src'), ptr(25, 25));
        fireEvent.pointerMove(document, ptr(60, 25));
    });
    expect(document.body.classList.contains('gi-dnd-active')).toBe(true);
    return { onInside, onOutside, ...view };
}

describe('⭐ carrying something reads no scroll position', () => {
    it('moving about over a drop target reads no scroll position, not even the page\'s own', () => {
        // As in a browser: every box's scrolling boxes end with the page's own.
        Object.defineProperty(document, 'scrollingElement', { configurable: true, get: () => document.documentElement });
        try {
            const { onOutside } = scene();
            // Onto the target outside the scrolling box: the drag looks up what scrolls around it.
            act(() => { fireEvent.pointerMove(document, ptr(1050, 250)); });
            reads = 0;
            for (const [x, y] of [[1080, 260], [1020, 230], [1150, 250], [1050, 250]]) {
                act(() => { fireEvent.pointerMove(document, ptr(x, y)); });
            }
            expect(reads).toBe(0);
            act(() => { fireEvent.pointerUp(document, ptr(1050, 250)); });
            expect(onOutside).toHaveBeenCalledTimes(1);
        } finally {
            delete document.scrollingElement;
        }
    });
});

// The target is measured at 700 to 800 down the screen. Both scrolls move it further than the
// 240 px a near miss still reaches, so only the right answer passes.
describe('⭐ a drop target in a box scrolled mid-drag is found where it is drawn', () => {
    it('scrolled 400 px: the target is hit at its new place', () => {
        const { getByTestId, onInside } = scene();
        act(() => {
            getByTestId('scroller').scrollTop = 400;
            fireEvent.scroll(getByTestId('scroller'));
        });
        // Drawn 400 px higher now: 300 to 400 down the screen.
        act(() => { fireEvent.pointerMove(document, ptr(550, 350)); });
        act(() => { fireEvent.pointerUp(document, ptr(550, 350)); });
        expect(onInside).toHaveBeenCalledTimes(1);
    });

    it('scrolled 600 px: where the target used to be is no longer the target', () => {
        const { getByTestId, onInside } = scene();
        act(() => {
            getByTestId('scroller').scrollTop = 600;
            fireEvent.scroll(getByTestId('scroller'));
        });
        act(() => { fireEvent.pointerMove(document, ptr(550, 750)); });
        act(() => { fireEvent.pointerUp(document, ptr(550, 750)); });
        expect(onInside).not.toHaveBeenCalled();
    });
});

describe('⭐ measuring a drop target reads only its own box', () => {
    it('no scroll position and no style of the boxes around it, however deep it sits', () => {
        const outer = document.createElement('div');
        outer.style.overflow = 'auto';
        let node = outer;
        for (let i = 0; i < 6; i++) {
            const child = document.createElement('div');
            node.appendChild(child);
            node = child;
        }
        document.body.appendChild(outer);
        node.getBoundingClientRect = () => box(10, 20, 30, 40);
        const realStyle = window.getComputedStyle;
        let styles = 0;
        window.getComputedStyle = (...args) => { styles++; return realStyle(...args); };
        try {
            reads = 0;
            const r = measureDropTarget(node);
            expect(r).toMatchObject({ left: 10, top: 20, width: 30, height: 40 });
            expect(reads).toBe(0);
            // Its own style, for a transform to ignore; none of the six boxes around it.
            expect(styles).toBe(1);
        } finally {
            window.getComputedStyle = realStyle;
            outer.remove();
        }
    });
});

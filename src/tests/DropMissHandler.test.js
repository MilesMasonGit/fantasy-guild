// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DeckDndProvider, DropTarget, useEntityDrag } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE, DROP_REFUSED } from '../ui/dnd/dragConstants.js';

/**
 * ⭐ **The miss handler is for drops nothing took.** A source's `onMiss` (the Guild Hall's
 * "cannot be removed from the playmat") answers a drop let go where no target takes it; a target
 * that took the drop and refused it (the mat, finding no spot) has already said its own reason.
 */

const h = React.createElement;
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
const ptr = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0 });

function Source({ payload = { itemId: 'item_coal' } }) {
    const d = useEntityDrag({ id: 'src', kind: DRAG_KIND.ITEM, payload });
    return h('div', { ref: d.setNodeRef, ...d.handleProps, 'data-testid': 'src' });
}

const target = (id, spies, props = {}, ...children) => {
    spies[id] = vi.fn();
    return h(DropTarget, { id, surface: DND_SURFACE.DRAWER, accepts: () => true, onDrop: spies[id], 'data-testid': id, ...props }, ...children);
};

/** Lay each element out at its box, pick the source up and carry it a step. */
function pickUp(view, boxes) {
    view.getByTestId('src').getBoundingClientRect = () => box(0, 0, 50, 50);
    for (const [id, b] of Object.entries(boxes)) view.getByTestId(id).getBoundingClientRect = () => b;
    act(() => {
        fireEvent.pointerDown(view.getByTestId('src'), ptr(25, 25));
        fireEvent.pointerMove(document, ptr(60, 25));
    });
}

function release(x, y) {
    act(() => { fireEvent.pointerMove(document, ptr(x, y)); });
    act(() => { fireEvent.pointerMove(document, ptr(x + 1, y)); });
    act(() => { fireEvent.pointerUp(document, ptr(x + 1, y)); });
}

afterEach(async () => {
    await new Promise(r => setTimeout(r, 80));
    cleanup();
    document.body.classList.remove('gi-dnd-active');
});

describe('⭐ the miss handler is for drops nothing took', () => {
    function missScene() {
        const spies = { onMiss: vi.fn(() => null) };
        const view = render(
            h(DeckDndProvider, null,
                h(Source, { payload: { itemId: 'item_coal', onMiss: spies.onMiss } }),
                target('mat', spies, { onDrop: () => DROP_REFUSED }),
                target('fussy', spies, { accepts: () => false }))
        );
        pickUp(view, { mat: box(100, 100, 400, 400), fussy: box(700, 100, 100, 100) });
        return spies;
    }

    it('refused by the mat, which said why: no second reason', () => {
        const spies = missScene();
        release(300, 300);
        expect(spies.onMiss).not.toHaveBeenCalled();
    });

    it('let go where no target is: the miss handler says why', () => {
        const spies = missScene();
        release(1500, 900);
        expect(spies.onMiss).toHaveBeenCalledTimes(1);
    });

    it('over a target that does not take it: a miss too', () => {
        const spies = missScene();
        release(750, 150);
        expect(spies.onMiss).toHaveBeenCalledTimes(1);
    });
});

describe('⭐ a target that refuses without a word is a plain miss', () => {
    it('its onDrop answers false: the miss handler says why', () => {
        const spies = { onMiss: vi.fn(() => null) };
        const view = render(
            h(DeckDndProvider, null,
                h(Source, { payload: { itemId: 'item_coal', onMiss: spies.onMiss } }),
                target('beside', spies, { onDrop: () => false }))
        );
        pickUp(view, { beside: box(100, 100, 400, 400) });
        release(300, 300);
        expect(spies.onMiss).toHaveBeenCalledTimes(1);
    });
});

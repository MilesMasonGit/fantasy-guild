// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DeckDndProvider, DropTarget, useEntityDrag } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../ui/dnd/dragConstants.js';

/**
 * ⭐ **A drop lands where it looks.** dnd-kit's boxes know nothing of clipping or of what is drawn
 * over them, so a Bank tile scrolled out of its list, or covered by the Hero drawer, still had a box,
 * and being small it took drops meant for the hero bar or the drawer. A target inside a scrolling
 * list (`data-scroll-list`) is no target where the pointer is outside the list's visible box, and
 * one under a cover drawn over it (`data-dnd-cover`, ranked by its z-index against the
 * `data-dnd-layer` a target sits in) is none where the cover is.
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

/**
 * The Bank: a list 400 px tall holding a tile drawn below its visible foot, over the hero bar's
 * strip. The tile (90 x 90) is smaller than the bar's hero (160 x 64), so by area it would win.
 */
function bankScene() {
    const spies = {};
    const view = render(
        h(DeckDndProvider, null,
            h(Source),
            target('list', spies, { 'data-scroll-list': '' },
                target('shown', spies),
                target('hidden', spies)),
            target('hero', spies))
    );
    pickUp(view, {
        list: box(100, 100, 600, 400),
        shown: box(120, 120, 90, 90),
        hidden: box(120, 520, 90, 90),
        hero: box(100, 510, 160, 64)
    });
    return { spies, view };
}

describe('⭐ a tile scrolled out of its list takes no drop', () => {
    it('released over the hero bar, where a hidden tile lies, the hero takes it', () => {
        const { spies } = bankScene();
        release(150, 550);
        expect(spies.hidden).not.toHaveBeenCalled();
        expect(spies.hero).toHaveBeenCalledTimes(1);
    });

    it('released where only the hidden tile is, nothing near by takes it either', () => {
        const spies = {};
        const view = render(
            h(DeckDndProvider, null,
                h(Source),
                target('list', spies, { 'data-scroll-list': '' }, target('hidden', spies)))
        );
        pickUp(view, { list: box(100, 100, 600, 400), hidden: box(120, 520, 90, 90) });
        release(150, 560);
        expect(spies.hidden).not.toHaveBeenCalled();
        // 50 px below the list: the list's own target is the nearest, within reach, and visible.
        expect(spies.list).toHaveBeenCalledTimes(1);
    });

    it('a tile in sight still beats the list behind it', () => {
        const { spies } = bankScene();
        release(150, 150);
        expect(spies.shown).toHaveBeenCalledTimes(1);
        expect(spies.list).not.toHaveBeenCalled();
    });

    it('a tile scrolled into sight during the drag takes the drop where it is drawn', () => {
        const { spies, view } = bankScene();
        act(() => {
            view.getByTestId('list').scrollTop = 200;
            fireEvent.scroll(view.getByTestId('list'));
        });
        // The hidden tile is drawn 200 px higher now: 320 to 410, inside the list.
        release(150, 360);
        expect(spies.hidden).toHaveBeenCalledTimes(1);
    });
});

/**
 * The Hero drawer (z 100) risen over the Bank: its own target is its whole box; the hero bar
 * (z 105) is drawn over the drawer.
 */
function coverScene() {
    const spies = {};
    const view = render(
        h(DeckDndProvider, null,
            h(Source, { payload: { itemId: 'item_axe', fromHeroId: 'h1', fromSlot: 'mainHand' } }),
            target('list', spies, { 'data-scroll-list': '' }, target('tile', spies)),
            h('div', { 'data-dnd-cover': '', 'data-testid': 'drawer-box', style: { zIndex: 100 } },
                target('drawer', spies, { accepts: () => false }),
                target('slot', spies)),
            h('div', { 'data-dnd-layer': '', 'data-testid': 'bar-box', style: { zIndex: 105 } },
                target('hero', spies)))
    );
    pickUp(view, {
        list: box(0, 0, 800, 800),
        tile: box(100, 500, 100, 100),
        'drawer-box': box(0, 400, 800, 400),
        drawer: box(0, 400, 800, 400),
        slot: box(400, 500, 70, 70),
        'bar-box': box(0, 736, 800, 64),
        hero: box(80, 736, 160, 64)
    });
    return spies;
}

describe('⭐ a Bank tile under the Hero drawer takes no drop', () => {
    it('let go on the drawer over a covered tile, the drawer refuses it: a miss', () => {
        const spies = coverScene();
        release(150, 550);
        expect(spies.tile).not.toHaveBeenCalled();
        expect(spies.list).not.toHaveBeenCalled();
        expect(spies.drawer).not.toHaveBeenCalled();
    });

    it('the drawer\'s own slots still take a drop', () => {
        const spies = coverScene();
        release(430, 530);
        expect(spies.slot).toHaveBeenCalledTimes(1);
    });

    it('the hero bar, drawn over the drawer, still takes a drop', () => {
        const spies = coverScene();
        release(150, 760);
        expect(spies.hero).toHaveBeenCalledTimes(1);
    });

    it('the Bank in sight above the drawer still takes a drop', () => {
        const spies = coverScene();
        release(150, 200);
        expect(spies.list).toHaveBeenCalledTimes(1);
    });
});


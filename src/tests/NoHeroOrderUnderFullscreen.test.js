// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DeckDndProvider, DropTarget, useEntityDrag } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE, rosterFlagPayload, isRosterFlag } from '../ui/dnd/dragConstants.js';
import { matAccepts } from '../ui/components/board/Board.jsx';
import { setFullscreenViewOpen } from '../ui/hooks/useFullscreenViewLock.js';

/**
 * ⭐ **While a full-screen view is open, a hero dragged off the hero bar gets no order.** The
 * Encyclopedia lies over the mat, which stays mounted under it: a hero let go on the book is a
 * plain miss, not an order onto whatever is under that point. Reordering heroes on the hero bar
 * and dragging items onto a hero work as before.
 */

const h = React.createElement;
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
const ptr = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0 });

function Source({ kind, payload }) {
    const d = useEntityDrag({ id: 'src', kind, payload, sourceSurface: DND_SURFACE.DRAWER });
    return h('div', { ref: d.setNodeRef, ...d.handleProps, 'data-testid': 'src' });
}

/**
 * The mat (its real `accepts`) and a second hero on the hero bar (the bar's own rule: an item
 * equips, another roster hero reorders), with `kind`/`payload` in hand.
 */
function scene(kind, payload) {
    const onMat = vi.fn(() => ({ success: true }));
    const onBarHero = vi.fn();
    const view = render(
        h(DeckDndProvider, null,
            h(Source, { kind, payload }),
            h(DropTarget, { id: 'mat', surface: DND_SURFACE.BOARD, accepts: matAccepts, onDrop: onMat, 'data-testid': 'mat' }),
            h(DropTarget, {
                id: 'bar-hero', surface: DND_SURFACE.DRAWER,
                accepts: p => (p.kind === DRAG_KIND.ITEM && p.fromHeroId !== 'hero_2') || (isRosterFlag(p) && p.heroId !== 'hero_2'),
                onDrop: onBarHero, 'data-testid': 'bar-hero'
            }))
    );
    view.getByTestId('src').getBoundingClientRect = () => box(0, 900, 50, 50);
    view.getByTestId('mat').getBoundingClientRect = () => box(0, 0, 1400, 800);
    view.getByTestId('bar-hero').getBoundingClientRect = () => box(100, 900, 50, 50);
    act(() => {
        fireEvent.pointerDown(view.getByTestId('src'), ptr(25, 925));
        fireEvent.pointerMove(document, ptr(60, 925));
    });
    return { onMat, onBarHero };
}

function release(x, y) {
    act(() => { fireEvent.pointerMove(document, ptr(x, y)); });
    act(() => { fireEvent.pointerMove(document, ptr(x + 1, y)); });
    act(() => { fireEvent.pointerUp(document, ptr(x + 1, y)); });
}

afterEach(async () => {
    setFullscreenViewOpen(false);
    await new Promise(r => setTimeout(r, 80));
    cleanup();
    document.body.classList.remove('gi-dnd-active');
});

const hero = () => rosterFlagPayload('hero_1', 'Ada');
const item = () => ({ itemId: 'item_coal' });

describe('⭐ with a full-screen view open, a hero let go over it gets no order', () => {
    it('the Encyclopedia open: a hero dropped where the mat lies underneath is a plain miss', () => {
        setFullscreenViewOpen(true);
        const { onMat, onBarHero } = scene(DRAG_KIND.FLAG, hero());
        release(700, 400);
        expect(onMat).not.toHaveBeenCalled();
        expect(onBarHero).not.toHaveBeenCalled();
    });

    it('with the view closed the same drop gives the order, as before', () => {
        const { onMat } = scene(DRAG_KIND.FLAG, hero());
        release(700, 400);
        expect(onMat).toHaveBeenCalledTimes(1);
    });

    it('a hero on the mat (its flag) and a hero from the Hero drawer are refused too', () => {
        setFullscreenViewOpen(true);
        expect(matAccepts({ kind: DRAG_KIND.FLAG, heroId: 'hero_1' })).toBe(false);
        expect(matAccepts(rosterFlagPayload('hero_1', 'Ada', { dock: true, inspection: true }))).toBe(false);
        setFullscreenViewOpen(false);
        expect(matAccepts({ kind: DRAG_KIND.FLAG, heroId: 'hero_1' })).toBe(true);
    });

    it('a Token is not a hero: the mat takes it as before', () => {
        setFullscreenViewOpen(true);
        expect(matAccepts({ kind: DRAG_KIND.TOKEN, typeId: 'x', from: { instanceId: 't1' } })).toBe(true);
    });
});

describe('⭐ with a full-screen view open, the hero bar works as always', () => {
    it('a hero dropped on another hero on the bar reorders', () => {
        setFullscreenViewOpen(true);
        const { onMat, onBarHero } = scene(DRAG_KIND.FLAG, hero());
        release(125, 925);
        expect(onBarHero).toHaveBeenCalledTimes(1);
        expect(onMat).not.toHaveBeenCalled();
    });

    it('an item dropped on a hero on the bar equips', () => {
        setFullscreenViewOpen(true);
        const { onBarHero } = scene(DRAG_KIND.ITEM, item());
        release(125, 925);
        expect(onBarHero).toHaveBeenCalledTimes(1);
        expect(onBarHero.mock.calls[0][0]).toMatchObject({ kind: DRAG_KIND.ITEM, itemId: 'item_coal' });
    });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DeckDndProvider, useEntityDrag } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';

/**
 * ⭐ A pickup starts where the thing is drawn. Enemies and heroes on the mat are placed by a
 * `transform` (from the mat's corner), every other Token by left/top. The carried ghost is laid
 * on the box the drag measured at its start and flies from there to the cursor, so a box measured
 * without its transform put an enemy's or a hero's ghost at the mat's corner and flew it in from
 * there.
 */

const h = React.createElement;
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
const ptr = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0 });

function Source({ style }) {
    const d = useEntityDrag({ id: 'src', kind: DRAG_KIND.FLAG, payload: { heroId: 'h1', name: 'Ann' } });
    return h('div', { ref: d.setNodeRef, ...d.handleProps, style, 'data-testid': 'src' });
}

afterEach(async () => {
    await new Promise(r => setTimeout(r, 80));
    cleanup();
    document.body.classList.remove('gi-dnd-active');
});

/** Where the carried ghost's box is laid at pickup, for a source drawn at (300, 200). */
function pickUp(style) {
    const view = render(h(DeckDndProvider, null, h(Source, { style })));
    // As a browser reports it: where the box is drawn, its transform included.
    view.getByTestId('src').getBoundingClientRect = () => box(300, 200, 64, 64);
    act(() => {
        fireEvent.pointerDown(view.getByTestId('src'), ptr(310, 210));
        fireEvent.pointerMove(document, ptr(350, 210));
    });
    expect(document.body.classList.contains('gi-dnd-active')).toBe(true);
    const ghost = document.querySelector('[data-pickup-flight]');
    expect(ghost).not.toBeNull();
    // dnd-kit's overlay: fixed, at the measured box's corner.
    let overlay = ghost.parentElement;
    while (overlay && overlay.style.position !== 'fixed') overlay = overlay.parentElement;
    expect(overlay).not.toBeNull();
    const at = { left: parseFloat(overlay.style.left), top: parseFloat(overlay.style.top) };
    act(() => { fireEvent.pointerUp(document, ptr(350, 210)); });
    return at;
}

describe('⭐ picking up starts where the thing is drawn', () => {
    it('a box placed by a transform (an enemy, a hero on the mat): the ghost is laid on it, not on the mat corner', () => {
        // How a browser reports `translate(300px, 200px)` once computed.
        const at = pickUp({ position: 'absolute', left: 0, top: 0, transform: 'matrix(1, 0, 0, 1, 300, 200)', transformOrigin: '32px 32px' });
        expect(at).toEqual({ left: 300, top: 200 });
    });

    it('a box placed by left/top (any other Token, a flag): as before', () => {
        const at = pickUp({ position: 'absolute', left: 300, top: 200 });
        expect(at).toEqual({ left: 300, top: 200 });
    });
});

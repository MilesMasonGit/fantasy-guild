// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DeckDndContext } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { matW } from '../config/matGeometry.js';
import { lineCells, dashedLinePath, DASH_PX, GAP_PX } from '../ui/components/board/orderLine.js';

vi.mock('../systems/board/HeroMotion.js', () => ({
    heroPointOf: (heroId) => (heroId === 'h1' ? { x: 100, y: 100 } : null)
}));

const { OrderDragLine } = await import('../ui/components/board/OrderDragLine.jsx');

/**
 * ⭐ While a hero is carried to a new job, a dashed pixel line runs from where they stand on the
 * mat to the point they would be sent to, its dashes marching towards that point. Nothing at rest.
 */

const h = React.createElement;
afterEach(() => cleanup());

/** The lit cells of a path from `dashedLinePath`, as "x,y" strings. */
function litCells(d) {
    const out = new Set();
    for (const m of d.matchAll(/M(-?\d+) (-?\d+)h(\d+)v1h-\d+z/g)) {
        const [x, y, len] = [Number(m[1]), Number(m[2]), Number(m[3])];
        for (let i = 0; i < len; i++) out.add(`${x + i},${y}`);
    }
    return out;
}

describe('the dashed line’s cells', () => {
    it('is one pixel thick and 8-connected from the hero to the flag', () => {
        const cells = lineCells({ x: 0, y: 0 }, { x: 17, y: -6 });
        expect(cells[0]).toEqual([0, 0]);
        expect(cells.at(-1)).toEqual([17, -6]);
        for (let i = 1; i < cells.length; i++) {
            expect(Math.max(Math.abs(cells[i][0] - cells[i - 1][0]), Math.abs(cells[i][1] - cells[i - 1][1]))).toBe(1);
        }
        expect(cells).toHaveLength(18);
    });

    it('lights three on, three off, and a growing phase marches the dashes towards the flag', () => {
        const a = { x: 0, y: 0 }, b = { x: 30, y: 0 };
        const at0 = litCells(dashedLinePath(a, b, 0));
        expect([...at0].slice(0, DASH_PX)).toEqual(['0,0', '1,0', '2,0']);
        expect(at0.has(`${DASH_PX},0`)).toBe(false);
        expect(at0.size).toBe(Math.ceil(31 / (DASH_PX + GAP_PX)) * DASH_PX - 2);
        // One art pixel of march later, every dash is one cell further along, towards b.
        const at1 = litCells(dashedLinePath(a, b, 1));
        for (const c of at0) {
            const [x] = c.split(',').map(Number);
            if (x + 1 <= 30) expect(at1.has(`${x + 1},0`)).toBe(true);
        }
        // The same the other way round: still from a to b.
        const back = litCells(dashedLinePath(b, a, 0));
        expect(back.has('30,0')).toBe(true);
    });

    it('merges a dash’s cells along a row into one rectangle', () => {
        const d = dashedLinePath({ x: 0, y: 0 }, { x: 11, y: 0 }, 0);
        expect(d).toBe('M0 0h3v1h-3zM6 0h3v1h-3z');
    });
});

describe('on the mat', () => {
    const matEl = document.createElement('div');
    matEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: 600, right: matW(), bottom: 600 });
    const matRef = { current: matEl };
    const mount = (drag) => render(
        h(DeckDndContext.Provider, { value: drag }, h('div', null, h(OrderDragLine, { matRef })))
    );

    it('draws nothing at rest, nor while a Token is carried', () => {
        expect(mount({ isDragging: false, activePayload: null }).container.querySelector('svg')).toBeNull();
        cleanup();
        expect(mount({ isDragging: true, activePayload: { kind: DRAG_KIND.TOKEN, typeId: 'x' } }).container.querySelector('svg')).toBeNull();
    });

    it.each([DRAG_KIND.HERO, DRAG_KIND.FLAG])('while a hero is carried (%s), one svg whose dashes run from the hero to the pointer', async (kind) => {
        const { container } = mount({ isDragging: true, activePayload: { kind, heroId: 'h1' } });
        const svg = container.querySelector('svg[data-order-line="h1"]');
        expect(svg).toBeTruthy();
        expect(svg.getAttribute('class')).toContain('pointer-events-none');
        await act(async () => {
            window.dispatchEvent(new PointerEvent('pointermove', { clientX: 500, clientY: 300 }));
            await new Promise(r => setTimeout(r, 60));
        });
        const d = svg.querySelector('path:last-child').getAttribute('d');
        expect(d.length).toBeGreaterThan(0);
        expect(svg.querySelector('path:first-child').getAttribute('d')).toBe(d);
    });

    it('a hero with no figure on the mat draws no dashes', async () => {
        const { container } = mount({ isDragging: true, activePayload: { kind: DRAG_KIND.HERO, heroId: 'nobody' } });
        await act(async () => {
            window.dispatchEvent(new PointerEvent('pointermove', { clientX: 500, clientY: 300 }));
            await new Promise(r => setTimeout(r, 60));
        });
        expect(container.querySelector('svg path:last-child').getAttribute('d')).toBe('');
    });
});

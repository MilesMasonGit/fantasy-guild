// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import React, { Profiler } from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { Tooltip, tipPosition, TIP_OFFSET_X, TIP_OFFSET_Y, TIP_EDGE } from '../ui/components/base/Tooltip.jsx';

const h = React.createElement;
const VIEW_W = 1000;
const VIEW_H = 800;
const TIP_W = 200;
const TIP_H = 60;

/** jsdom has no layout: give every element the tooltip's size and the window a fixed size. */
function fakeLayout() {
    const saved = {
        w: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'),
        h: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight'),
        iw: window.innerWidth,
        ih: window.innerHeight
    };
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => TIP_W });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => TIP_H });
    window.innerWidth = VIEW_W;
    window.innerHeight = VIEW_H;
    return () => {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', saved.w);
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', saved.h);
        window.innerWidth = saved.iw;
        window.innerHeight = saved.ih;
    };
}

const tip = () => document.body.querySelector('[data-tooltip]');
const at = (x, y, extra = {}) => ({ clientX: x, clientY: y, pointerType: 'mouse', buttons: 0, ...extra });
/** The tooltip's top-left corner, read back from its transform. */
const corner = () => {
    const m = tip().style.transform.match(/translate3d\((-?\d+)px, (-?\d+)px/);
    return { left: Number(m[1]), top: Number(m[2]) };
};

describe('tipPosition', () => {
    it('sits below and right of the pointer, clear of the cursor', () => {
        expect(tipPosition(100, 100, TIP_W, TIP_H, VIEW_W, VIEW_H)).toEqual({ left: 100 + TIP_OFFSET_X, top: 100 + TIP_OFFSET_Y });
    });

    it('flips to the left of the pointer near the right edge', () => {
        const p = tipPosition(VIEW_W - 50, 100, TIP_W, TIP_H, VIEW_W, VIEW_H);
        expect(p.left).toBe(VIEW_W - 50 - TIP_OFFSET_X - TIP_W);
        expect(p.left + TIP_W).toBeLessThan(VIEW_W - 50);
        expect(p.top).toBe(100 + TIP_OFFSET_Y);
    });

    it('flips above the pointer near the bottom edge', () => {
        const p = tipPosition(100, VIEW_H - 20, TIP_W, TIP_H, VIEW_W, VIEW_H);
        expect(p.top).toBe(VIEW_H - 20 - TIP_OFFSET_Y - TIP_H);
        expect(p.top + TIP_H).toBeLessThan(VIEW_H - 20);
        expect(p.left).toBe(100 + TIP_OFFSET_X);
    });

    it('never leaves the window, even when it fits on neither side', () => {
        const p = tipPosition(5, 5, VIEW_W, TIP_H, VIEW_W, VIEW_H);
        expect(p.left).toBe(TIP_EDGE);
        expect(p.top).toBe(5 + TIP_OFFSET_Y);
    });
});

/** ⭐ The shared tooltip shows on hover, follows the pointer, flips at the edges and hides on leave. */
describe('Tooltip', () => {
    let restore;
    beforeEach(() => { restore = fakeLayout(); });
    afterEach(() => { cleanup(); restore(); });

    function mount(props = {}) {
        const renders = { panel: 0 };
        const onRender = () => { renders.panel++; };
        const view = render(
            h(Profiler, { id: 'panel', onRender },
                h('div', null,
                    h(Tooltip, { title: 'Oak Wood', lines: ['×45', 'Drag to sort'], ...props },
                        h('button', { 'data-target': true }, 'Oak')
                    )
                )
            )
        );
        return { view, target: view.container.querySelector('[data-target]'), renders };
    }

    it('shows on hover with its title and lines, and hides on leave', () => {
        const { target } = mount();
        expect(tip()).toBeNull();
        fireEvent.pointerEnter(target, at(100, 100));
        expect(tip()).not.toBeNull();
        expect(tip().textContent).toContain('Oak Wood');
        expect(tip().textContent).toContain('Drag to sort');
        expect(tip().getAttribute('role')).toBe('tooltip');
        expect(corner()).toEqual({ left: 100 + TIP_OFFSET_X, top: 100 + TIP_OFFSET_Y });
        fireEvent.pointerLeave(target, at(100, 100));
        expect(tip()).toBeNull();
    });

    it('follows the pointer without redrawing the panel under it', () => {
        const { target, renders } = mount();
        fireEvent.pointerEnter(target, at(100, 100));
        const before = renders.panel;
        fireEvent.pointerMove(target, at(300, 200));
        expect(corner()).toEqual({ left: 300 + TIP_OFFSET_X, top: 200 + TIP_OFFSET_Y });
        fireEvent.pointerMove(target, at(310, 210));
        expect(corner()).toEqual({ left: 310 + TIP_OFFSET_X, top: 210 + TIP_OFFSET_Y });
        expect(renders.panel).toBe(before);
    });

    it('flips left at the right edge and up at the bottom edge as the pointer moves there', () => {
        const { target } = mount();
        fireEvent.pointerEnter(target, at(100, 100));
        fireEvent.pointerMove(target, at(VIEW_W - 40, 100));
        expect(corner().left).toBe(VIEW_W - 40 - TIP_OFFSET_X - TIP_W);
        fireEvent.pointerMove(target, at(100, VIEW_H - 30));
        expect(corner()).toEqual({ left: 100 + TIP_OFFSET_X, top: VIEW_H - 30 - TIP_OFFSET_Y - TIP_H });
        fireEvent.pointerMove(target, at(VIEW_W - 40, VIEW_H - 30));
        expect(corner()).toEqual({ left: VIEW_W - 40 - TIP_OFFSET_X - TIP_W, top: VIEW_H - 30 - TIP_OFFSET_Y - TIP_H });
    });

    it('hides on a press and never shows while a button is held (a drag)', () => {
        const { target } = mount();
        fireEvent.pointerEnter(target, at(100, 100));
        fireEvent.pointerDown(target, at(100, 100, { buttons: 1 }));
        expect(tip()).toBeNull();
        fireEvent.pointerLeave(target, at(100, 100, { buttons: 1 }));
        fireEvent.pointerEnter(target, at(100, 100, { buttons: 1 }));
        expect(tip()).toBeNull();
    });

    it('keeps the child’s own pointer handlers', () => {
        const seen = [];
        const view = render(
            h(Tooltip, { lines: ['hi'] },
                h('span', { 'data-own': true, onPointerEnter: () => seen.push('enter'), onPointerDown: () => seen.push('down') }, 'x'))
        );
        const el = view.container.querySelector('[data-own]');
        fireEvent.pointerEnter(el, at(10, 10));
        fireEvent.pointerDown(el, at(10, 10, { buttons: 1 }));
        expect(seen).toEqual(['enter', 'down']);
    });

    it('shows nothing when it has nothing to say', () => {
        const { target } = mount({ title: undefined, lines: [undefined] });
        fireEvent.pointerEnter(target, at(100, 100));
        expect(tip()).toBeNull();
    });
});

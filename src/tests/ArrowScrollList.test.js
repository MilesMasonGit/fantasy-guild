// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { ArrowScrollList, HOLD_DELAY_MS, HOLD_REPEAT_MS } from '../ui/components/base/ArrowScrollList.jsx';

const h = React.createElement;
const STEP = 100;
const VIEW = 200;
const CONTENT = 1000;

/**
 * Mounts the list over a fake scroll box: jsdom has no layout, so the box's sizes are set by
 * hand and `scrollBy` lands instantly where a smooth scroll would end.
 */
function mount() {
    const view = render(h('div', null, h(ArrowScrollList, { step: STEP }, h('p', null, 'rows'))));
    const list = view.container.querySelector('[data-scroll-list]');
    let top = 0;
    Object.defineProperty(list, 'clientHeight', { value: VIEW, configurable: true });
    Object.defineProperty(list, 'scrollHeight', { value: CONTENT, configurable: true });
    Object.defineProperty(list, 'scrollTop', { get: () => top, set: v => { top = v; }, configurable: true });
    const calls = [];
    list.scrollBy = (o) => {
        calls.push(o);
        top = Math.min(CONTENT - VIEW, Math.max(0, top + o.top));
        list.dispatchEvent(new Event('scroll'));
    };
    act(() => { list.dispatchEvent(new Event('scroll')); });
    const up = view.container.querySelector('[data-scroll-arrow="up"]');
    const down = view.container.querySelector('[data-scroll-arrow="down"]');
    return { view, list, up, down, calls, top: () => top };
}

const press = (el) => fireEvent.pointerDown(el, { button: 0, pointerId: 1 });
const release = () => fireEvent.pointerUp(window, { button: 0, pointerId: 1 });

describe('ArrowScrollList', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => { cleanup(); vi.useRealTimers(); });

    it('has a bar above and below the list, each a pixel triangle, and no scrollbar', () => {
        const { list, up, down } = mount();
        expect(up.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(list.compareDocumentPosition(down) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(up.querySelector('[data-pixel-triangle="up"]')).not.toBeNull();
        expect(down.querySelector('[data-pixel-triangle="down"]')).not.toBeNull();
        expect(list.className).toContain('[scrollbar-width:none]');
        expect(list.className).toContain('overflow-y-auto');
    });

    it('dims the arrow at each end but keeps it in place', () => {
        const { list, up, down } = mount();
        expect(up.disabled).toBe(true);
        expect(down.disabled).toBe(false);
        list.scrollTop = CONTENT - VIEW;
        act(() => { list.dispatchEvent(new Event('scroll')); });
        expect(up.disabled).toBe(false);
        expect(down.disabled).toBe(true);
        expect(down.isConnected).toBe(true);
        expect(down.className).toContain('disabled:opacity-30');
    });

    it('a click scrolls one step smoothly', () => {
        const { down, up, calls, top } = mount();
        press(down);
        release();
        expect(calls).toEqual([{ top: STEP, behavior: 'smooth' }]);
        expect(top()).toBe(STEP);
        act(() => { vi.advanceTimersByTime(1000); });
        expect(calls.length).toBe(1);
        press(up);
        release();
        expect(top()).toBe(0);
    });

    it('a keyboard press (a click with no pointer) scrolls too', () => {
        const { down, top } = mount();
        fireEvent.click(down, { detail: 0 });
        expect(top()).toBe(STEP);
    });

    it('holding repeats until released', () => {
        const { down, calls } = mount();
        press(down);
        act(() => { vi.advanceTimersByTime(HOLD_DELAY_MS - 1); });
        expect(calls.length).toBe(1);
        act(() => { vi.advanceTimersByTime(1 + HOLD_REPEAT_MS * 3); });
        expect(calls.length).toBe(4);
        release();
        act(() => { vi.advanceTimersByTime(HOLD_REPEAT_MS * 5); });
        expect(calls.length).toBe(4);
    });

    it('holding stops by itself at the end', () => {
        const { down, calls, top } = mount();
        press(down);
        act(() => { vi.advanceTimersByTime(HOLD_DELAY_MS + HOLD_REPEAT_MS * 20); });
        expect(top()).toBe(CONTENT - VIEW);
        expect(down.disabled).toBe(true);
        expect(calls.length).toBe((CONTENT - VIEW) / STEP);
    });

    it('the mouse wheel is left to the browser, and the ends follow it', () => {
        const { list, up } = mount();
        const wheel = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
        list.dispatchEvent(wheel);
        expect(wheel.defaultPrevented).toBe(false);
        list.scrollTop = 120;
        act(() => { list.dispatchEvent(new Event('scroll')); });
        expect(up.disabled).toBe(false);
    });
});

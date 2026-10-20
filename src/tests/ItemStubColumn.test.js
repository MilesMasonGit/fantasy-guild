// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { ItemStubColumn } from '../ui/components/notifications/ItemStubColumn.jsx';
import * as ItemStubs from '../systems/notifications/itemStubs.js';

/**
 * The stub column's clicks and hover (owner, after the first eye-check): left-click pins or
 * unpins, pinned stubs sit under a "Pinned" header, right-click clears or resets and never opens
 * the browser's menu, and hover grows the same box into one line with no second panel.
 */

const h = React.createElement;
const stubEl = (view, id) => view.container.querySelector(`[data-item-stub="${id}"]`);

function flow(itemId, added, removed = 0) {
    act(() => {
        ItemStubs.recordFlow(itemId, { added, removed });
        ItemStubs.flush();
    });
}

beforeEach(() => ItemStubs.reset());
afterEach(() => {
    cleanup();
    ItemStubs.reset();
});

describe('left-click pins', () => {
    it('pins under a Pinned header, and a second click unpins', () => {
        flow('oak', 3);
        flow('stone', 2);
        const view = render(h(ItemStubColumn));
        expect(view.container.querySelector('[data-stubs-pinned-header]')).toBeNull();

        act(() => { fireEvent.click(stubEl(view, 'oak')); });
        const group = view.container.querySelector('[data-stubs-pinned]');
        expect(group.querySelector('[data-stubs-pinned-header]').textContent).toBe('Pinned');
        expect(group.querySelector('[data-item-stub="oak"]')?.getAttribute('data-stub-pinned')).toBe('true');
        expect(stubEl(view, 'oak').getAttribute('data-stub-net')).toBe('3');
        // Pinned, it shows the open line at rest: amount, sprite, name, rate.
        expect(stubEl(view, 'oak').querySelector('[data-stub-name]')).not.toBeNull();
        expect(stubEl(view, 'oak').querySelector('[data-stub-rate]').textContent).toMatch(/\/hr$/);
        expect(stubEl(view, 'stone').querySelector('[data-stub-name]')).toBeNull();

        act(() => { fireEvent.click(stubEl(view, 'oak')); });
        expect(view.container.querySelector('[data-stubs-pinned]')).toBeNull();
        expect(stubEl(view, 'oak').getAttribute('data-stub-pinned')).toBeNull();
        expect(stubEl(view, 'oak').querySelector('[data-stub-name]')).toBeNull();
    });

    it('every stub is as wide as its content: no fixed width, no fixed amount box', () => {
        flow('oak', 3);
        const view = render(h(ItemStubColumn));
        expect(stubEl(view, 'oak').style.width).toBe('');
        expect(view.container.querySelector('[data-item-stubs]').style.width).toBe('');
        expect([...stubEl(view, 'oak').querySelectorAll('span')].some(e => e.style.width)).toBe(false);
    });

    it('hovering a pinned stub opens nothing more: it is already open', () => {
        flow('oak', 3);
        const view = render(h(ItemStubColumn));
        act(() => { fireEvent.click(stubEl(view, 'oak')); });
        act(() => { fireEvent.mouseEnter(stubEl(view, 'oak')); });
        expect(view.container.querySelector('[data-stub-open]')).toBeNull();
    });

    it('has no pin or reset icon anywhere, open or at rest', () => {
        flow('oak', 3);
        const view = render(h(ItemStubColumn));
        act(() => { fireEvent.mouseEnter(stubEl(view, 'oak')); });
        expect(view.container.querySelector('[data-stub-open]')).not.toBeNull();
        expect(view.container.querySelectorAll('button:not([data-stubs-clear])')).toHaveLength(0);
        expect(view.container.querySelector('svg[aria-label="Pin"], svg[aria-label="Reset"]')).toBeNull();
    });
});

describe('right-click clears', () => {
    it('on an unpinned stub slides it out, and the browser menu stays shut', () => {
        flow('oak', 3);
        const view = render(h(ItemStubColumn));
        let shown;
        act(() => { shown = fireEvent.contextMenu(stubEl(view, 'oak')); });
        expect(shown).toBe(false);
        expect(stubEl(view, 'oak').getAttribute('data-stub-leaving')).toBe('true');
    });

    it('on a pinned stub resets it to +0 and keeps it pinned', () => {
        flow('oak', 3);
        const view = render(h(ItemStubColumn));
        act(() => { fireEvent.click(stubEl(view, 'oak')); });
        let shown;
        act(() => { shown = fireEvent.contextMenu(stubEl(view, 'oak')); });
        expect(shown).toBe(false);
        expect(stubEl(view, 'oak').getAttribute('data-stub-net')).toBe('0');
        expect(stubEl(view, 'oak').getAttribute('data-stub-pinned')).toBe('true');
        expect(stubEl(view, 'oak').textContent).toContain('+0');
    });
});

describe('hover', () => {
    it('grows one box with the amount, sprite, name and rate on one line; the column keeps its stubs', () => {
        flow('oak', 12);
        flow('stone', 2);
        const view = render(h(ItemStubColumn));
        const before = [...view.container.querySelectorAll('[data-item-stub]')].map(e => e.getAttribute('data-item-stub'));
        act(() => { fireEvent.mouseEnter(stubEl(view, 'oak')); });
        const open = view.container.querySelectorAll('[data-stub-open]');
        expect(open).toHaveLength(1);
        const box = open[0];
        expect(box.getAttribute('data-stub-open')).toBe('oak');
        expect(box.querySelector('[data-stub-name]')).not.toBeNull();
        expect(box.querySelector('[data-stub-rate]').textContent).toMatch(/^[+-][\d.,K]+\/hr$/);
        expect(box.textContent.startsWith('+12')).toBe(true);
        expect(box.textContent).not.toMatch(/gained|spent/);
        expect(view.container.querySelector('[data-stub-panel]')).toBeNull();
        const after = [...view.container.querySelectorAll('[data-item-stub]')].map(e => e.getAttribute('data-item-stub'));
        expect(after).toEqual(before);
    });

    it('a left-click on the open box pins its stub (which then stays open itself); a right-click on it clears and closes it', () => {
        flow('oak', 12);
        const view = render(h(ItemStubColumn));
        act(() => { fireEvent.mouseEnter(stubEl(view, 'oak')); });
        act(() => { fireEvent.click(view.container.querySelector('[data-stub-open]')); });
        expect(ItemStubs.getStub('oak').pinned).toBe(true);
        expect(view.container.querySelector('[data-stub-open]')).toBeNull();
        expect(stubEl(view, 'oak').querySelector('[data-stub-name]')).not.toBeNull();
        act(() => { fireEvent.click(stubEl(view, 'oak')); });
        act(() => { fireEvent.mouseEnter(stubEl(view, 'oak')); });
        act(() => { fireEvent.contextMenu(view.container.querySelector('[data-stub-open]')); });
        expect(ItemStubs.getStub('oak').leaving).toBe(true);
        expect(view.container.querySelector('[data-stub-open]')).toBeNull();
    });
});

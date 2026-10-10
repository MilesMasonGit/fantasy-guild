// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { GameState } from '../state/GameState.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { EngineContext } from '../ui/context/EngineContext';
import { DeckDndContext } from '../ui/dnd/DndKit.jsx';
import { NotificationsSidebar, PANEL_FADE_MS } from '../ui/components/board/PopOutSidebars.jsx';

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **The shut notification column costs nothing.** On the playmat the column is a slim tab; its
 * panel is invisible until hovered. Its toasts each had a backdrop blur (a composited layer
 * apiece), measured their layout on every redraw for their slide, and glowed by a JS animation,
 * all inside the invisible panel. While shut the toasts are not drawn at all; the tab's count
 * follows the queue, and opening shows the same toasts, already in place.
 */

const h = React.createElement;
const keep = { duration: 0 };

function mount() {
    return render(
        h(EngineContext.Provider, { value: { GameState, EventBus } },
            h(DndContext, null,
                h(DeckDndContext.Provider, { value: { activePayload: null, isDragging: false } },
                    h(NotificationsSidebar, { towardMat: 'left' }))))
    );
}

const side = (c) => c.querySelector('[data-sidebar="notifications"]');
const panel = (c) => side(c).querySelector('section');
const toasts = (c) => [...panel(c).querySelectorAll('[aria-label="Close notification"]')].map(b => b.parentElement);
const messages = (c) => toasts(c).map(t => t.querySelector('.truncate').textContent);
const count = (c) => side(c).querySelector('[data-sidebar-count]')?.textContent ?? null;
const open = (c) => act(() => { fireEvent.mouseEnter(side(c)); });
const close = async (c) => {
    act(() => { fireEvent.mouseLeave(side(c)); });
    await act(() => new Promise(r => setTimeout(r, PANEL_FADE_MS + 50)));
};

beforeEach(() => {
    GameState.initNew();
    NotificationSystem.dismissAll();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); NotificationSystem.dismissAll(); });

describe('while shut', () => {
    it('draws no toast: no backdrop blur, no animation class, nothing of the list', async () => {
        const { container } = mount();
        await act(async () => {
            NotificationSystem.info('one', keep);
            NotificationSystem.crisis('raid', keep);
        });
        expect(toasts(container)).toHaveLength(0);
        expect(panel(container).querySelector('[class*="backdrop-blur"]')).toBeNull();
        expect(panel(container).querySelector('[class*="animate-"]')).toBeNull();
    });

    it('measures no layout when notifications arrive or update', async () => {
        const { container } = mount();
        await act(async () => { NotificationSystem.info('Oak Wood', { ...keep, aggregationKey: 'item_oak', amount: 1 }); });
        await act(() => new Promise(r => setTimeout(r, 100)));
        const reads = vi.spyOn(Element.prototype, 'getBoundingClientRect');
        await act(async () => { NotificationSystem.info('Oak Wood', { ...keep, aggregationKey: 'item_oak', amount: 3 }); });
        await act(() => new Promise(r => setTimeout(r, 100)));
        await act(async () => { NotificationSystem.warning('two', keep); });
        await act(() => new Promise(r => setTimeout(r, 100)));
        expect(count(container)).toBe('2');
        expect(reads).not.toHaveBeenCalled();
    });

    it('the tab still counts what is waiting', async () => {
        const { container } = mount();
        expect(count(container)).toBeNull();
        await act(async () => { NotificationSystem.info('one', keep); NotificationSystem.warning('two', keep); });
        expect(count(container)).toBe('2');
        await act(async () => { NotificationSystem.dismissAll(); });
        expect(count(container)).toBeNull();
    });
});

describe('opening', () => {
    it('shows exactly the queue, newest first, as the engine holds it', async () => {
        const { container } = mount();
        await act(async () => {
            NotificationSystem.info('one', keep);
            NotificationSystem.warning('two', keep);
            NotificationSystem.success('three', keep);
        });
        open(container);
        expect(messages(container)).toEqual(NotificationSystem.getQueue().map(n => n.message));
        expect(messages(container)).toHaveLength(3);
        // Open, the toasts look as they always did.
        expect(toasts(container).every(t => t.className.includes('backdrop-blur-md'))).toBe(true);
    });

    it('a toast already waiting is shown in place; one arriving while open slides in', async () => {
        const { container } = mount();
        await act(async () => { NotificationSystem.info('waiting', keep); });
        open(container);
        const [waiting] = toasts(container);
        expect(waiting.style.opacity).toBe('1');
        await act(async () => { NotificationSystem.info('arriving', keep); });
        const arriving = toasts(container).find(t => t.textContent.includes('arriving'));
        expect(Number(arriving.style.opacity)).toBeLessThan(1);
    });

    it('closing puts the list away once the panel has faded, and reopening restores it', async () => {
        const { container } = mount();
        await act(async () => { NotificationSystem.info('one', keep); NotificationSystem.info('two', keep); });
        open(container);
        expect(toasts(container)).toHaveLength(2);
        act(() => { fireEvent.mouseLeave(side(container)); });
        // Still there while the panel fades out, so it does not collapse mid-fade.
        expect(toasts(container)).toHaveLength(2);
        await close(container);
        expect(toasts(container)).toHaveLength(0);
        await act(async () => { NotificationSystem.info('three', keep); });
        open(container);
        expect(messages(container)).toEqual(NotificationSystem.getQueue().map(n => n.message));
        expect(messages(container)).toHaveLength(3);
    });

    it('the Collapse choice survives the column closing', async () => {
        const { container } = mount();
        await act(async () => {
            NotificationSystem.info('one', keep);
            NotificationSystem.info('two', keep);
            NotificationSystem.crisis('raid', keep);
        });
        open(container);
        act(() => { fireEvent.click([...panel(container).querySelectorAll('button')].find(b => b.textContent === 'Collapse')); });
        await act(() => new Promise(r => setTimeout(r, 400)));
        expect(messages(container)).toEqual(['raid']);
        await close(container);
        open(container);
        expect(messages(container)).toEqual(['raid']);
        expect(panel(container).textContent).toContain('Show 2 More');
    });
});

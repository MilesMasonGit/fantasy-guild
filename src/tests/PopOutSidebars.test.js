// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { resetMatTuning } from '../config/matTuning.js';
import { EngineContext } from '../ui/context/EngineContext';
import { DeckDndContext } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { NotificationSidebars } from '../ui/components/board/PopOutSidebars.jsx';
import { NOTIFICATION_STRIP_PX, NOTIFICATION_COLUMN, columnWidthAt } from '../ui/components/board/boardConstants.js';

vi.mock('../ui/components/base/ToastContainer.jsx', () => ({
    default: () => React.createElement('i', { 'data-toasts': true })
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The Notifications sidebar: a slim tab on the screen edge that pops out over the mat on hover, so
 * the mat keeps the width the old column took. The discard bin's tab beside it is gone (Atlas A3b:
 * demolition replaced it).
 */

const h = React.createElement;

function tree({ activePayload = null, menuRight = false } = {}) {
    return (
        h(EngineContext.Provider, { value: { GameState, EventBus } },
            h(DndContext, null,
                h(DeckDndContext.Provider, { value: { activePayload, isDragging: !!activePayload } },
                    h(NotificationSidebars, { menuRight }))))
    );
}
const mount = (props) => render(tree(props));

const noteSidebar = (c) => c.querySelector('[data-sidebar="notifications"]');
const isOpen = (el) => el.getAttribute('data-open') === 'true';

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    resetMatTuning();
    NotificationSystem.clearAll?.();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('the strip', () => {
    it('reserves far less than the old column, so the mat grows into the rest', () => {
        expect(NOTIFICATION_STRIP_PX).toBeLessThan(columnWidthAt(1280, NOTIFICATION_COLUMN) / 4);
        const { container } = mount();
        expect(container.querySelector('aside').style.width).toBe(`${NOTIFICATION_STRIP_PX}px`);
    });

    it('holds the Notifications tab and no Bin tab; the toast list only while open', () => {
        const { container } = mount();
        expect(noteSidebar(container).textContent).toContain('Notifications');
        expect([...container.querySelectorAll('[data-sidebar]')].map(e => e.getAttribute('data-sidebar'))).toEqual(['notifications']);
        expect(container.textContent).not.toMatch(/\bBin\b/);
        expect(container.querySelector('[data-toasts]')).toBeNull();
        fireEvent.mouseEnter(noteSidebar(container));
        expect(container.querySelector('[data-toasts]')).not.toBeNull();
    });
});

describe('hover', () => {
    it('the notifications sidebar opens on hover and closes on leave', () => {
        const { container } = mount();
        const side = noteSidebar(container);
        expect(isOpen(side)).toBe(false);
        fireEvent.mouseEnter(side);
        expect(isOpen(side)).toBe(true);
        fireEvent.mouseLeave(side);
        expect(isOpen(side)).toBe(false);
    });

    it('a shut panel cannot be tabbed into or clicked (inert), an open one can', () => {
        const { container } = mount();
        const panel = noteSidebar(container).querySelector('section');
        expect(panel.hasAttribute('inert')).toBe(true);
        fireEvent.mouseEnter(noteSidebar(container));
        expect(panel.hasAttribute('inert')).toBe(false);
    });

    it('stays shut while something is dragged over it', () => {
        const { container } = mount({ activePayload: { kind: DRAG_KIND.TOKEN, typeId: 'fixture_producer', from: { instanceId: 'x' } } });
        fireEvent.mouseEnter(noteSidebar(container));
        expect(isOpen(noteSidebar(container))).toBe(false);
    });

    it('the tab counts the notifications waiting', async () => {
        const { container } = mount();
        expect(noteSidebar(container).querySelector('[data-sidebar-count]')).toBeNull();
        await act(async () => { NotificationSystem.info('one'); NotificationSystem.warning('two'); });
        expect(noteSidebar(container).querySelector('[data-sidebar-count]')?.textContent).toBe('2');
    });
});

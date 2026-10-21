// @vitest-environment jsdom
// ⚠️ First: it must be in place before React loads.
import { renders } from './fixtures/renderCounter.js';
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { EngineContext } from '../ui/context/EngineContext';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { Board } from '../ui/components/board/Board.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Picking up a hovered Token draws the mat once.** Nothing on the mat is hovered while a drag
 * is live. The hover used to be cleared by an effect after the drag started, a second commit of
 * the whole mat in the pickup (P2-9's largest single pickup commit). It is cleared in the render
 * that sees the drag start: one commit, the same result, and after the drop nothing is hovered
 * until the pointer moves again, as before.
 */

const h = React.createElement;
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
const ptr = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0 });

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });
beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    setLiveMatFit(1);
});
afterEach(async () => {
    renders.stop();
    // dnd-kit drops its after-drag click guard 50 ms after a drag ends.
    await new Promise(r => setTimeout(r, 80));
    cleanup();
    document.body.classList.remove('gi-dnd-active');
});

function scene() {
    GameState.state.heroes = [{
        id: 'h1', name: 'h1', spriteId: 'recruit', status: 'idle', level: 50,
        skills: { mining: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 }
    }];
    // Its cloth over A's circle is not where the pointer goes; its button is what yields.
    Flags.plant('h1', { x: 640, y: 380 });
    const a = placeAt('fixture_producer', 600, 400);
    const b = placeAt('fixture_producer', 1000, 500);
    const view = render(
        h(EngineContext.Provider, { value: { GameState, EventBus } },
            h(DeckDndProvider, null, h(Board, { onInspectToken: () => {}, onClearInspect: () => {} })))
    );
    view.container.querySelector('[data-board-origin]').getBoundingClientRect = () => box(0, 0, matW(), matH());
    view.container.querySelector('[data-mat-board]').getBoundingClientRect = () => box(0, 0, matW(), matH());
    return { a, b, ...view };
}
const artOf = (container, id) => container.querySelector(`[data-token-art][data-token-id="${id}"]`);
const flagYields = (container) => container.querySelector('button[data-flag="h1"]').className.includes('pointer-events-none');

describe('⭐ picking up a hovered Token draws the mat once', () => {
    it('the pickup: the mat renders in one commit, with nothing hovered and no flag yielding', () => {
        const { a, container } = scene();
        act(() => { fireEvent.pointerMove(container.querySelector('[data-mat-board]'), { clientX: 600, clientY: 400 }); });
        expect(artOf(container, a.id).getAttribute('data-outline')).toBe('hover');
        expect(flagYields(container)).toBe(true);

        renders.start();
        act(() => {
            fireEvent.pointerDown(container.querySelector(`[data-token-hit="${a.id}"]`), ptr(600, 400));
            fireEvent.pointerMove(document, ptr(630, 400));
        });
        renders.stop();
        expect(document.body.classList.contains('gi-dnd-active')).toBe(true);
        expect(artOf(container, a.id).getAttribute('data-outline')).not.toBe('hover');
        expect(flagYields(container)).toBe(false);
        expect(renders.commits().filter(c => c.has('MatBoard')).length).toBe(1);
        act(() => { fireEvent.pointerUp(document, ptr(630, 400)); });
    });

    it('after the drop nothing is hovered until the pointer moves on the mat again', async () => {
        const { a, b, container } = scene();
        act(() => { fireEvent.pointerMove(container.querySelector('[data-mat-board]'), { clientX: 1000, clientY: 500 }); });
        expect(artOf(container, b.id).getAttribute('data-outline')).toBe('hover');
        act(() => {
            fireEvent.pointerDown(container.querySelector(`[data-token-hit="${b.id}"]`), ptr(1000, 500));
            fireEvent.pointerMove(document, ptr(1030, 500));
        });
        act(() => { fireEvent.pointerMove(document, ptr(1100, 700)); });
        await act(async () => { fireEvent.pointerUp(document, ptr(1100, 700)); });
        expect(document.body.classList.contains('gi-dnd-active')).toBe(false);
        expect(artOf(container, b.id).getAttribute('data-outline')).not.toBe('hover');
        expect(artOf(container, a.id).getAttribute('data-outline')).not.toBe('hover');
        expect(flagYields(container)).toBe(false);

        act(() => { fireEvent.pointerMove(container.querySelector('[data-mat-board]'), { clientX: 600, clientY: 400 }); });
        expect(artOf(container, a.id).getAttribute('data-outline')).toBe('hover');
    });
});

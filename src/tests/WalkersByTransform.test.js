import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
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
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MatHero } from '../ui/components/board/MatHero.jsx';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import { TICK_INTERVAL_MS } from '../config/loopConstants.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import { drawnPoint } from './fixtures/drawnPoint.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Things that walk move by `transform`; things that stand use
 * `left`/`top`** (R6 rule 5).
 *
 * ⚠️ The style is chosen by **kind**, never by "walking right now": a box that
 * switched from `left`/`top` to a transform mid-life would slide in from the
 * mat's corner.
 */

const h = React.createElement;
const mount = (el) => render(
    h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el))
);
const translated = (el) => /translate\(\s*-?[\d.]+px,\s*-?[\d.]+px\)/.test(el.style.transform || '');

describe('⭐ a hero walks by transform', () => {
    afterEach(() => cleanup());

    it('is drawn at its point by a translate, from a 0,0 corner', () => {
        const { container } = mount(h(MatHero, { heroId: 'hw', name: 'W', left: 120, top: 340, z: 5 }));
        const el = container.querySelector('[data-board-hero="hw"]');
        expect(el.style.left).toBe('0px');
        expect(el.style.top).toBe('0px');
        expect(translated(el)).toBe(true);
        expect(drawnPoint(el)).toEqual({ x: 120, y: 340 });
    });

    it('glides one tick per step while moving, and not at all while standing', () => {
        const props = { heroId: 'hw', name: 'W', left: 120, top: 340, z: 5 };
        const { container, rerender } = mount(h(MatHero, { ...props, moving: true }));
        const el = container.querySelector('[data-board-hero="hw"]');
        expect(el.style.transition).toBe(`transform ${TICK_INTERVAL_MS}ms linear`);
        rerender(h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, h(MatHero, { ...props, moving: false }))));
        expect(el.style.transition).toBe('none');
        expect(translated(el)).toBe(true);    // the same style either way
    });
});

describe('⭐ speech bubbles follow by transform', () => {
    afterEach(() => cleanup());

    it('a stack is translated to its hero and keeps its own centring', () => {
        const heroes = [{ heroId: 'hb', state: 'idle', x: 400, y: 500, moving: true, tokenId: null, alert: null }];
        const { container } = mount(h(HeroBubbleLayer, { heroes }));
        act(() => { EventBus.publish('hero_leveled', { heroId: 'hb', skillName: 'Logging', newLevel: 5 }); });
        const stack = container.querySelector('[data-hero-bubble-stack="hb"]');
        expect(stack).not.toBeNull();
        expect(stack.style.left).toBe('0px');
        expect(stack.style.transform).toMatch(/^translate\(-?[\d.]+px, -?[\d.]+px\) translate\(-50%, -100%\)$/);
        expect(drawnPoint(stack).x).toBe(400);
        expect(stack.style.transition).toBe(`transform ${TICK_INTERVAL_MS}ms linear`);
    });
});

describe('⭐ on the mat: enemy Tokens walk by transform, every other Token stands on left/top', () => {
    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    afterEach(() => cleanup());

    beforeEach(() => {
        vi.clearAllMocks();
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        clearMat();
    });

    it('an enemy Token: both its boxes translated, at the same point as before', () => {
        const enemy = placeAt('fixture_enemy', 600, 500);
        const { container } = mount(h(MatBoard));
        const art = container.querySelector(`[data-token-id="${enemy.id}"][data-token-art]`);
        const overlay = container.querySelector(`[data-token-overlay="${enemy.id}"]`);
        const half = parseFloat(art.style.width) / 2;
        for (const el of [art, overlay]) {
            expect(el.style.left).toBe('0px');
            expect(translated(el)).toBe(true);
            expect(drawnPoint(el)).toEqual({ x: 600 - half, y: 500 - half });
            expect(el.style.transition).toMatch(/^transform /);
        }
    });

    it('any other Token: left/top, no translate', () => {
        const tok = placeAt('fixture_producer', 600, 500);
        const { container } = mount(h(MatBoard));
        const art = container.querySelector(`[data-token-id="${tok.id}"][data-token-art]`);
        const half = parseFloat(art.style.width) / 2;
        expect(art.style.left).toBe(`${600 - half}px`);
        expect(translated(art)).toBe(false);
        expect(art.style.transition).toMatch(/^left /);
    });
});

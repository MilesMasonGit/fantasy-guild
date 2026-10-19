// @vitest-environment jsdom
// ⚠️ First: it must be in place before React loads.
import { renders } from './fixtures/renderCounter.js';
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { EngineContext } from '../ui/context/EngineContext';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { HOVER_REST_MS } from '../ui/components/board/hoverRest.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Hover, in two steps** (docs/active/concept_info_layers.md, "Hover"). The white outline
 * comes at once; only after the pointer rests about 150 ms do the name, the charges ring and
 * (on a hero or an enemy) the HP bar come up. Sweeping the pointer across the mat mounts
 * nothing but outlines, and a rest redraws the rested Token alone.
 */

const h = React.createElement;
const mount = () => render(
    h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, h(MatBoard)))
);
const later = (ms) => act(() => { vi.advanceTimersByTime(ms); });
const overlay = (c, id) => c.querySelector(`[data-token-overlay="${id}"]`);
const art = (c, id) => c.querySelector(`[data-token-art][data-token-id="${id}"]`);
const nameOf = (c, id) => overlay(c, id).querySelector('[data-token-name]');
const chargesOf = (c, id) => c.querySelector(`[data-bubble="charges"][data-bubble-of="${id}"]`);

function matRoot(container) {
    const root = container.querySelector('[data-mat-board]');
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0 });
    return root;
}
const pointAt = (root, t) => fireEvent.pointerMove(root, { clientX: t.x, clientY: t.y });

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });
beforeEach(() => {
    vi.useFakeTimers();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [];
});
afterEach(() => {
    renders.stop();
    cleanup();
    vi.useRealTimers();
});

describe('⭐ resting on a Token', () => {
    it('the outline at once; nothing else before the rest; the name and the charges ring after', () => {
        const t = placeAt('fixture_producer', 600, 500);
        const { container } = mount();
        const root = matRoot(container);

        pointAt(root, t);
        expect(art(container, t.id).getAttribute('data-outline')).toBe('hover');
        expect(nameOf(container, t.id)).toBeNull();
        expect(chargesOf(container, t.id)).toBeNull();

        later(HOVER_REST_MS - 10);
        expect(nameOf(container, t.id)).toBeNull();
        expect(chargesOf(container, t.id)).toBeNull();

        later(10);
        expect(nameOf(container, t.id).textContent).toBe('Fixture Producer');
        expect(chargesOf(container, t.id)).not.toBeNull();
    });

    it('small moves on the same Token do not restart the wait', () => {
        const t = placeAt('fixture_producer', 600, 500);
        const { container } = mount();
        const root = matRoot(container);
        pointAt(root, t);
        later(HOVER_REST_MS / 2);
        fireEvent.pointerMove(root, { clientX: t.x + 3, clientY: t.y + 2 });
        later(HOVER_REST_MS / 2);
        expect(nameOf(container, t.id)).not.toBeNull();
    });

    it('leaving clears it at once, and coming back waits again', () => {
        const t = placeAt('fixture_producer', 600, 500);
        const { container } = mount();
        const root = matRoot(container);
        pointAt(root, t);
        later(HOVER_REST_MS);
        expect(nameOf(container, t.id)).not.toBeNull();

        fireEvent.pointerMove(root, { clientX: 1500, clientY: 1000 });
        expect(art(container, t.id).getAttribute('data-outline')).toBeNull();
        expect(nameOf(container, t.id)).toBeNull();
        expect(chargesOf(container, t.id)).toBeNull();

        pointAt(root, t);
        expect(nameOf(container, t.id)).toBeNull();
        later(HOVER_REST_MS);
        expect(nameOf(container, t.id)).not.toBeNull();

        fireEvent.pointerLeave(root);
        expect(nameOf(container, t.id)).toBeNull();
        expect(chargesOf(container, t.id)).toBeNull();
    });

    it('rested on A, over to B and straight back to A: A waits again, even while the mat redraws', async () => {
        const a = placeAt('fixture_producer', 500, 500);
        const b = placeAt('fixture_producer', 800, 500);
        const { container } = mount();
        const root = matRoot(container);
        pointAt(root, a);
        later(HOVER_REST_MS);
        pointAt(root, b);
        later(HOVER_REST_MS / 3);
        pointAt(root, a);
        expect(nameOf(container, a.id)).toBeNull();
        // Something else redraws the mat during the wait (a Token arrives): still no name.
        const before = container.querySelectorAll('[data-token-art]').length;
        await act(async () => {
            placeAt('fixture_producer', 1200, 500);
            EventBus.publish(ENGINE_EVENTS.STATE_CHANGED, { source: 'test' });
            await Promise.resolve();
        });
        expect(container.querySelectorAll('[data-token-art]').length).toBe(before + 1);
        expect(nameOf(container, a.id)).toBeNull();
        later(HOVER_REST_MS - 10);
        expect(nameOf(container, a.id)).toBeNull();
        later(10);
        expect(nameOf(container, a.id)).not.toBeNull();
    });

    it('⭐ sweeping across the mat mounts nothing but outlines', () => {
        const row = [300, 500, 700, 900, 1100].map(x => placeAt('fixture_producer', x, 500));
        const { container } = mount();
        const root = matRoot(container);

        for (const t of row) {
            pointAt(root, t);
            expect(art(container, t.id).getAttribute('data-outline')).toBe('hover');
            later(HOVER_REST_MS / 3);
            expect(container.querySelector('[data-token-name]')).toBeNull();
            expect(container.querySelector('[data-ring], [data-bubble-row="hover"], [data-near-ring]')).toBeNull();
        }
        // A back-and-forth that returns to a Token inside the wait does not count as a rest.
        pointAt(root, row[3]);
        later(HOVER_REST_MS / 2);
        pointAt(root, row[4]);
        later(HOVER_REST_MS / 2);
        expect(container.querySelector('[data-token-name]')).toBeNull();

        // Only where it finally rests.
        later(HOVER_REST_MS);
        expect(container.querySelectorAll('[data-token-name]')).toHaveLength(1);
        expect(nameOf(container, row[4].id)).not.toBeNull();
    });

    it('⭐ the rest redraws the rested Token alone; the hover itself only the two whose outline changed', () => {
        const a = placeAt('fixture_producer', 500, 500);
        const b = placeAt('fixture_producer', 800, 500);
        placeAt('fixture_producer', 1100, 500);
        const { container } = mount();
        const root = matRoot(container);
        pointAt(root, a);
        later(HOVER_REST_MS);

        renders.start();
        pointAt(root, b);
        renders.stop();
        // a loses its outline and its rest, b gains its outline: two Tokens, one commit.
        expect(renders.of('MatToken'), JSON.stringify(renders.all())).toBe(2);
        expect(renders.commits()).toHaveLength(1);

        renders.start();
        later(HOVER_REST_MS);
        renders.stop();
        expect(renders.of('MatToken'), JSON.stringify(renders.all())).toBe(1);
        expect(renders.of('MatHero')).toBe(0);
        expect(nameOf(container, b.id)).not.toBeNull();
    });
});

describe('⭐ resting on a hero or an enemy adds the HP bar', () => {
    it('a hero: outline at once; name and HP bar after the rest; gone on leaving', () => {
        GameState.state.heroes = [{
            id: 'h1', name: 'Aela', spriteId: 'recruit', status: 'idle', level: 5,
            skills: {}, hp: { current: 100, max: 100 }
        }];
        Flags.plant('h1', { x: 600, y: 400 });
        const { container } = mount();
        const figure = container.querySelector('[data-board-hero="h1"]');
        const bar = () => figure.querySelector('[data-health-bar="hero"]');
        const name = () => figure.querySelector('[data-token-name]');

        fireEvent.mouseEnter(figure);
        expect(figure.getAttribute('data-outline')).toBe('hover');
        expect(bar()).toBeNull();
        expect(name()).toBeNull();

        later(HOVER_REST_MS);
        expect(bar()).not.toBeNull();
        expect(name().textContent).toBe('Aela');

        fireEvent.mouseLeave(figure);
        expect(bar()).toBeNull();
        expect(name()).toBeNull();
    });

    it('an enemy: outline at once; name and HP bar after the rest; gone on leaving', () => {
        const e = placeAt('fixture_enemy', 700, 500);
        const { container } = mount();
        const root = matRoot(container);
        const bar = () => overlay(container, e.id).querySelector('[data-health-bar="enemy"]');

        pointAt(root, e);
        expect(art(container, e.id).getAttribute('data-outline')).toBe('hover');
        expect(bar()).toBeNull();
        expect(nameOf(container, e.id)).toBeNull();

        later(HOVER_REST_MS);
        expect(bar()).not.toBeNull();
        expect(nameOf(container, e.id).textContent).toBe('Fixture Enemy');

        fireEvent.pointerLeave(root);
        expect(bar()).toBeNull();
        expect(nameOf(container, e.id)).toBeNull();
    });
});

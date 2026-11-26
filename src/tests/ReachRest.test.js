// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { HOVER_REST_MS, RING_REST_MS } from '../ui/components/board/hoverRest.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
vi.mock('../ui/utils/alphaHitTest.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, isElementOpaqueAtPoint: () => true };
});

/**
 * ⭐ **Reach rings wait for a longer rest** (concept_playmat_declutter.md §2): the name comes up after the
 * pointer rests `HOVER_REST_MS` on a Token; its reach ring and dots only after `RING_REST_MS`, and
 * not at all if the pointer moves on first, so a slow sweep across the mat reads names and pops no
 * rings. A camp ring lit through a hero on the mat waits the same. A Token in the hand shows its
 * landing ring at once.
 */

registerTokenTypes({
    rrest_camp: {
        id: 'rrest_camp', name: 'Rest Camp', tokenType: 'camp', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_nature', requiresHero: false, config: null, camp: { skill: 'forestry' }
    },
    rrest_tree: {
        id: 'rrest_tree', name: 'Rest Tree', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_nature', requiresHero: true,
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] }
    }
});

const h = React.createElement;
const later = (ms) => act(() => { vi.advanceTimersByTime(ms); });
const ring = (c) => c.querySelector('[data-near-ring]');
const nameOf = (c, id) => c.querySelector(`[data-token-overlay="${id}"] [data-token-name]`);

function mount() {
    const view = render(h(DeckDndProvider, null, h(MatFitProvider, { value: 1 }, h(MatBoard))));
    const root = view.container.querySelector('[data-mat-board]');
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0 });
    return { ...view, root };
}
const pointAt = (root, t) => fireEvent.pointerMove(root, { clientX: t.x, clientY: t.y });

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });
beforeEach(() => {
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
    cleanup();
    vi.useRealTimers();
    document.body.classList.remove('gi-dnd-active');
});

describe('⭐ resting on a Token that uses reach', () => {
    it('⭐ the name at the name\'s rest; the ring only once the pointer has rested RING_REST_MS', () => {
        vi.useFakeTimers();
        const camp = placeAt('rrest_camp', 600, 500);
        placeAt('rrest_tree', 680, 500);
        const { container, root } = mount();
        pointAt(root, camp);

        later(HOVER_REST_MS);
        expect(nameOf(container, camp.id)).not.toBeNull();
        expect(ring(container)).toBeNull();

        later(RING_REST_MS - HOVER_REST_MS - 10);
        expect(ring(container)).toBeNull();

        later(10);
        expect(ring(container)).not.toBeNull();
        expect(Number(ring(container).getAttribute('data-cx'))).toBe(camp.x);
    });

    it('the pointer moving on before then brings up no ring; the next Token waits its own full rest', () => {
        vi.useFakeTimers();
        const a = placeAt('rrest_camp', 400, 500);
        const b = placeAt('rrest_camp', 900, 500);
        const { container, root } = mount();

        pointAt(root, a);
        later(RING_REST_MS - 50);
        pointAt(root, b);
        later(RING_REST_MS - 50);
        expect(ring(container)).toBeNull();
        // Back to A inside the wait: A waits again from the start.
        pointAt(root, a);
        later(RING_REST_MS - 50);
        expect(ring(container)).toBeNull();
        later(50);
        expect(Number(ring(container).getAttribute('data-cx'))).toBe(a.x);

        // Leaving takes it away at once (it shrinks out).
        fireEvent.pointerMove(root, { clientX: 1500, clientY: 1000 });
        later(RING_REST_MS);
        expect(ring(container)).toBeNull();
    });

    it('⭐ a slow sweep across the mat reads every name and pops no ring', () => {
        vi.useFakeTimers();
        const row = [300, 550, 800, 1050, 1300].map(x => placeAt('rrest_camp', x, 500));
        const { container, root } = mount();
        for (const t of row) {
            pointAt(root, t);
            later(HOVER_REST_MS + 100);
            expect(nameOf(container, t.id)).not.toBeNull();
            expect(ring(container)).toBeNull();
            expect(container.querySelector('[data-reach-dot]')).toBeNull();
        }
    });
});

describe('a camp ring lit through a hero on the mat', () => {
    it('waits the same rest as a Token\'s own ring', () => {
        vi.useFakeTimers();
        const camp = placeAt('rrest_camp', 600, 500);
        placeAt('rrest_tree', 680, 500);
        GameState.state.heroes = [{
            id: 'h1', name: 'Aela', spriteId: 'recruit', status: 'idle', level: 5,
            skills: { forestry: { level: 10, xp: 0 } }, hp: { current: 100, max: 100 }
        }];
        expect(Orders.orderAt('h1', { x: camp.x, y: camp.y }).success).toBe(true);
        const { container } = mount();
        const figure = container.querySelector('[data-board-hero="h1"]');
        const campRing = () => container.querySelector(`[data-camp-ring="${camp.id}"]`);

        fireEvent.mouseEnter(figure);
        expect(campRing()).toBeNull();
        later(HOVER_REST_MS);
        expect(campRing()).toBeNull();
        later(RING_REST_MS - HOVER_REST_MS);
        expect(campRing()).not.toBeNull();
    });
});

describe('a Token in the hand', () => {
    it('⭐ shows its landing ring at once, with no rest', async () => {
        vi.useFakeTimers();
        const camp = placeAt('rrest_camp', 400, 300);
        // In reach of where the hand lands, and clear of it (edges touching is 128 u).
        placeAt('rrest_tree', 1330, 700);
        const { container } = mount();
        const hit = container.querySelector(`[data-token-hit="${camp.id}"]`);
        const ptr = (x, y) => ({ pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y });
        act(() => {
            fireEvent.pointerDown(hit, ptr(400, 300));
            fireEvent.pointerMove(document, ptr(430, 300));
        });
        act(() => { fireEvent.pointerMove(document, ptr(1200, 700)); });
        // A few frames for the drag's pointer to land, far short of any rest.
        later(50);
        expect(document.body.classList.contains('gi-dnd-active')).toBe(true);
        expect(ring(container)).not.toBeNull();
        expect(Number(ring(container).getAttribute('data-cx'))).toBe(1200);
        await act(async () => { fireEvent.pointerUp(document, ptr(400, 300)); await Promise.resolve(); });
    });
});


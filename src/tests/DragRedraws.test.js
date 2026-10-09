// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
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
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
vi.mock('../ui/components/drawer/HeroInspectionSheet.jsx', () => ({
    HeroInspectionSheet: () => React.createElement('div', { 'data-testid': 'hero-sheet' })
}));

// Render counters: each wraps a part drawn once per render of the thing it belongs to. A Token's
// art, a flag's mark and a hero's figure are not redrawn unless their owner rendered.
const drawn = { token: new Map(), flag: new Map(), matHero: new Map(), dockHero: new Map() };
const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
vi.mock('../ui/components/board/TokenHitArt.jsx', async (orig) => {
    const real = await orig();
    const TokenHitArt = (props) => { bump(drawn.token, props.instanceId); return real.TokenHitArt(props); };
    return { ...real, TokenHitArt };
});
vi.mock('../ui/components/board/FlagMark.jsx', async (orig) => {
    const real = await orig();
    const FlagMark = (props) => { if (props.alt) bump(drawn.flag, props.alt); return real.FlagMark(props); };
    return { ...real, FlagMark, default: FlagMark };
});
vi.mock('../ui/components/board/AnimatedHeroSprite.jsx', async (orig) => {
    const real = await orig();
    // The mat's figure passes a class; the bar's does not.
    const AnimatedHeroSprite = (props) => { bump(props.className ? drawn.matHero : drawn.dockHero, props.heroId); return real.AnimatedHeroSprite(props); };
    return { ...real, AnimatedHeroSprite, default: AnimatedHeroSprite };
});

/**
 * ⭐ **Picking up, carrying and putting down redraw only what changed.** dnd-kit re-renders every
 * component that holds a drag or drop hook whenever a drag starts, ends or crosses into another
 * target. On a full mat that was every Token at once, a frame of 24–36 ms at every pickup and
 * drop. Only the thing in the hand, and the targets the pointer actually leaves and enters, may
 * redraw.
 */

const h = React.createElement;
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
const delta = (map, before) => {
    const out = {};
    for (const [k, n] of map) out[k] = n - (before.get(k) || 0);
    return out;
};
const snap = () => ({ token: new Map(drawn.token), flag: new Map(drawn.flag), matHero: new Map(drawn.matHero), dockHero: new Map(drawn.dockHero) });
const ptr = (x, y, extra = {}) => ({ pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0, ...extra });

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
    for (const m of Object.values(drawn)) m.clear();
    setLiveMatFit(1);
});
afterEach(async () => {
    // dnd-kit drops its after-drag click guard 50 ms after a drag ends.
    await new Promise(r => setTimeout(r, 80));
    cleanup();
    document.body.classList.remove('gi-dnd-active');
});

describe('⭐ a Token drag on a full mat redraws the Token in the hand and nothing else on the mat', () => {
    function scene() {
        GameState.state.heroes = [{
            id: 'h1', name: 'h1', spriteId: 'recruit', status: 'idle', level: 50,
            skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 }
        }];
        // Far from the carried Token's path, high on the mat: it sorts behind every Token.
        Flags.plant('h1', { x: 250, y: 150 });
        const a = placeAt('fixture_producer', 600, 400);
        const b = placeAt('fixture_producer', 1000, 500);
        const c = placeAt('fixture_producer', 600, 900);
        const view = render(
            h(EngineContext.Provider, { value: { GameState, EventBus } },
                h(DeckDndProvider, null,
                    h(Board, { onInspectToken: () => {}, onClearInspect: () => {} })))
        );
        // jsdom lays nothing out: the mat's drop target and its board both stand at the
        // viewport's corner at their natural size, so a client point IS a mat point.
        view.container.querySelector('[data-board-origin]').getBoundingClientRect = () => box(0, 0, matW(), matH());
        view.container.querySelector('[data-mat-board]').getBoundingClientRect = () => box(0, 0, matW(), matH());
        return { a, b, c, ...view };
    }
    const hitOf = (container, id) => container.querySelector(`[data-token-hit="${id}"]`);

    it('pickup: only the picked-up Token redraws', () => {
        const { a, b, c, container } = scene();
        expect(drawn.token.get(a.id)).toBeGreaterThan(0);
        expect(drawn.flag.size).toBe(1);
        expect(drawn.matHero.size).toBe(1);
        const before = snap();

        act(() => {
            fireEvent.pointerDown(hitOf(container, a.id), ptr(600, 400));
            fireEvent.pointerMove(document, ptr(630, 400));
        });
        expect(document.body.classList.contains('gi-dnd-active')).toBe(true);
        expect(container.querySelector(`[data-token-art][data-token-id="${a.id}"]`).style.visibility).toBe('hidden');

        const d = delta(drawn.token, before.token);
        expect(d[a.id]).toBeGreaterThan(0);
        expect(d[b.id]).toBe(0);
        expect(d[c.id]).toBe(0);
        act(() => { fireEvent.pointerUp(document, ptr(630, 400)); });
    });

    it('carrying: no Token redraws, the one in the hand included', () => {
        const { a, container } = scene();
        act(() => {
            fireEvent.pointerDown(hitOf(container, a.id), ptr(600, 400));
            fireEvent.pointerMove(document, ptr(630, 400));
        });
        const before = snap();
        for (let i = 1; i <= 6; i++) {
            act(() => { fireEvent.pointerMove(document, ptr(630 + i * 12, 400 - i * 3)); });
        }
        expect(Object.values(delta(drawn.token, before.token)).every(n => n === 0)).toBe(true);
        act(() => { fireEvent.pointerUp(document, ptr(702, 382)); });
    });

    it('drop: only the moved Token redraws, and it stands where it was let go', () => {
        const { a, b, c, container } = scene();
        act(() => {
            fireEvent.pointerDown(hitOf(container, a.id), ptr(600, 400));
            fireEvent.pointerMove(document, ptr(630, 400));
        });
        // Its own act: the drop point is read by a listener the drag start attaches.
        act(() => { fireEvent.pointerMove(document, ptr(700, 380)); });
        const before = snap();
        act(() => { fireEvent.pointerUp(document, ptr(700, 380)); });
        expect(document.body.classList.contains('gi-dnd-active')).toBe(false);
        const moved = BoardState.getTokenById(a.id);
        expect(moved.x).toBeCloseTo(700, 0);
        expect(moved.y).toBeCloseTo(380, 0);
        expect(container.querySelector(`[data-token-art][data-token-id="${a.id}"]`).style.visibility).toBe('visible');

        const d = delta(drawn.token, before.token);
        expect(d[a.id]).toBeGreaterThan(0);
        expect(d[b.id]).toBe(0);
        expect(d[c.id]).toBe(0);
    });
});

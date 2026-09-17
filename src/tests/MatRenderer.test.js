import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent, renderHook } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EngineContext } from '../ui/context/EngineContext';
import { matW, matH } from '../config/matGeometry.js';
import { UPGRADE_BOARD_PX } from '../config/upgradeBoardGeometry.js';
import { fitScale, useBoardScale } from '../ui/hooks/useBoardScale.js';
import { MatBoard, heroPlacement } from '../ui/components/board/MatBoard.jsx';
import { TrayMiniBoard } from '../ui/components/board/TrayMiniBoard.jsx';
import { TokenInspectPopup } from '../ui/components/board/TokenInspectPopup.jsx';
import { flagOrigin, IDLE_HERO_OFFSET, FLAG_PX } from '../ui/components/board/flagGeometry.js';
import { HERO_HIT_PX, PAIR_OFFSET_PX, ALERT_LABEL } from '../ui/components/board/boardConstants.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Free Playmat slice 1.6c-2 — the mat renderer.**
 *
 * The owner's framing rule: *"We won't have 'Tiles' in the new system. Tokens
 * and flags sit freely around the playmat."* These tests hold the renderer to
 * it — every Token, hero and flag drawn **at its own mat point, keyed by Token
 * instance id**, with nothing on screen measured in tiles.
 *
 * The faint outline of where a Token could still land (FP-93) went with the
 * snapping in slice 1.6d-1, and the grid itself in slice 1.6d-2.
 */

/** A Token two steps square, for the large-art geometry. */
registerTokenTypes({
    mat_large: {
        id: 'mat_large', name: 'Mat Large', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 100, sprite: 'skill_nature',
        size: 2, requiresHero: false
    }
});

const h = React.createElement;

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * this names one spot on the mat with room around it for a hero to stand.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

const mount = (el) => render(
    h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el))
);

const artOf = (container, id) => container.querySelector(`[data-token-id="${id}"][data-token-art]`);
const overlayOf = (container, id) => container.querySelector(`[data-token-overlay="${id}"]`);
const zOf = (container, id) => Number(artOf(container, id).style.zIndex);

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());
afterEach(() => cleanup());

beforeEach(() => {
    vi.clearAllMocks();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [hero('h1', { logging: 50 }), hero('h2', { logging: 50 })];
});

// ---------------------------------------------------------------------------

describe('fitting the mat into the window (CR2-179, FP-86)', () => {
    it('shrinks on whichever axis binds, and now grows past 1:1 too (FP-99)', () => {
        // ⭐ Twice the room it needs is now taken. This used to be capped at 1,
        // because blowing the art up would blur it — the art is stepped to a
        // whole multiple of ART_PX instead now, so the mat fills the space.
        expect(fitScale(matW() * 2, matH() * 2, matW(), matH())).toBe(2);
        // Width binds.
        expect(fitScale(matW() / 2, matH() * 2, matW(), matH())).toBe(0.5);
        // ⭐ Height binds — the case a one-axis fit missed entirely, and the mat
        // is a wide shape in a short column, so this is the common one.
        expect(fitScale(matW() * 2, matH() / 2, matW(), matH())).toBe(0.5);
    });

    it('the square form is exactly the two-axis form with equal sides', () => {
        expect(fitScale(500, 300, 944)).toBe(fitScale(500, 300, 944, 944));
        expect(fitScale(1200, 900, 944)).toBe(fitScale(1200, 900, 944, 944));
    });

    it('the Guild Hall upgrade board still measures as one square', () => {
        const { result } = renderHook(() => useBoardScale(UPGRADE_BOARD_PX));
        const el = document.createElement('div');
        Object.defineProperty(el, 'clientWidth', { value: UPGRADE_BOARD_PX / 2 });
        Object.defineProperty(el, 'clientHeight', { value: UPGRADE_BOARD_PX / 2 });

        act(() => { result.current.ref(el); });
        act(() => { window.dispatchEvent(new Event('resize')); });

        expect(result.current.scale).toBe(0.5);
        expect(result.current.size).toBe(result.current.height);
    });

    it('the mat reports its two different sides', () => {
        const { result } = renderHook(() => useBoardScale(matW(), matH()));
        const el = document.createElement('div');
        Object.defineProperty(el, 'clientWidth', { value: matW() });
        Object.defineProperty(el, 'clientHeight', { value: matH() / 2 });

        act(() => { result.current.ref(el); });
        act(() => { window.dispatchEvent(new Event('resize')); });

        expect(result.current.scale).toBe(0.5);
        expect(result.current.size).toBe(Math.round(matW() * 0.5));
        expect(result.current.height).toBe(Math.round(matH() * 0.5));
    });
});

describe('a Token is a circle of art at a point', () => {
    it('draws a 1×1 Token 128 u across, centred on its point', () => {
        const tok = placeAt('fixture_producer', 600, 400);
        const { container } = mount(h(MatBoard));

        const art = artOf(container, tok.id);
        expect(parseFloat(art.style.left)).toBe(600 - 64);
        expect(parseFloat(art.style.top)).toBe(400 - 64);
        expect(art.style.width).toBe('128px');
        expect(art.style.height).toBe('128px');
    });

    it('draws a 2×2 Token 288 u across, centred on its point', () => {
        const tok = placeAt('mat_large', 700, 500);
        const { container } = mount(h(MatBoard));

        const art = artOf(container, tok.id);
        expect(parseFloat(art.style.left)).toBe(700 - 144);
        expect(parseFloat(art.style.top)).toBe(500 - 144);
        expect(art.style.width).toBe('288px');
        expect(art.style.height).toBe('288px');
    });

    it('⭐ only the art circle answers the pointer, not the corners of its box', () => {
        const tok = placeAt('fixture_producer', 600, 400);
        const { container } = mount(h(MatBoard));
        expect(artOf(container, tok.id).style.clipPath).toBe('circle(50%)');
    });

    it('moves to its new point when the Token moves — the same element, slid across', async () => {
        const tok = placeAt('fixture_producer', 600, 400);
        const { container } = mount(h(MatBoard));
        const before = artOf(container, tok.id);

        await act(async () => {
            BoardState.setTokenPoint(tok.id, 900, 700);
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: tok.id, typeId: tok.typeId });
        });

        const after = artOf(container, tok.id);
        expect(parseFloat(after.style.left)).toBe(900 - 64);
        expect(parseFloat(after.style.top)).toBe(700 - 64);
        // A push is now a slide, not a remount: same element, animated.
        expect(after).toBe(before);
        expect(after.style.transition).toContain('left');
    });
});

describe('where a hero stands (D-266, FP-77, FP-84)', () => {
    it('working a 1×1 Token: half the pair offset to its left', () => {
        expect(heroPlacement({ state: 'working', size: 1, x: 600, y: 400 })).toEqual({
            left: 600 - PAIR_OFFSET_PX - HERO_HIT_PX / 2,
            top: 400 - FLAG_PX / 2
        });
    });

    it('working a 2×2 Token: down and to its left, standing in front of the art', () => {
        expect(heroPlacement({ state: 'working', size: 2, x: 700, y: 500 })).toEqual({
            left: 700 - 80 - HERO_HIT_PX / 2,
            top: 500 + 80 - FLAG_PX / 2
        });
    });

    it('waiting on an empty spot: squarely on the spot, nothing to make room for', () => {
        expect(heroPlacement({ state: 'waiting', size: 1, x: 300, y: 300 })).toEqual({
            left: 300 - HERO_HIT_PX / 2,
            top: 300 - FLAG_PX / 2
        });
    });

    it('the drawn hero stands where the rule says, and their Token has slid aside', () => {
        const tok = placeAt('fixture_producer', C(15).x, C(15).y);
        Flags.plant('h1', C(15));
        expect(Flags.statusOf('h1').state).toBe('working');

        const { container } = mount(h(MatBoard));
        const drawn = container.querySelector('[data-board-hero="h1"]');
        const place = heroPlacement({ state: 'working', size: 1, x: tok.x, y: tok.y });

        expect(parseFloat(drawn.style.left)).toBe(place.left);
        expect(parseFloat(drawn.style.top)).toBe(place.top);
        // The Token slid the same distance the other way (D-266).
        expect(parseFloat(artOf(container, tok.id).style.left)).toBe(tok.x - 64 + PAIR_OFFSET_PX);
    });

    it('an idle hero stands beside their own flag (FP-84)', () => {
        Flags.plant('h1', { x: 500, y: 900 });          // bare ground: nothing to work
        expect(Flags.statusOf('h1').state).toBe('idle');

        const { container } = mount(h(MatBoard));
        const idle = container.querySelector('[data-flag-idle-hero="h1"]');
        const { left, top } = flagOrigin({ x: 500, y: 900 });

        expect(parseFloat(idle.style.left)).toBe(left + IDLE_HERO_OFFSET.left);
        expect(parseFloat(idle.style.top)).toBe(top + IDLE_HERO_OFFSET.top);
    });

    it('several heroes may stand on one Token — the one-per-spot rule went with the grid', () => {
        placeAt('fixture_producer', C(15).x, C(15).y);
        Flags.plant('h1', C(15));
        Flags.plant('h2', C(15));

        const { container } = mount(h(MatBoard));
        // h1 works it; h2 has nothing to do and stands at its flag. Both drawn.
        expect(container.querySelector('[data-board-hero="h1"], [data-flag-idle-hero="h1"]')).toBeTruthy();
        expect(container.querySelector('[data-board-hero="h2"], [data-flag-idle-hero="h2"]')).toBeTruthy();
    });
});

describe('news reaches the Token it is about, and no other', () => {
    it('an alert marks its own Token and leaves its neighbour alone', async () => {
        const a = placeAt('fixture_producer', 500, 500);
        const b = placeAt('fixture_producer', 900, 500);
        const { container } = mount(h(MatBoard));

        await act(async () => {
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                instanceId: a.id, severity: 'red', type: 'token_exhausted',
                name: 'Forest', message: 'Token Exhausted: Forest'
            });
        });

        expect(overlayOf(container, a.id).querySelector('img[alt="Token Exhausted: Forest"]')).not.toBeNull();
        expect(overlayOf(container, b.id).querySelector('img[alt="Token Exhausted: Forest"]')).toBeNull();
    });

    it('an effect firing says its name on its own Token only', async () => {
        const a = placeAt('fixture_producer', 500, 500);
        const b = placeAt('fixture_producer', 900, 500);
        const { container } = mount(h(MatBoard));

        await act(async () => {
            EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId: a.id, title: 'Shrimp Trawler II' });
        });

        expect(overlayOf(container, a.id).textContent).toContain('Shrimp Trawler II');
        expect(overlayOf(container, b.id).textContent).not.toContain('Shrimp Trawler II');
    });
});

describe('⭐ which Token the pointer is on (overlapping art)', () => {
    /** The mat measured as its natural size, so a client point IS a mat point. */
    const unscaled = (root) => {
        root.getBoundingClientRect = () => ({
            left: 0, top: 0, width: matW(), height: matH(),
            right: matW(), bottom: matH(), x: 0, y: 0
        });
    };

    it('picks the nearer centre and raises it to the front', () => {
        // 60 u apart: each point below lies inside BOTH art circles (r = 64).
        const a = placeAt('fixture_producer', 500, 500);
        const b = placeAt('fixture_producer', 560, 500);
        const { container } = mount(h(MatBoard));
        const root = container.querySelector('[data-mat-board]');
        unscaled(root);

        fireEvent.pointerMove(root, { clientX: 545, clientY: 500 });
        expect(zOf(container, b.id)).toBeGreaterThan(zOf(container, a.id));

        fireEvent.pointerMove(root, { clientX: 515, clientY: 500 });
        expect(zOf(container, a.id)).toBeGreaterThan(zOf(container, b.id));
    });

    it('nothing is hovered out on the bare mat', () => {
        const a = placeAt('fixture_producer', 500, 500);
        const { container } = mount(h(MatBoard));
        const root = container.querySelector('[data-mat-board]');
        unscaled(root);

        const resting = zOf(container, a.id);
        fireEvent.pointerMove(root, { clientX: 1500, clientY: 1000 });
        expect(zOf(container, a.id)).toBe(resting);
    });
});

describe('the Token sheet follows its Token (slice 1.6c-2)', () => {
    it('anchors to the drawn Token, and re-anchors after it moves', async () => {
        const tok = placeAt('fixture_producer', 600, 400);

        // A stand-in for the drawn Token: jsdom lays nothing out, so the popup
        // is given a rect to measure.
        const el = document.createElement('div');
        el.setAttribute('data-token-id', tok.id);
        document.body.appendChild(el);
        let rect = { left: 300, top: 300, width: 128, height: 128, right: 428, bottom: 428 };
        el.getBoundingClientRect = () => rect;

        const { container } = mount(h(TokenInspectPopup, {
            typeId: tok.typeId, instanceId: tok.id, onClose: () => {}
        }));
        const popup = container.firstChild;
        const before = parseFloat(popup.style.left);

        // The Token is pushed across the mat; the sheet goes with it.
        rect = { left: 900, top: 300, width: 128, height: 128, right: 1028, bottom: 428 };
        await act(async () => {
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: tok.id, typeId: tok.typeId });
        });

        expect(parseFloat(popup.style.left)).toBeGreaterThan(before);
        el.remove();
    });
});

describe('the mat itself (FP-96)', () => {
    it('⭐ is a plain darker surface with a soft rounded border, and no play-area outline', () => {
        const { container } = mount(h(MatBoard));

        const surface = container.querySelector('[data-mat-surface]');
        expect(surface).not.toBeNull();
        expect(parseFloat(surface.style.width)).toBe(matW());
        expect(parseFloat(surface.style.height)).toBe(matH());

        // FP-96: the rounded border is the mat's only edge now — a placeholder
        // until it gets real art.
        expect(parseFloat(surface.style.borderRadius)).toBeGreaterThan(0);
        expect(surface.style.border).toBeTruthy();

        // ⭐ The practice outline went with the snapping it existed to explain
        // (slice 1.6d-1): a Token may stand anywhere on the mat.
        expect(container.querySelector('[data-play-area-outline]')).toBeNull();
    });

    /**
     * ⭐ FP-97 — the Tray's mini board is now a scaled picture of the mat, not a
     * grid of cells. It keeps working while a drawer covers the real board, and
     * it is retired entirely in slice 1.9.
     */
    it('⭐ the Tray mini mat draws the mat’s Tokens scaled down, with no grid cells', () => {
        const drawn = placeAt('fixture_producer', 880, 563);

        const { container } = mount(h(TrayMiniBoard));

        expect(container.querySelector('[data-mini-mat]')).not.toBeNull();
        const art = container.querySelector(`[data-mini-token="${drawn.id}"]`);
        expect(art).not.toBeNull();

        // Placed as a PERCENTAGE of the mat, so it scales with whatever box the
        // Tray gives it — nothing here measures pixels.
        expect(parseFloat(art.style.left)).toBeCloseTo(((880 - 64) / matW()) * 100, 4);
        expect(parseFloat(art.style.top)).toBeCloseTo(((563 - 64) / matH()) * 100, 4);

        // Not one tile cell survives.
        expect(container.querySelectorAll('[id^="miniboard-tile-"]')).toHaveLength(0);
    });

    it('a spot awaiting a restock shows a ghost of what it is owed', () => {
        BoardState.setVacancyAt({ x: 800, y: 600 }, 'fixture_producer');
        BoardState.vacancyAt(BoardState.spotIdAt(800, 600)).unstocked = true;

        const { container } = mount(h(MatBoard));
        const ghost = container.querySelector('[data-unstocked-spot]');

        expect(ghost).not.toBeNull();
        expect(parseFloat(ghost.style.left)).toBe(800 - 64);
        expect(parseFloat(ghost.style.top)).toBe(600 - 64);
        expect(ghost.textContent).toContain(ALERT_LABEL[ALERT.UNSTOCKED]);
    });
});

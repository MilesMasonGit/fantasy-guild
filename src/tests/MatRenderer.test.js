// @vitest-environment jsdom
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
import { WEB_W, WEB_H } from '../ui/components/board/GuildHallBoard.jsx';
import { fitScale, useBoardScale } from '../ui/hooks/useBoardScale.js';
import { MatBoard, heroPlacement } from '../ui/components/board/MatBoard.jsx';
import { TokenInspectPopup } from '../ui/components/board/TokenInspectPopup.jsx';
import { FLAG_PX } from '../ui/components/board/flagGeometry.js';
import { HERO_HIT_PX } from '../ui/components/board/boardConstants.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import { ALERT } from '../systems/board/boardEvents.js';
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
 * ⭐ **Free Playmat slice 1.6c-2 — the mat renderer.**
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
    GameState.state.heroes = [hero('h1', { forestry: 50 }), hero('h2', { forestry: 50 })];
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

    // The Guild Hall's 7×7 upgrade grid (a square) became a web in B9; the web
    // passes both its sides, like the mat.
    it('the Guild Hall upgrade web fits by its two sides', () => {
        const { result } = renderHook(() => useBoardScale(WEB_W, WEB_H));
        const el = document.createElement('div');
        Object.defineProperty(el, 'clientWidth', { value: WEB_W });
        Object.defineProperty(el, 'clientHeight', { value: WEB_H / 2 });

        act(() => { result.current.ref(el); });
        act(() => { window.dispatchEvent(new Event('resize')); });

        expect(result.current.scale).toBe(0.5);
        expect(result.current.size).toBe(WEB_W / 2);
        expect(result.current.height).toBe(WEB_H / 2);
    });

    it('a square board (one side given) still measures as one square', () => {
        const { result } = renderHook(() => useBoardScale(800));
        const el = document.createElement('div');
        Object.defineProperty(el, 'clientWidth', { value: 400 });
        Object.defineProperty(el, 'clientHeight', { value: 400 });

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
        expect(drawnPoint(art).x).toBe(600 - 64);
        expect(drawnPoint(art).y).toBe(400 - 64);
        expect(art.style.width).toBe('128px');
        expect(art.style.height).toBe('128px');
    });

    it('draws a 2×2 Token 288 u across, centred on its point', () => {
        const tok = placeAt('mat_large', 700, 500);
        const { container } = mount(h(MatBoard));

        const art = artOf(container, tok.id);
        expect(drawnPoint(art).x).toBe(700 - 144);
        expect(drawnPoint(art).y).toBe(500 - 144);
        expect(art.style.width).toBe('288px');
        expect(art.style.height).toBe('288px');
    });

    it('⭐ only the art circle answers the pointer, not the corners of its box', () => {
        const tok = placeAt('fixture_producer', 600, 400);
        const { container } = mount(h(MatBoard));
        // The drawing takes no pointer and is not clipped, so spilling art is drawn, not cropped;
        // a round hit area the size of the circle does (`MatPressTarget.test.js`).
        expect(artOf(container, tok.id).style.pointerEvents).toBe('none');
        expect(artOf(container, tok.id).style.clipPath).toBe('');
        const hit = container.querySelector(`[data-token-hit="${tok.id}"]`);
        expect(hit.style.borderRadius).toBe('50%');
        expect(hit.style.width).toBe('128px');
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
        expect(drawnPoint(after).x).toBe(900 - 64);
        expect(drawnPoint(after).y).toBe(700 - 64);
        // A push is now a slide, not a remount: same element, animated.
        expect(after).toBe(before);
        expect(after.style.transition).toContain('left');
    });
});

describe('where a hero stands (Hero Movement M1, HM-2, FP-84)', () => {
    it('a hero is drawn centred on their own point — no per-state offset any more', () => {
        expect(heroPlacement({ x: 600, y: 400 })).toEqual({
            left: 600 - HERO_HIT_PX / 2,
            top: 400 - FLAG_PX / 2
        });
    });

    it('⭐ a working hero stands beside their Token, and the Token stays exactly where it is', () => {
        const tok = placeAt('fixture_producer', C(15).x, C(15).y);
        Flags.plant('h1', C(15));
        expect(Flags.statusOf('h1').state).toBe('working');

        const { container } = mount(h(MatBoard));
        const drawn = container.querySelector('[data-board-hero="h1"]');
        // Planted on the Token's centre: the hero appears beside the flag, to its
        // right (`idleSpot`), so they come at the Token from the right.
        const spot = HeroMotion.standingSpot(tok.typeId, tok, 1);
        const place = heroPlacement(spot);

        expect(spot.x).toBe(tok.x + 64 + HeroMotion.STAND_GAP);
        expect(drawnPoint(drawn).x).toBe(place.left);
        expect(drawnPoint(drawn).y).toBe(place.top);
        expect(drawnPoint(artOf(container, tok.id)).x).toBe(tok.x - 64);
    });

    it('an idle hero stands beside their own flag (FP-84)', () => {
        Flags.plant('h1', { x: 500, y: 900 });          // bare ground: nothing to work
        expect(Flags.statusOf('h1').state).toBe('idle');

        const { container } = mount(h(MatBoard));
        // ⭐ Drawn by MatBoard like every other hero (M2), at the idle spot.
        const idle = container.querySelector('[data-board-hero="h1"]');
        const place = heroPlacement(HeroMotion.idleSpot({ x: 500, y: 900 }));

        expect(drawnPoint(idle).x).toBe(place.left);
        expect(drawnPoint(idle).y).toBe(place.top);
        expect(HeroMotion.idleSpot({ x: 500, y: 900 })).toEqual({ x: 572, y: 828 });
    });

    it('⭐ a recalled hero is still drawn while walking home, and limps when defeated (M3)', () => {
        BoardState.setInstantArrival(false);
        try {
            placeAt('token_guild_hall', 880, 563);             // heroes come and go through it
            expect(HeroMotion.guildHallPoint()).toEqual({ x: 880, y: 563 });
            Flags.plant('h1', { x: 1500, y: 900 });
            HeroMotion.tick(60000);                              // out of the Hall, beside the flag
            Flags.furl('h1');
            HeroMotion.tick(100);
            let { container } = mount(h(MatBoard));
            expect(container.querySelector('[data-board-hero="h1"]')).not.toBeNull();
            expect(container.querySelector('[data-hero-limp]')).toBeNull();
            cleanup();

            Flags.plant('h1', { x: 1500, y: 900 });              // turn round…
            HeroMotion.tick(60000);
            Flags.furl('h1', 'defeat');                          // …and fall
            HeroMotion.tick(100);
            ({ container } = mount(h(MatBoard)));
            expect(container.querySelector('[data-board-hero="h1"][data-hero-limp]')).not.toBeNull();
        } finally {
            BoardState.setInstantArrival(true);
        }
    });

    it('several heroes may stand on one Token — the one-per-spot rule went with the grid', () => {
        placeAt('fixture_producer', C(15).x, C(15).y);
        Flags.plant('h1', C(15));
        Flags.plant('h2', C(15));

        const { container } = mount(h(MatBoard));
        // h1 works it; h2 has nothing to do and stands at its flag. Both drawn.
        expect(container.querySelector('[data-board-hero="h1"]')).toBeTruthy();
        expect(container.querySelector('[data-board-hero="h2"]')).toBeTruthy();
    });
});

describe('news reaches the Token it is about, and no other', () => {
    it('an alert draws no mark on any Token', async () => {
        const a = placeAt('fixture_producer', 500, 500);
        const b = placeAt('fixture_producer', 900, 500);
        const { container } = mount(h(MatBoard));

        await act(async () => {
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                instanceId: a.id, severity: 'red', type: 'token_exhausted',
                name: 'Forest', message: 'Token Exhausted: Forest'
            });
        });

        expect(container.querySelector('img[alt="Token Exhausted: Forest"]')).toBeNull();
        expect(overlayOf(container, a.id).querySelector('img')?.getAttribute('src') || '').not.toContain('ui_alert');
        expect(overlayOf(container, b.id).querySelector('img[alt="Token Exhausted: Forest"]')).toBeNull();
    });

    it('an effect firing says its name as a callout over its own Token only', async () => {
        const a = placeAt('fixture_producer', 500, 500);
        const b = placeAt('fixture_producer', 900, 500);
        const { container } = mount(h(MatBoard));

        await act(async () => {
            EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId: a.id, title: 'Shrimp Trawler II' });
        });

        const callouts = [...container.querySelectorAll('[data-callout]')];
        expect(callouts.map(c => c.textContent)).toEqual(['Shrimp Trawler II']);
        expect(callouts[0].parentElement.style.transform).toContain('translate(500px');
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

    it('⭐ only a Token whose rules involve its neighbours shows a reach ring (owner, 2026-09-21)', () => {
        const plain = placeAt('fixture_producer', 500, 500);
        const tool = placeAt('fixture_tool', 900, 500);
        const { container } = mount(h(MatBoard));
        const root = container.querySelector('[data-mat-board]');
        unscaled(root);

        fireEvent.pointerMove(root, { clientX: plain.x, clientY: plain.y });
        expect(container.querySelector('[data-near-ring]')).toBeNull();

        fireEvent.pointerMove(root, { clientX: tool.x, clientY: tool.y });
        const ring = container.querySelector('[data-near-ring]');
        expect(ring).not.toBeNull();
        expect(Number(ring.getAttribute('cx'))).toBe(tool.x);
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

        // the rounded border is the mat's only edge now — a placeholder until
        // it gets real art.
        expect(parseFloat(surface.style.borderRadius)).toBeGreaterThan(0);
        expect(surface.style.border).toBeTruthy();

        // ⭐ The practice outline went with the snapping it existed to explain
        // (slice 1.6d-1): a Token may stand anywhere on the mat.
        expect(container.querySelector('[data-play-area-outline]')).toBeNull();
    });

});

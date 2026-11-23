// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { FlagLayer } from '../ui/components/board/FlagLayer.jsx';
import { markerBox, MARKER_ART_PX, MARKER_PULSE_EVERY_MS } from '../ui/components/board/flagGeometry.js';
import { flagClothOver } from '../ui/components/board/flagCloth.js';
import { REACH_DOT_PULSE } from '../ui/components/board/reachDot.js';
import { pulsePoseAt } from '../ui/components/board/fx/posePulse.js';
import { setDrawingPaused } from '../ui/components/board/frameClock.js';
import { setRosterHover } from '../ui/components/board/orderLit.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import { manualFrames } from './fixtures/manualFrames.js';
import { drawnPoint } from './fixtures/drawnPoint.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Flags in the middle, on hover (brief 720 R2): a hero's flag shows only while that hero is
 * hovered (on the mat or their hero bar tab), in the middle of the Token they are ordered to or on
 * their spot, pulsing while shown; hovering a Token shows the flags of every hero ordered to it,
 * side by side in its middle. Every other flag is hidden. The flag in a Token's middle never takes
 * the Token's pointer, but its tooltip still shows over its cloth.
 */

const h = React.createElement;
const mount = (el) => render(h(DndContext, null, el));
const hero = (id) => ({ id, name: id, status: 'idle', level: 50, skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } });
const flagOf = (c, id) => c.querySelector(`button[data-flag="${id}"]`);
const pulseOf = (c, id) => c.querySelector(`button[data-flag="${id}"] [data-flag-pulse]`);
const BARE = { x: 1300, y: 800 };

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
    GameState.state.heroes = [hero('h1'), hero('h2'), hero('h3')];
});
afterEach(() => {
    cleanup();
    act(() => setRosterHover(null));
    setDrawingPaused(false);
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('which flags show', () => {
    it('none at rest: a Token order draws nothing, a spot order’s flag is down and gone', () => {
        const t = placeAt('fixture_producer', 600, 500);
        Orders.orderAt('h1', { x: t.x, y: t.y });
        Orders.orderAt('h2', BARE);
        const { container } = mount(h(FlagLayer));
        expect(flagOf(container, 'h1')).toBeNull();
        expect(flagOf(container, 'h2').getAttribute('data-flag-down')).toBe('true');
        expect(flagOf(container, 'h2').getAttribute('data-flag-gone')).toBe('true');
        expect(flagOf(container, 'h2').className).toContain('invisible');
    });

    it('the hovered hero’s flag only, in their Token’s middle; it goes when the hover ends', () => {
        const t = placeAt('fixture_producer', 600, 500);
        const u = placeAt('fixture_producer', 1000, 500);
        Orders.orderAt('h1', { x: t.x, y: t.y });
        Orders.orderAt('h2', { x: u.x, y: u.y });
        const view = mount(h(FlagLayer, { hoverHeroId: 'h1' }));
        const el = flagOf(view.container, 'h1');
        expect(el.getAttribute('data-flag-pinned')).toBe(t.id);
        const size = parseFloat(el.style.width);
        expect(Math.abs(drawnPoint(el).x + size / 2 - t.x)).toBeLessThanOrEqual(size / MARKER_ART_PX / 2);
        expect(flagOf(view.container, 'h2')).toBeNull();
        view.rerender(h(DndContext, null, h(FlagLayer, { hoverHeroId: null })));
        expect(flagOf(view.container, 'h1')).toBeNull();
    });

    it('a hovered Token shows every hero ordered to it, side by side, each where it stands when its hero alone is hovered', () => {
        const t = placeAt('fixture_producer', 600, 500);
        const u = placeAt('fixture_producer', 1000, 500);
        Orders.orderAt('h1', { x: t.x, y: t.y });
        Orders.orderAt('h2', { x: t.x, y: t.y });
        Orders.orderAt('h3', { x: u.x, y: u.y });
        const view = mount(h(FlagLayer, { hoveredTokenId: t.id }));
        const a = flagOf(view.container, 'h1');
        const b = flagOf(view.container, 'h2');
        expect(a.getAttribute('data-flag-pinned')).toBe(t.id);
        expect(b.getAttribute('data-flag-pinned')).toBe(t.id);
        expect(flagOf(view.container, 'h3')).toBeNull();
        expect(a.style.top).toBe(b.style.top);
        expect(drawnPoint(a).x).toBeLessThan(drawnPoint(b).x);
        // The pair is centred on the Token.
        const size = parseFloat(a.style.width);
        const mid = (drawnPoint(a).x + drawnPoint(b).x + size) / 2;
        expect(Math.abs(mid - t.x)).toBeLessThanOrEqual(size / MARKER_ART_PX);
        const placeOfA = a.style.left;
        // One hero hovered: their flag alone, in the same place (nothing jumps under the pointer).
        view.rerender(h(DndContext, null, h(FlagLayer, { hoverHeroId: 'h1' })));
        expect(flagOf(view.container, 'h1').style.left).toBe(placeOfA);
        expect(flagOf(view.container, 'h2')).toBeNull();
    });

    it('a spot order’s flag comes up on its spot while its hero is hovered, and fades when the hover ends', () => {
        Orders.orderAt('h1', BARE);
        const view = mount(h(FlagLayer, { hoverHeroId: 'h1' }));
        const el = flagOf(view.container, 'h1');
        expect(el.hasAttribute('data-flag-down')).toBe(false);
        expect(el.className).toContain('pointer-events-auto');
        const { left, top } = markerBox(BARE, false, parseFloat(el.style.width) / MARKER_ART_PX);
        expect(drawnPoint(el).x).toBeCloseTo(left);
        expect(drawnPoint(el).y).toBeCloseTo(top);
        // Hovering a Token is not hovering a spot's hero.
        view.rerender(h(DndContext, null, h(FlagLayer, { hoveredTokenId: 'anything' })));
        expect(flagOf(view.container, 'h1').getAttribute('data-flag-down')).toBe('true');
    });
});

describe('the pulse', () => {
    it('pulsePoseAt: the hop’s poses at the start of every period, home between', () => {
        const every = MARKER_PULSE_EVERY_MS;
        expect(pulsePoseAt(REACH_DOT_PULSE, every, 0)).toEqual({ x: 0, y: -2, next: 60 });
        expect(pulsePoseAt(REACH_DOT_PULSE, every, 59)).toEqual({ x: 0, y: -2, next: 60 });
        expect(pulsePoseAt(REACH_DOT_PULSE, every, 60)).toEqual({ x: 0, y: -1, next: 120 });
        expect(pulsePoseAt(REACH_DOT_PULSE, every, 120)).toEqual({ x: 0, y: 0, next: every });
        expect(pulsePoseAt(REACH_DOT_PULSE, every, every + 10)).toEqual({ x: 0, y: -2, next: every + 60 });
    });

    /** Moves the frame clock and the timers `ms` on together, running what falls due. */
    function clocks() {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const frames = manualFrames();
        return {
            frames,
            step(ms) {
                act(() => { vi.advanceTimersByTime(ms); });
                frames.frame(ms);
            }
        };
    }

    function shownSpot() {
        Orders.orderAt('h1', BARE);
        const view = mount(h(FlagLayer, { hoverHeroId: 'h1' }));
        const unit = parseFloat(flagOf(view.container, 'h1').style.width) / MARKER_ART_PX;
        return { view, unit };
    }

    it('hops in whole art pixels while shown, then rests with one timer and no frame between hops', () => {
        const { frames, step } = clocks();
        const { view, unit } = shownSpot();
        step(0);
        expect(pulseOf(view.container, 'h1').style.transform).toBe(`translate(0px, ${-2 * unit}px)`);
        step(60);
        expect(pulseOf(view.container, 'h1').style.transform).toBe(`translate(0px, ${-1 * unit}px)`);
        step(60);
        expect(pulseOf(view.container, 'h1').style.transform).toBe('');
        // At rest until the next hop: no frame asked for, one timer set.
        expect(frames.pending()).toBe(0);
        expect(vi.getTimerCount()).toBe(1);
        step(MARKER_PULSE_EVERY_MS - 120);
        expect(pulseOf(view.container, 'h1').style.transform).toBe(`translate(0px, ${-2 * unit}px)`);
    });

    it('stops, at home, when the hover ends', () => {
        const { frames, step } = clocks();
        const { view } = shownSpot();
        step(0);
        expect(pulseOf(view.container, 'h1').style.transform).not.toBe('');
        view.rerender(h(DndContext, null, h(FlagLayer, { hoverHeroId: null })));
        expect(pulseOf(view.container, 'h1').style.transform).toBe('');
        // Only the fade's own timer is left; no frame.
        expect(frames.pending()).toBe(0);
        act(() => { vi.runAllTimers(); });
        expect(vi.getTimerCount()).toBe(0);
    });

    it('pauses with the drawing (a minimised window), and goes on when it is back', () => {
        const { frames, step } = clocks();
        const { view, unit } = shownSpot();
        step(0);
        step(60);
        step(60);
        act(() => setDrawingPaused(true));
        expect(frames.pending()).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
        step(MARKER_PULSE_EVERY_MS * 3);
        expect(pulseOf(view.container, 'h1').style.transform).toBe('');
        act(() => setDrawingPaused(false));
        // Back: one look at where the pulse stands now (at rest, on its beat), then the next hop.
        step(0);
        expect(pulseOf(view.container, 'h1').style.transform).toBe('');
        expect(vi.getTimerCount()).toBe(1);
        step(MARKER_PULSE_EVERY_MS - 120);
        expect(pulseOf(view.container, 'h1').style.transform).toBe(`translate(0px, ${-2 * unit}px)`);
    });

    it('never runs for a player who asked for less motion', () => {
        vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }));
        const { frames, step } = clocks();
        const { view } = shownSpot();
        step(0);
        expect(pulseOf(view.container, 'h1').style.transform).toBe('');
        expect(frames.pending()).toBe(0);
    });
});

describe('on the mat', () => {
    const setup = () => {
        const tok = placeAt('fixture_producer', 600, 600);
        Orders.orderAt('h1', { x: tok.x, y: tok.y });
        expect(Flags.pinnedTokenOf('h1')?.id).toBe(tok.id);
        const view = mount(h(MatBoard));
        const root = view.container.querySelector('[data-mat-board]');
        root.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0 });
        return { tok, root, ...view };
    };
    const outlined = (c, id) => c.querySelector(`[data-token-art][data-token-id="${id}"]`).getAttribute('data-outline');

    it('hovering the Token shows its hero’s flag in its middle, one above it; the Token keeps the pointer', () => {
        const { tok, root, container } = setup();
        expect(flagOf(container, 'h1')).toBeNull();
        fireEvent.pointerMove(root, { clientX: tok.x, clientY: tok.y });
        const flag = flagOf(container, 'h1');
        expect(flag).not.toBeNull();
        const tokenZ = Number(container.querySelector(`[data-token-art][data-token-id="${tok.id}"]`).style.zIndex);
        expect(Number(flag.style.zIndex)).toBe(tokenZ + 1);
        expect(flag.className).toContain('pointer-events-none');
        expect(outlined(container, tok.id)).toBe('hover');
        // Its cloth is not one that takes a press over the Token.
        const box = markerBox(tok, true, parseFloat(flag.style.width) / MARKER_ART_PX);
        flag.getBoundingClientRect = () => ({ left: box.left, top: box.top, width: box.size, height: box.size, right: box.left + box.size, bottom: box.top + box.size });
        expect(flagClothOver(root, tok.x, tok.y, tok.id)).toBeNull();
    });

    it('the pointer on its cloth shows its tooltip, and the Token stays hovered', () => {
        const { tok, root, container } = setup();
        fireEvent.pointerMove(root, { clientX: tok.x, clientY: tok.y });
        const flag = flagOf(container, 'h1');
        const box = markerBox(tok, true, parseFloat(flag.style.width) / MARKER_ART_PX);
        flag.getBoundingClientRect = () => ({ left: box.left, top: box.top, width: box.size, height: box.size, right: box.left + box.size, bottom: box.top + box.size });
        const tip = () => document.body.querySelector('[data-flag-tooltip="h1"]');
        expect(tip()).toBeNull();
        fireEvent.pointerMove(root, { clientX: tok.x, clientY: tok.y });
        expect(tip()).not.toBeNull();
        expect(outlined(container, tok.id)).toBe('hover');
        // Off the cloth, still on the Token: no tooltip.
        fireEvent.pointerMove(root, { clientX: tok.x + 30, clientY: tok.y + 30 });
        expect(tip()).toBeNull();
        expect(flagOf(container, 'h1')).not.toBeNull();
    });

    it('the hero hovered on their hero bar tab shows it too', () => {
        const { container } = setup();
        expect(flagOf(container, 'h1')).toBeNull();
        act(() => setRosterHover('h1'));
        expect(flagOf(container, 'h1')).not.toBeNull();
        act(() => setRosterHover(null));
        expect(flagOf(container, 'h1')).toBeNull();
    });
});

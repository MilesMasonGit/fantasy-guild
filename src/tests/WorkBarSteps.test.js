// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { getTokenType, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { TokenBubbles } from '../ui/components/board/TokenBubbles.jsx';
import { InspectBubbles } from '../ui/components/drawer/InspectBubbles.jsx';
import { WORK_BAR_ART_W, filledSteps } from '../ui/components/board/workBar.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **The work bar is cheap.** A worked Token's bar is written only on the shared step clock (ten
 * steps a second, every bar in the same frame), and only when its fill moves by an art pixel; the
 * frames between write nothing, and an engine event never writes it. (The cycle ring it replaced
 * was moved onto this clock in brief 60 because rings written on frames of their own put a
 * repaint in nearly every frame of play.) Each frame here records what was written inside the
 * bars: a MutationObserver's records, so every kind of write counts.
 */

const h = React.createElement;
const tree = (...els) => h(DndContext, null, ...els);
const token = (id, extra = {}) => ({ typeId: 'fixture_producer', instanceId: id, heroId: 'hero_1', alert: null, usesRemaining: null, ...extra });
const rows = (ids, extra = {}) => tree(...ids.map(id => h(TokenBubbles, { key: id, instanceId: id, token: token(id, extra[id]) })));

const progressPayload = (id, elapsedMs, cycleTimeMs) => ({
    instanceId: id, percent: (elapsedMs / cycleTimeMs) * 100, elapsedMs, cycleTimeMs
});
const progress = (id, elapsedMs, cycleTimeMs) => act(() => {
    EventBus.publish(BOARD_EVENTS.PROGRESS, progressPayload(id, elapsedMs, cycleTimeMs));
});
const complete = (id) => act(() => { EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: id }); });

const barOf = (c, id) => c.querySelector(`[data-work-bar="${id}"]`);
/** Art pixels filled. */
const fillOf = (c, id) => Number(barOf(c, id).getAttribute('data-work-bar-fill'));

// A page clock: `performance.now()`, timers and animation frames all move together, a frame
// every 6 ms (the owner's 165 Hz screen).
let queue;      // [{ id, cb }]: requested animation frames
let nextId;
let clock;
let watcher = null;

/** One frame: the time passes, due timers fire, then the frame's callbacks. Returns what it wrote. */
function frame(ms = 6) {
    clock += ms;
    vi.advanceTimersByTime(ms);
    const due = queue;
    queue = [];
    for (const { cb } of due) cb(clock);
    return written();
}
const frames = (n, ms = 6) => Array.from({ length: n }, () => frame(ms));
/** Frames until one writes a bar; the clock at that frame. */
function untilWrite(limit = 100) {
    for (let i = 0; i < limit; i++) {
        if (frame().size) return clock;
    }
    throw new Error('no bar was written');
}

function watch(container) {
    watcher?.disconnect();
    watcher = new MutationObserver(() => {});
    watcher.observe(container, { attributes: true, characterData: true, childList: true, subtree: true });
}
/** The Tokens whose bar was written since the last call. */
function written() {
    const ids = new Set();
    for (const r of watcher?.takeRecords() ?? []) {
        const el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
        const bar = el?.closest?.('[data-work-bar]');
        if (bar) ids.add(bar.getAttribute('data-work-bar'));
    }
    return ids;
}

beforeEach(() => {
    queue = [];
    nextId = 1;
    clock = 1003;   // off any step grid
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('requestAnimationFrame', (cb) => { const id = nextId++; queue.push({ id, cb }); return id; });
    vi.stubGlobal('cancelAnimationFrame', (id) => { queue = queue.filter(q => q.id !== id); });
});

afterEach(() => {
    watcher?.disconnect();
    watcher = null;
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('⭐ the work bar steps on one shared clock', () => {
    const ids = ['ra', 'rb', 'rc', 'rd', 're'];
    function fiveRunning() {
        const r = render(rows(ids));
        // 2 s cycles (an art pixel each 50 ms), each at its own place: every step moves every bar.
        ids.forEach((id, i) => progress(id, 130 * i, 2000));
        watch(r.container);
        return r;
    }

    it('⭐ a running cycle writes its bar at most ten times a second, never every frame', () => {
        const { container } = fiveRunning();
        const log = frames(250);                        // 1.5 s
        const writing = log.filter(s => s.size > 0);
        expect(writing.length).toBeLessThanOrEqual(16);
        expect(writing.length).toBeGreaterThanOrEqual(12); // and it still moves, ~10 times a second
        expect(log.filter(s => s.size === 0).length).toBeGreaterThanOrEqual(234);
        ids.forEach((id, i) => {
            expect(fillOf(container, id) / WORK_BAR_ART_W).toBeCloseTo(Math.min(1, (130 * i + 1500) / 2000), 1);
        });
    });

    it('⭐ every running bar steps in the same frame', () => {
        fiveRunning();
        const writing = frames(150).filter(s => s.size > 0);
        expect(writing.length).toBeGreaterThan(0);
        for (const s of writing) expect([...s].sort()).toEqual([...ids].sort());
    });

    it('a slow cycle writes only when it moves a whole art pixel', () => {
        const { container } = render(rows(['ra']));
        progress('ra', 0, 40000);                       // one art pixel a second
        watch(container);
        const writing = frames(500).filter(s => s.size > 0);   // 3 s
        expect(writing.length).toBeLessThanOrEqual(4);
        expect(writing.length).toBeGreaterThanOrEqual(2);
    });

    it('⭐ the bar shows the cycle as it stands at the step: the start, half way, the end, and again after CYCLE_COMPLETE', () => {
        const { container } = render(rows(['ra']));
        const t0 = clock;
        progress('ra', 0, 4000);
        watch(container);

        let at = untilWrite();
        expect(fillOf(container, 'ra')).toBe(filledSteps((at - t0) / 4000, WORK_BAR_ART_W));

        while (clock < t0 + 2000) frame();
        at = untilWrite();
        expect(fillOf(container, 'ra')).toBe(filledSteps((at - t0) / 4000, WORK_BAR_ART_W));
        expect(Math.abs(fillOf(container, 'ra') - WORK_BAR_ART_W / 2)).toBeLessThanOrEqual(2);

        while (clock < t0 + 3600) frame();
        progress('ra', clock - t0, 4000);                      // the engine's tick, as it comes
        while (clock < t0 + 4300) frame();
        expect(fillOf(container, 'ra')).toBe(WORK_BAR_ART_W);  // full, held until the engine says

        const tc = clock;
        complete('ra');
        at = untilWrite();
        expect(fillOf(container, 'ra')).toBe(filledSteps((at - tc) / 4000, WORK_BAR_ART_W));
        expect(fillOf(container, 'ra')).toBeLessThan(2);
    });

    it('⭐ engine events never write the bar: a time-skip lands on its last progress at the next step', () => {
        const { container } = render(rows(['ra']));
        progress('ra', 0, 12000);
        frames(40);
        watch(container);
        const tSkip = clock;
        act(() => {
            // 30 s of play at once, as the dev time-skip runs it: progress every 300 ms, a
            // completion every 12 s, ending 6 s into a cycle.
            let elapsed = 0;
            for (let t = 300; t <= 30000; t += 300) {
                elapsed += 300;
                if (elapsed >= 12000) {
                    elapsed -= 12000;
                    EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: 'ra' });
                } else {
                    EventBus.publish(BOARD_EVENTS.PROGRESS, progressPayload('ra', elapsed, 12000));
                }
            }
        });
        expect(written().size).toBe(0);
        const at = untilWrite();
        expect(fillOf(container, 'ra')).toBe(filledSteps((6000 + at - tSkip) / 12000, WORK_BAR_ART_W));
    });

    it('⭐ a blocked bar holds: grey, nothing written or scheduled after, late ticks ignored', () => {
        const { container, rerender } = render(rows(['ra']));
        progress('ra', 1500, 3000);
        frames(50);                                      // 0.3 s
        rerender(rows(['ra'], { ra: { alert: ALERT.INPUTS } }));
        expect(barOf(container, 'ra').getAttribute('data-work-bar-blocked')).toBe('true');
        const held = fillOf(container, 'ra');
        expect(held / WORK_BAR_ART_W).toBeCloseTo(0.6, 1);

        watch(container);
        const log = frames(500);
        expect(log.every(s => s.size === 0)).toBe(true);
        progress('ra', 2700, 3000);
        complete('ra');
        frames(50);
        expect(fillOf(container, 'ra')).toBe(held);
        expect(queue).toHaveLength(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('nothing is scheduled once the last bar stops', () => {
        const { rerender } = render(rows(['ra', 'rb']));
        progress('ra', 1000, 16000);
        progress('rb', 1000, 16000);
        frames(40);
        rerender(rows(['ra', 'rb'], { ra: { heroId: null }, rb: { heroId: null } }));
        expect(queue).toHaveLength(0);
        expect(vi.getTimerCount()).toBe(0);
        frames(200);
        expect(queue).toHaveLength(0);
    });

    it('a bar that remounts mid-cycle (after a drag) shows its place at once, not empty until the next step', () => {
        const { container, rerender } = render(rows(['ra']));
        progress('ra', 6000, 12000);
        frames(20);
        rerender(tree(h(TokenBubbles, { key: 'ra', instanceId: 'ra', token: token('ra'), isDragging: true })));
        expect(barOf(container, 'ra')).toBeNull();
        frames(5);
        rerender(rows(['ra']));
        expect(fillOf(container, 'ra') / WORK_BAR_ART_W).toBeCloseTo((6000 + 150) / 12000, 1);
    });
});

describe('⭐ the inspection’s time and XP rings draw the bar’s cycle', () => {
    const AT = { x: 400, y: 300 };

    beforeAll(() => Flags.init());
    afterAll(() => Flags.teardown());
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        GameState.state.heroes = [
            { id: 'h1', name: 'h1', status: 'idle', level: 50, skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } }
        ];
    });

    const inspectRing = (c, name) => c.querySelector(`[data-inspect-bubble="${name}"] [data-ring]`);

    it('⭐ within an art pixel of the bar in the same frame: running, blocked, and after CYCLE_COMPLETE', () => {
        const forest = BoardState.createTokenInstance('fixture_producer', tokenStartingUses('fixture_producer'));
        Placement.placeTokenAt(forest, AT);
        Flags.plant('h1', AT);
        expect(BoardState.workerOf(forest.id)).toBe('h1');
        const matToken = (extra = {}) => ({ typeId: 'fixture_producer', instanceId: forest.id, heroId: 'h1', alert: null, usesRemaining: 5000, ...extra });
        const both = (extra) => tree(
            h(TokenBubbles, { key: 'mat', instanceId: forest.id, token: matToken(extra) }),
            h(InspectBubbles, { key: 'inspect', def: getTokenType('fixture_producer'), instanceId: forest.id })
        );
        const { container, rerender } = render(both());
        const agree = () => {
            const bar = fillOf(container, forest.id);
            const ring = Number(inspectRing(container, 'time').getAttribute('data-ring-fraction'));
            expect(filledSteps(ring, WORK_BAR_ART_W)).toBe(bar);
            expect(inspectRing(container, 'xp').getAttribute('data-ring-fraction')).toBe(inspectRing(container, 'time').getAttribute('data-ring-fraction'));
            return bar;
        };

        progress(forest.id, 3000, 12000);
        watch(container);
        untilWrite();
        for (let i = 0; i < 200; i++) { frame(); agree(); }
        expect(agree() / WORK_BAR_ART_W).toBeGreaterThan(0.3);
        expect(inspectRing(container, 'xp').getAttribute('data-ring-text')).toBe('+4');

        // Blocked: the bar holds, and so do the inspection's rings.
        rerender(both({ alert: ALERT.INPUTS }));
        frames(40);
        const held = agree();
        frames(200);
        expect(agree()).toBe(held);

        rerender(both());
        complete(forest.id);
        progress(forest.id, 300, 12000);
        frames(40);
        expect(agree() / WORK_BAR_ART_W).toBeLessThan(0.1);
    });
});

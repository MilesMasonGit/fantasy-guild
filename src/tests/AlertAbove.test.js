// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { ALERT } from '../systems/board/boardEvents.js';
import { TokenBubbles } from '../ui/components/board/TokenBubbles.jsx';
import { ProblemMark } from '../ui/components/board/ProblemMark.jsx';
import { setDrawingPaused } from '../ui/components/board/frameClock.js';
import {
    ALERT_BOB_STOPS, ALERT_BOB_STOP_MS, ALERT_BOB_PERIOD_MS, alertBobAt
} from '../ui/components/board/alertBob.js';

/**
 * ⭐ **The alert "!" stands above the Token's art and bobs** (owner, 2026-11-20). It was centred
 * in an unworked Token; now it sits on the art's top edge, on a worked Token too (its plate keeps
 * the words), and rises two whole art pixels and sinks again on a slow loop. The bob is written on
 * the shared sprite clock, only when a stop changes, so it costs nothing between stops and stops
 * with every other clock while drawing is paused (minimised). A mark can also be placed anywhere
 * (where an event stood).
 */

const h = React.createElement;
const BENCH = 'fixture_alert_above_bench';

let queue;
let nextId;
let clock;
let framesAsked;

function frame(ms = 6) {
    act(() => {
        clock += ms;
        vi.advanceTimersByTime(ms);
        const due = queue;
        queue = [];
        for (const { cb } of due) cb(clock);
    });
}

const lift = (el) => {
    const m = /^translateY\((-?[\d.]+)px\)$/.exec(el.style.transform);
    return m ? -Number(m[1]) : 0;
};

/** The heights a mark shows over `ms`, in art pixels, each change once. */
function watch(el, unit, ms) {
    const seen = [lift(el) / unit];
    for (let t = 0; t < ms; t += 6) {
        frame();
        const k = lift(el) / unit;
        if (k !== seen[seen.length - 1]) seen.push(k);
    }
    return seen;
}

const token = (alert, heroId = null) => ({ typeId: BENCH, instanceId: 'tb1', heroId, alert });

beforeEach(() => {
    queue = [];
    nextId = 1;
    clock = 0;
    framesAsked = 0;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('requestAnimationFrame', (cb) => { framesAsked++; const id = nextId++; queue.push({ id, cb }); return id; });
    vi.stubGlobal('cancelAnimationFrame', (id) => { queue = queue.filter(q => q.id !== id); });
});

afterEach(() => {
    cleanup();
    setDrawingPaused(false);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('the bob, as a table', () => {
    it('whole art pixels, 0 to 2, on a slow loop', () => {
        expect(ALERT_BOB_STOPS.every(Number.isInteger)).toBe(true);
        expect([Math.min(...ALERT_BOB_STOPS), Math.max(...ALERT_BOB_STOPS)]).toEqual([0, 2]);
        expect(ALERT_BOB_PERIOD_MS).toBeGreaterThanOrEqual(1200);
        expect(alertBobAt(0)).toBe(ALERT_BOB_STOPS[0]);
        expect(alertBobAt(ALERT_BOB_PERIOD_MS + 2 * ALERT_BOB_STOP_MS)).toBe(ALERT_BOB_STOPS[2]);
    });
});

describe('⭐ where the "!" stands', () => {
    it('on the art\'s top edge, centred: the art is centred in the box', () => {
        const { container } = render(h(TokenBubbles, { instanceId: 'tb1', token: token(ALERT.NO_ROOM), boxPx: 160, artPx: 128, artUnit: 2 }));
        const row = container.querySelector('[data-bubble-row="above"]');
        expect(row).not.toBeNull();
        expect(row.style.top).toBe('16px');
        expect(row.style.transform).toBe('translateY(-100%)');
        expect(row.style.width).toBe('160px');
        expect(row.querySelector('[data-problem-mark]')).not.toBeNull();
        expect(container.querySelector('[data-bubble-row="middle"]')).toBeNull();
    });

    it('⭐ a worked Token with a problem wears it too', () => {
        const { container } = render(h(TokenBubbles, { instanceId: 'tb1', token: token(ALERT.INPUTS, 'h1'), boxPx: 128, artPx: 128, artUnit: 2 }));
        expect(container.querySelector('[data-bubble-row="above"] [data-problem-mark]')).not.toBeNull();
    });

    it('the demolition mark keeps the middle', () => {
        const { container } = render(h(TokenBubbles, { instanceId: 'tb1', token: token(null), marked: true }));
        expect(container.querySelector('[data-bubble-row="middle"]')).not.toBeNull();
        expect(container.querySelector('[data-bubble-row="above"]')).toBeNull();
    });

    it('a mark can be placed anywhere: where an event stood', () => {
        const problem = { kind: ALERT.NO_ROOM, severity: 'cant' };
        const { container } = render(h(ProblemMark, { problem, tip: 'x', style: { position: 'absolute', left: 300, top: 200 } }));
        const mark = container.querySelector('[data-problem-mark]');
        expect([mark.style.position, mark.style.left, mark.style.top]).toEqual(['absolute', '300px', '200px']);
    });
});

describe('⭐ the bob', () => {
    const problem = { kind: ALERT.NO_ROOM, severity: 'cant' };

    it('steps through the stops in whole art pixels, at any art unit', () => {
        for (const unit of [2, 3]) {
            clock = 0;
            const { container, unmount } = render(h(ProblemMark, { problem, tip: 'x', artUnit: unit }));
            const el = container.querySelector('[data-problem-mark]');
            expect(watch(el, unit, ALERT_BOB_PERIOD_MS)).toEqual([0, 1, 2, 1, 0]);
            unmount();
        }
    });

    it('⭐ costs nothing between stops: a frame only when a stop falls due', () => {
        render(h(ProblemMark, { problem, tip: 'x' }));
        framesAsked = 0;
        for (let t = 0; t < 4 * ALERT_BOB_PERIOD_MS; t += 6) frame();
        // One frame a stop, no more.
        expect(framesAsked).toBeLessThanOrEqual(4 * ALERT_BOB_STOPS.length + 1);
    });

    it('⭐ stops while drawing is paused (minimised), and goes on when it is back', () => {
        const { container } = render(h(ProblemMark, { problem, tip: 'x' }));
        const el = container.querySelector('[data-problem-mark]');
        for (let t = 0; t < ALERT_BOB_STOP_MS * 2 + 10; t += 6) frame();
        const held = el.style.transform;
        expect(held).not.toBe('');
        setDrawingPaused(true);
        framesAsked = 0;
        for (let t = 0; t < 3 * ALERT_BOB_PERIOD_MS; t += 6) frame();
        expect(el.style.transform).toBe(held);
        expect(framesAsked).toBe(0);
        setDrawingPaused(false);
        expect(watch(el, 2, ALERT_BOB_PERIOD_MS).length).toBeGreaterThan(1);
    });

    it('with reduced motion the mark stands still', () => {
        vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }));
        const { container } = render(h(ProblemMark, { problem, tip: 'x' }));
        const el = container.querySelector('[data-problem-mark]');
        expect(watch(el, 2, ALERT_BOB_PERIOD_MS)).toEqual([0]);
    });

    it('the gear that stands in a choice\'s "!" does not bob', () => {
        const gear = { show: true, pulsing: true, isFoundation: false, recipe: null, onClick: () => {} };
        const { container } = render(h(TokenBubbles, { instanceId: 'tb1', token: token(null), gear, pointerOn: true }));
        const inMark = container.querySelector('[data-bubble-row="above"] [data-gear-in-mark]');
        expect(inMark).not.toBeNull();
        for (let t = 0; t < ALERT_BOB_PERIOD_MS; t += 6) frame();
        expect(inMark.style.transform).toBe('');
        expect(container.querySelector('[data-problem-mark]')).toBeNull();
    });
});

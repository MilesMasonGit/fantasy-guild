// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { Profiler } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { TutorialBeacon } from '../ui/components/base/TutorialAideOverlay.jsx';

/**
 * ⭐ **A tutorial beacon re-renders only when its target moves**, and **looks for its target
 * only a few times a second, never every frame, while the target is missing or still** (brief
 * 60, cause #5: two beacons each queried the whole document every animation frame for the whole
 * recruit-hero step). It still follows a moving target, and goes and comes back with it.
 */

const h = React.createElement;

// A page clock: `performance.now()`, timers and animation frames all move together, a frame
// every 6 ms (the owner's 165 Hz screen).
let queue;      // [{ id, cb }]: requested animation frames
let nextId;
let clock;
let commits;
let queries;    // document.querySelector calls
let boxReads;   // the target's getBoundingClientRect calls

/** One frame: the time passes, due timers fire, then the frame's callbacks. Returns what it read. */
function frame(ms = 6) {
    const q0 = queries;
    const b0 = boxReads;
    act(() => {
        clock += ms;
        vi.advanceTimersByTime(ms);
        const due = queue;
        queue = [];
        for (const { cb } of due) cb(clock);
    });
    return { queries: queries - q0, boxReads: boxReads - b0 };
}
const frames = (n) => Array.from({ length: n }, () => frame());
const looked = (f) => f.queries + f.boxReads > 0;

let target;
let rect;

beforeEach(() => {
    queue = [];
    nextId = 1;
    clock = 1003;   // off any step grid
    commits = 0;
    queries = 0;
    boxReads = 0;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('requestAnimationFrame', (cb) => { const id = nextId++; queue.push({ id, cb }); return id; });
    vi.stubGlobal('cancelAnimationFrame', (id) => { queue = queue.filter(q => q.id !== id); });
    const realQuery = document.querySelector.bind(document);
    vi.spyOn(document, 'querySelector').mockImplementation((sel) => { queries++; return realQuery(sel); });
    rect = { left: 100, top: 200, width: 80, height: 40 };
    target = document.createElement('div');
    target.setAttribute('data-beacon-target', 'true');
    target.getBoundingClientRect = () => {
        boxReads++;
        return { ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top };
    };
    document.body.appendChild(target);
});

afterEach(() => {
    cleanup();
    target.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const mountBeacon = () => render(h(Profiler, { id: 'beacon', onRender: () => { commits++; } },
    h(TutorialBeacon, { target: '[data-beacon-target]', keyId: 'b' })));

const beaconEl = () => document.querySelector('div[style*="position: fixed"]');
/** The beacon's left edge, or null when it is not drawn. Not counted as the beacon's own query. */
function beaconLeft() {
    queries--;
    const el = beaconEl();
    return el ? el.style.left : null;
}
// Centred on the target: radius max(40, 40 + 18) = 58.
const leftFor = (r) => `${r.left + r.width / 2 - 58}px`;

describe('⭐ the beacon tracks its target without re-rendering every frame', () => {
    it('a still target: frames go by, no re-render', () => {
        mountBeacon();
        frames(20);
        const settled = commits;
        frames(50);
        expect(commits - settled).toBe(0);
    });

    it('a moving target: it follows within one step, one re-render per move', () => {
        mountBeacon();
        frames(20);
        const settled = commits;
        rect = { ...rect, left: 160 };
        frames(17);                                    // one step (100 ms) and a frame
        // The move, plus at most React's one confirming pass before it bails out.
        expect(commits - settled).toBeGreaterThanOrEqual(1);
        expect(commits - settled).toBeLessThanOrEqual(2);
        const moved = commits;
        frames(30);
        expect(commits - moved).toBe(0);
        expect(beaconLeft()).toBe(leftFor(rect));
    });
});

describe('⭐ the beacon does not look every frame while its target is missing or still', () => {
    it('⭐ a still target: no document query and no box read between steps', () => {
        mountBeacon();
        frames(20);
        const log = frames(167);                       // ~1 s
        // At most one look a step (ten a second), never every frame.
        expect(log.filter(looked).length).toBeLessThanOrEqual(11);
        expect(log.filter(f => !looked(f)).length).toBeGreaterThanOrEqual(156);
        expect(log.reduce((n, f) => n + f.queries, 0)).toBeLessThanOrEqual(11);
        expect(log.reduce((n, f) => n + f.boxReads, 0)).toBeLessThanOrEqual(11);
        expect(beaconLeft()).toBe(leftFor(rect));
    });

    it('⭐ a missing target: no document query between steps, and it appears within one step', () => {
        target.remove();
        mountBeacon();
        const log = frames(167);
        expect(log.filter(looked).length).toBeLessThanOrEqual(11);
        expect(log.reduce((n, f) => n + f.queries, 0)).toBeLessThanOrEqual(11);
        expect(beaconLeft()).toBeNull();

        document.body.appendChild(target);
        frames(17);
        expect(beaconLeft()).toBe(leftFor(rect));
    });

    it('⭐ follows a moving target every frame (a hero walking), then stops reading once it stands still', () => {
        mountBeacon();
        frames(20);
        // Walks 2 px a frame for 60 frames.
        let lagging = 0;
        for (let i = 0; i < 60; i++) {
            rect = { ...rect, left: rect.left + 2 };
            frame();
            if (i >= 17 && beaconLeft() !== leftFor(rect)) lagging++;
        }
        // Caught within one step of starting, then on the target every frame.
        expect(lagging).toBe(0);
        // Stopped: it settles back to looking once a step.
        frames(20);
        const log = frames(167);
        expect(log.filter(looked).length).toBeLessThanOrEqual(11);
        expect(beaconLeft()).toBe(leftFor(rect));
    });

    it('⭐ goes when the target is removed and comes back when it returns', () => {
        mountBeacon();
        frames(20);
        expect(beaconLeft()).toBe(leftFor(rect));
        target.remove();
        frames(17);
        expect(beaconLeft()).toBeNull();
        rect = { ...rect, left: 300 };
        document.body.appendChild(target);
        frames(17);
        expect(beaconLeft()).toBe(leftFor(rect));
    });

    it('a resolver function: looked up once a step, not every frame', () => {
        const resolver = vi.fn(() => document.querySelector('[data-beacon-target]'));
        render(h(TutorialBeacon, { target: resolver, keyId: 'r' }));
        frames(20);
        resolver.mockClear();
        frames(167);
        expect(resolver.mock.calls.length).toBeLessThanOrEqual(11);
        expect(beaconLeft()).toBe(leftFor(rect));
    });
});

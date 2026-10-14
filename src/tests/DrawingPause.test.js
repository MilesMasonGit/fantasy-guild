// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { onFrame, onStep, onDue, setDrawingPaused, isDrawingPaused } from '../ui/components/board/frameClock.js';
import { installDrawingPause, WINDOW_MINIMISED_EVENT } from '../ui/drawingPause.js';
import { GameLoop } from '../systems/core/GameLoop.js';

/**
 * ⭐ **A hidden or minimised window draws nothing, and the game keeps playing.** The desktop
 * app's webview is never told it is minimised, so it kept drawing at full rate; the Tauri side
 * forwards minimise and restore as a window event, the page's own `visibilitychange` covers a
 * hidden browser tab, and the mat's clocks (`frameClock.js`) stop asking for animation frames
 * until the window is back. Coming back draws one frame, not the frames it missed. The engine's
 * tick is a timer of its own and never pauses (concept_offline_progress: a minimised game runs).
 */

let queue;      // [{ id, cb }]
let nextId;
let clock;
let subs;
let uninstall;
let hidden;
const frameSub = (fn) => { const off = onFrame(fn); subs.push(off); return off; };
const stepSub = (fn) => { const off = onStep(fn); subs.push(off); return off; };
const dueSub = (fn, at) => { const off = onDue(fn, at); subs.push(off); return off; };
/** One frame: time passes, due timers fire, then the frame's callbacks. */
function frame(ms = 6) {
    clock += ms;
    vi.advanceTimersByTime(ms);
    const due = queue;
    queue = [];
    for (const { cb } of due) cb(clock);
}
/** `ms` of frames at ~165 a second, the rate the minimised desktop app was measured drawing at. */
function frames(ms) {
    for (let t = 0; t < ms; t += 6) frame(6);
}
function setHidden(h) {
    hidden = h;
    document.dispatchEvent(new Event('visibilitychange'));
}
function setMinimised(m) {
    window.dispatchEvent(new CustomEvent(WINDOW_MINIMISED_EVENT, { detail: m }));
}

beforeEach(() => {
    queue = [];
    nextId = 1;
    clock = 1003;
    subs = [];
    hidden = false;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    vi.stubGlobal('requestAnimationFrame', (cb) => { const id = nextId++; queue.push({ id, cb }); return id; });
    vi.stubGlobal('cancelAnimationFrame', (id) => { queue = queue.filter(q => q.id !== id); });
    uninstall = installDrawingPause();
});

afterEach(() => {
    uninstall();
    setDrawingPaused(false);
    subs.forEach(off => off());
    GameLoop.stop();
    GameLoop.offTick('drawingPauseTest');
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('⭐ the window listener', () => {
    it('a hidden page pauses drawing, and showing it resumes', () => {
        expect(isDrawingPaused()).toBe(false);
        setHidden(true);
        expect(isDrawingPaused()).toBe(true);
        setHidden(false);
        expect(isDrawingPaused()).toBe(false);
    });

    it('the desktop app minimised pauses drawing, and restored resumes', () => {
        setMinimised(true);
        expect(isDrawingPaused()).toBe(true);
        setMinimised(false);
        expect(isDrawingPaused()).toBe(false);
    });

    it('drawing resumes only once the window is neither hidden nor minimised', () => {
        setMinimised(true);
        setHidden(true);
        setMinimised(false);
        expect(isDrawingPaused()).toBe(true);
        setHidden(false);
        expect(isDrawingPaused()).toBe(false);
    });

    it('a page already hidden when it is installed starts paused', () => {
        uninstall();
        setDrawingPaused(false);
        hidden = true;
        uninstall = installDrawingPause();
        expect(isDrawingPaused()).toBe(true);
    });
});

describe('⭐ onFrame stops while hidden and resumes without a burst', () => {
    it('no frame is asked for or run for 2 s hidden; one frame a frame once shown', () => {
        const calls = [];
        frameSub((now) => calls.push(now));
        frames(60);
        const before = calls.length;
        expect(before).toBeGreaterThan(5);

        setMinimised(true);
        expect(queue.length).toBe(0);
        frames(2000);
        expect(calls.length).toBe(before);

        setMinimised(false);
        expect(queue.length).toBe(1);
        frame();
        expect(calls.length).toBe(before + 1);
        frame();
        expect(calls.length).toBe(before + 2);
    });

    it('a subscriber that joins while hidden waits for the window to come back', () => {
        setHidden(true);
        const calls = [];
        frameSub((now) => calls.push(now));
        frames(500);
        expect(calls).toHaveLength(0);
        setHidden(false);
        frame();
        expect(calls).toHaveLength(1);
    });
});

describe('⭐ onStep stops while hidden and resumes with one step', () => {
    it('no step for 2 s hidden; the first step after is one call, not the twenty missed', () => {
        const calls = [];
        stepSub((now) => calls.push(now));
        frames(1000);
        const before = calls.length;
        expect(before).toBeGreaterThanOrEqual(9);

        setHidden(true);
        expect(queue.length).toBe(0);
        frames(2000);
        expect(calls.length).toBe(before);

        setHidden(false);
        frames(100);
        expect(calls.length).toBe(before + 1);
        frames(1000);
        expect(calls.length).toBeLessThanOrEqual(before + 11);
    });
});

describe('⭐ onDue stops while hidden and resumes in one frame', () => {
    it('subscribers due while hidden are not called; once shown, each is called once, in one frame', () => {
        const a = [];
        const b = [];
        dueSub((now) => { a.push(now); return now + 125; }, clock + 125);
        dueSub((now) => { b.push(now); return now + 300; }, clock + 300);
        setMinimised(true);
        frames(2000);
        expect(a).toHaveLength(0);
        expect(b).toHaveLength(0);
        expect(queue.length).toBe(0);

        // The usual wake-up timer first (due already: 0 ms), then one frame for both.
        setMinimised(false);
        frame();
        frame();
        expect(a).toHaveLength(1);
        expect(b).toHaveLength(1);
        expect(a[0]).toBe(b[0]);
        frames(60);
        expect(a).toHaveLength(1);
    });
});

describe('⭐ the game keeps playing while drawing is paused', () => {
    it('GameLoop ticks ten times a second, hidden or not', () => {
        let ticks = 0;
        GameLoop.onTick('drawingPauseTest', () => { ticks++; });
        GameLoop.start();
        setMinimised(true);
        setHidden(true);
        vi.advanceTimersByTime(2000);
        expect(isDrawingPaused()).toBe(true);
        expect(ticks).toBe(20);
    });
});

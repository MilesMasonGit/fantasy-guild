// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { onFrame, onStep, STEP_MS } from '../ui/components/board/frameClock.js';

/**
 * ⭐ **One loop for many subscribers** (R6 rule 2): `onFrame` is one animation-frame loop,
 * `onStep` one stepped clock whose subscribers all run in the same frame. What the cycle rings do
 * with it is pinned in `CycleRingSteps.test.js`.
 */

let queue;      // [{ id, cb }]
let nextId;
let clock;
/** Every subscription a test makes, so a failing test cannot leave the clocks running. */
let subs;
const frameSub = (fn) => { const off = onFrame(fn); subs.push(off); return off; };
const stepSub = (fn) => { const off = onStep(fn); subs.push(off); return off; };
/** One frame: time passes, due timers fire, then the frame's callbacks. */
function frame(ms = 6) {
    clock += ms;
    vi.advanceTimersByTime(ms);
    const due = queue;
    queue = [];
    for (const { cb } of due) cb(clock);
}

beforeEach(() => {
    queue = [];
    nextId = 1;
    clock = 1003;
    subs = [];
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('requestAnimationFrame', (cb) => { const id = nextId++; queue.push({ id, cb }); return id; });
    vi.stubGlobal('cancelAnimationFrame', (id) => { queue = queue.filter(q => q.id !== id); });
});

afterEach(() => {
    subs.forEach(off => off());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('⭐ onFrame: one animation-frame loop', () => {
    it('three subscribers ask for one frame a frame, not three, and each gets the frame time', () => {
        const calls = [[], [], []];
        const offs = calls.map(log => frameSub((now) => log.push(now)));
        expect(queue.length).toBe(1);
        for (let i = 0; i < 10; i++) {
            frame();
            expect(queue.length).toBe(1);
        }
        for (const log of calls) expect(log).toHaveLength(10);
        expect(calls[0]).toEqual(calls[2]);
        offs.forEach(off => off());
    });

    it('stops asking for frames when the last subscriber leaves', () => {
        const a = frameSub(() => {});
        const b = frameSub(() => {});
        frame();
        a();
        expect(queue.length).toBe(1);
        b();
        expect(queue.length).toBe(0);
        frame(1000);
        expect(queue.length).toBe(0);
    });
});

describe('⭐ onStep: STEP_MS apart, every subscriber in the same frame', () => {
    it('ten steps a second', () => {
        expect(STEP_MS).toBe(100);
    });

    it('three subscribers share one timer and one frame, called together with the same now', () => {
        const calls = [[], [], []];
        const offs = calls.map(log => stepSub((now) => log.push(now)));
        expect(vi.getTimerCount()).toBe(1);
        expect(queue.length).toBe(0);
        let stepFrames = 0;
        for (let i = 0; i < 500; i++) {          // 3 s at 165 Hz
            const before = calls[0].length;
            frame();
            if (calls[0].length > before) stepFrames += 1;
            // Between steps nothing asks for a frame: at most the one the step drew in.
            expect(queue.length).toBe(0);
            expect(vi.getTimerCount()).toBe(1);
        }
        expect(stepFrames).toBe(calls[0].length);
        expect(calls[0].length).toBeGreaterThanOrEqual(29);
        expect(calls[0].length).toBeLessThanOrEqual(30);
        expect(calls[1]).toEqual(calls[0]);
        expect(calls[2]).toEqual(calls[0]);
        offs.forEach(off => off());
    });

    it('steps fall on one grid, so a late frame does not push the next step back', () => {
        const at = [];
        const off = stepSub((now) => at.push(now));
        frame(96);                // 1099: not yet
        frame(31);                // the step's timer fired at 1100; its frame is a slow one, at 1130
        for (let i = 0; i < 20; i++) frame(6);
        expect(at[0]).toBe(1130);
        expect(at[1]).toBeGreaterThanOrEqual(1200);
        expect(at[1]).toBeLessThan(1206);
        off();
    });

    it('stops (timer and frame cancelled) when the last subscriber leaves, and starts again', () => {
        const a = stepSub(() => {});
        const b = stepSub(() => {});
        frame(100);
        a();
        expect(vi.getTimerCount() + queue.length).toBe(1);
        b();
        expect(vi.getTimerCount()).toBe(0);
        expect(queue.length).toBe(0);
        const log = [];
        const c = stepSub((now) => log.push(now));
        for (let i = 0; i < 40; i++) frame();
        expect(log.length).toBeGreaterThanOrEqual(2);
        c();
    });

    it('a subscriber may unsubscribe another mid-step', () => {
        const log = [];
        let offB = null;
        const offA = stepSub(() => { log.push('a'); offB?.(); offB = null; });
        offB = stepSub(() => log.push('b'));
        for (let i = 0; i < 40; i++) frame();
        expect(log.filter(x => x === 'b')).toHaveLength(0);
        expect(log.filter(x => x === 'a').length).toBeGreaterThanOrEqual(2);
        offA();
    });
});

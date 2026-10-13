// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { onFrame, onStep, onDue, STEP_MS } from '../ui/components/board/frameClock.js';

/**
 * ⭐ **One loop for many subscribers** (R6 rule 2): `onFrame` is one animation-frame loop,
 * `onStep` one stepped clock whose subscribers all run in the same frame, `onDue` one timer and
 * one frame for subscribers due at times of their own. What the cycle rings do with it is pinned
 * in `CycleRingSteps.test.js`, the sprites in `SpriteClock.test.js`.
 */

let queue;      // [{ id, cb }]
let nextId;
let clock;
/** Every subscription a test makes, so a failing test cannot leave the clocks running. */
let subs;
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

describe('⭐ onDue: each subscriber at its own times, everyone due by a frame in that frame', () => {
    it('one timer for the soonest; everyone due by the frame it wakes is called in it, with the same now', () => {
        const log = [];
        dueSub((now) => { log.push(['a', now]); return now + 50; }, 1047);
        dueSub((now) => { log.push(['b', now]); return now + 50; }, 1050);
        dueSub((now) => { log.push(['c', now]); return now + 50; }, 1080);
        expect(vi.getTimerCount()).toBe(1);
        while (clock < 1045) frame();
        expect(log).toEqual([]);
        frame();                                     // the timer for 1047 fired; its frame is at 1051
        expect(log).toEqual([['a', 1051], ['b', 1051]]);
        expect(vi.getTimerCount() + queue.length).toBe(1);
        while (clock < 1075) frame();
        expect(log).toHaveLength(2);
        frame();
        expect(log.slice(2)).toEqual([['c', 1081]]);
    });

    it('a subscriber due rarely is called only when due, never by the others’ frames', () => {
        const often = [];
        const rare = [];
        dueSub((now) => { often.push(now); return now + 100; }, clock + 100);
        dueSub((now) => { rare.push(now); return now + 1000; }, clock + 1000);
        for (let i = 0; i < 500; i++) {              // 3 s
            frame();
            expect(vi.getTimerCount() + queue.length).toBeLessThanOrEqual(1);
        }
        expect(often.length).toBeGreaterThanOrEqual(28);
        expect(rare).toHaveLength(2);
        expect(rare[0]).toBeGreaterThanOrEqual(2003);
        expect(rare[0]).toBeLessThan(2003 + 6);
        expect(rare[1] - rare[0]).toBeGreaterThanOrEqual(1000);
    });

    it('no frame drawn (a hidden tab): one frame asked for, no more timers; then one call each', () => {
        const calls = [];
        dueSub((now) => { calls.push(now); return now + 125; }, clock + 125);
        dueSub((now) => { calls.push(now); return now + 125; }, clock + 60);
        frame(130);                                  // both due, their frame drawn
        expect(calls).toHaveLength(2);
        calls.length = 0;
        for (let i = 0; i < 100; i++) {
            clock += 100;
            vi.advanceTimersByTime(100);              // time passes, no frame runs
            expect(vi.getTimerCount() + queue.length).toBeLessThanOrEqual(1);
        }
        expect(queue).toHaveLength(1);
        expect(calls).toHaveLength(0);
        frame();
        expect(calls).toEqual([clock, clock]);
        expect(vi.getTimerCount()).toBe(1);
    });

    it('stops (timer and frame cancelled) when the last subscriber leaves, and starts again', () => {
        const a = dueSub((now) => now + 100, clock + 100);
        const b = dueSub((now) => now + 100, clock + 200);
        frame(100);
        a();
        expect(vi.getTimerCount() + queue.length).toBe(1);
        b();
        expect(vi.getTimerCount()).toBe(0);
        expect(queue.length).toBe(0);
        const log = [];
        dueSub((now) => { log.push(now); return now + 100; }, clock + 100);
        for (let i = 0; i < 40; i++) frame();
        expect(log.length).toBeGreaterThanOrEqual(2);
    });

    it('a subscriber that throws waits for nothing; the others carry on', () => {
        const log = [];
        dueSub(() => { throw new Error('bad sprite'); }, clock + 10);
        dueSub((now) => { log.push(now); return now + 100; }, clock + 10);
        expect(() => { for (let i = 0; i < 5; i++) frame(); }).toThrow('bad sprite');
        for (let i = 0; i < 100; i++) frame();
        expect(log.length).toBeGreaterThanOrEqual(5);
    });
});

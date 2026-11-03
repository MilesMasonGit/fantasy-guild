// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { TokenHitArt } from '../ui/components/board/TokenHitArt.jsx';
import { loopPoses } from '../ui/components/board/fx/clockPoses.js';
import { HIT_ANIMATIONS, HIT_PERIOD_MS, strikeStartTime } from '../ui/components/board/hitAnimations.js';
import { setSpriteFxManifest } from '../ui/utils/spriteFx.js';

/**
 * ⭐ **What plays all the time is written on the sprite clock** (T-198). A worked Token's hit loop and
 * its strike chips were animations kept on the main thread, and a running animation makes Chrome do a
 * style pass in every frame, through the still part of the loop too: one worked Token was enough to
 * pay it (measured: `UpdateLayoutTree` in every frame of the 128 board, 23 elements a pass, 9 once
 * these are off the animation path). The poses and their timing are the same; a frame where no pose
 * changes now writes nothing.
 */

const h = React.createElement;

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
const run = (ms) => { for (let t = 0; t < ms; t += 6) frame(); };

function stubAnimate() {
    const calls = [];
    const proto = window.HTMLElement.prototype;
    const had = Object.prototype.hasOwnProperty.call(proto, 'animate');
    const original = proto.animate;
    proto.animate = function animate(keyframes, options) {
        const a = { keyframes, options, cancel: vi.fn(), finished: Promise.resolve() };
        calls.push(a);
        return a;
    };
    return { calls, restore() { if (had) proto.animate = original; else delete proto.animate; } };
}

/** How many times an element's style attribute was written while `fn` ran. */
function writesDuring(el, fn) {
    const seen = new MutationObserver(() => {});
    seen.observe(el, { attributes: true, attributeFilter: ['style'] });
    let writes = 0;
    fn(() => { writes += seen.takeRecords().length; });
    writes += seen.takeRecords().length;
    seen.disconnect();
    return writes;
}

beforeEach(() => {
    queue = [];
    nextId = 1;
    clock = 5000;
    framesAsked = 0;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('requestAnimationFrame', (cb) => { framesAsked++; const id = nextId++; queue.push({ id, cb }); return id; });
    vi.stubGlobal('cancelAnimationFrame', (id) => { queue = queue.filter(q => q.id !== id); });
});

afterEach(() => {
    cleanup();
    setSpriteFxManifest(null);
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('⭐ loopPoses', () => {
    const POSES = [{ ms: 60, x: -2 }, { ms: 60, x: 2, y: -1 }];

    it('holds each pose for its time, rests at home for the remainder, and does it again each period', () => {
        const el = document.createElement('div');
        const stop = loopPoses(el, POSES, { startAt: clock, periodMs: 1000, unit: 2 });
        expect(el.style.transform).toBe('translate(-4px, 0px)');
        run(60);
        expect(el.style.transform).toBe('translate(4px, -2px)');
        run(60);
        expect(el.style.transform).toBe('translate(0px, 0px)');
        run(700);
        expect(el.style.transform).toBe('translate(0px, 0px)');
        run(200);
        expect(el.style.transform).toBe('translate(-4px, 0px)');
        stop();
        expect(el.style.transform).toBe('');
    });

    it('starts where the loop stands, not at its beginning', () => {
        const el = document.createElement('div');
        const stop = loopPoses(el, POSES, { startAt: clock - 70, periodMs: 1000 });
        expect(el.style.transform).toBe('translate(2px, -1px)');
        stop();
    });

    it('⭐ writes only when the pose changes, and asks for no frame through the still part', () => {
        const el = document.createElement('div');
        const stop = loopPoses(el, POSES, { startAt: clock, periodMs: 1000 });
        const writes = writesDuring(el, (tick) => {
            for (let t = 0; t < 1000; t += 6) { frame(); tick(); }
        });
        expect(writes).toBe(3);     // second pose, home, first pose again
        run(130);                   // through the second period's poses, to its still part
        framesAsked = 0;
        run(700);
        expect(framesAsked).toBe(0);
        stop();
    });

    it('stops: nothing scheduled after', () => {
        const el = document.createElement('div');
        loopPoses(el, POSES, { startAt: clock, periodMs: 1000 })();
        framesAsked = 0;
        queue = [];
        run(2000);
        expect(framesAsked).toBe(0);
    });
});

describe('⭐ a worked Token', () => {
    const worked = (props = {}) => h(DndContext, null, h(TokenHitArt, {
        instanceId: 't1', skill: 'forestry', heroId: 'hero_7', active: true, tokenX: 500, ...props
    }, h('span')));

    it('runs no animation, and shows the skill’s poses from the hero’s strike', () => {
        const anim = stubAnimate();
        try {
            const { container } = render(worked());
            expect(anim.calls).toHaveLength(0);
            const el = container.querySelector('[data-token-hit="shake"]');
            const strike = strikeStartTime(clock, 'hero_7');
            const seen = [];
            for (let i = 0; i < 400; i++) {
                frame();
                const into = (clock - strike) % HIT_PERIOD_MS;
                if (into < HIT_ANIMATIONS.shake.ms && seen[seen.length - 1] !== el.style.transform) seen.push(el.style.transform);
            }
            expect(seen.slice(0, 5)).toEqual(['translate(-2px, 0px)', 'translate(2px, 0px)', 'translate(-2px, 0px)', 'translate(1px, 0px)', 'translate(-1px, 0px)']);
            expect(anim.calls).toHaveLength(0);
        } finally {
            anim.restore();
        }
    });

    it('in whole art pixels of the mat’s unit', () => {
        const { container } = render(worked({ unit: 2.5 }));
        const el = container.querySelector('[data-token-hit="shake"]');
        const values = new Set();
        for (let i = 0; i < 200; i++) { frame(); values.add(el.style.transform); }
        expect(values.has('translate(-5px, 0px)')).toBe(true);
        expect(values.has('translate(5px, 0px)')).toBe(true);
        expect(values.has('translate(0px, 0px)')).toBe(true);
    });

    it('with reduced motion it stays still and asks for no frame', () => {
        vi.stubGlobal('matchMedia', (q) => ({ matches: /reduce/.test(q) }));
        const { container } = render(worked());
        framesAsked = 0;
        run(1500);
        expect(framesAsked).toBe(0);
        expect(container.querySelector('[data-token-hit="shake"]').style.transform).toBe('');
    });

    it('a Token nobody works asks for no frame', () => {
        render(worked({ heroId: null, active: false }));
        framesAsked = 0;
        run(1500);
        expect(framesAsked).toBe(0);
    });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import * as MatFx from '../ui/components/board/fx/matFx.js';
import { playIn, later } from '../ui/components/board/fx/tokenFx.js';
import { ONE_SHOT_SPARE_MS } from '../ui/components/board/fx/oneShot.js';
import { setDrawingPaused } from '../ui/components/board/frameClock.js';

/**
 * ⭐ A hidden window piles up no effects. It draws no frames, so an animation never finishes, and an
 * element taken away only when its animation finishes stayed on the page until the window came
 * back, then every one ended at once. Effects asked for while drawing is paused are not made, and
 * any that is made still goes when its time is up.
 */

/** Every `animate` call; each returns a stand-in that never finishes unless told to. */
function recordAnimate() {
    const calls = [];
    const proto = window.Element.prototype;
    const had = Object.prototype.hasOwnProperty.call(proto, 'animate');
    const original = proto.animate;
    proto.animate = function animate(keyframes, options) {
        const a = {
            el: this, keyframes, options, onfinish: null, oncancel: null,
            cancel: vi.fn(function cancel() { this.oncancel?.(); }),
            finish() { this.onfinish?.(); }
        };
        calls.push(a);
        return a;
    };
    return { calls, restore() { if (had) proto.animate = original; else delete proto.animate; } };
}

let rec;
let host;
beforeEach(() => {
    rec = recordAnimate();
    host = document.createElement('div');
    document.body.appendChild(host);
    MatFx.attachFxHost(host, 2);
});
afterEach(() => {
    setDrawingPaused(false);
    MatFx.attachFxHost(null);
    rec.restore();
    vi.useRealTimers();
    document.body.innerHTML = '';
});

describe('an effect whose animation never reports done still goes', () => {
    it('on the mat (playAt): gone a little after its delay and duration, its animation cancelled', () => {
        vi.useFakeTimers();
        const el = document.createElement('span');
        MatFx.playAt(el, 10, 20, [{}, {}], 300, 100);
        expect(host.contains(el)).toBe(true);
        vi.advanceTimersByTime(400 + ONE_SHOT_SPARE_MS - 1);
        expect(host.contains(el)).toBe(true);
        vi.advanceTimersByTime(1);
        expect(host.contains(el)).toBe(false);
        expect(rec.calls[0].cancel).toHaveBeenCalledTimes(1);
    });

    it('on a Token (playIn): the same', () => {
        vi.useFakeTimers();
        const wrapper = document.createElement('div');
        document.body.appendChild(wrapper);
        const el = document.createElement('span');
        playIn(wrapper, el, [{}, {}], { duration: 120, delay: 60 });
        vi.advanceTimersByTime(180 + ONE_SHOT_SPARE_MS - 1);
        expect(wrapper.contains(el)).toBe(true);
        vi.advanceTimersByTime(1);
        expect(wrapper.contains(el)).toBe(false);
    });

    it('one that finishes as usual goes then, and its timer does nothing after', () => {
        vi.useFakeTimers();
        const el = document.createElement('span');
        MatFx.playAt(el, 0, 0, [{}, {}], 300);
        rec.calls[0].finish();
        expect(host.contains(el)).toBe(false);
        vi.advanceTimersByTime(300 + ONE_SHOT_SPARE_MS);
        expect(rec.calls[0].cancel).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('nothing is made while drawing is paused', () => {
    it('the mat\'s effects: a rule\'s spark and number, a knockout', () => {
        GameState.initNew();
        clearMat();
        const unwatch = MatFx.watchMatFx();
        try {
            const giver = placeAt('fixture_producer', 400, 500);
            const taker = placeAt('fixture_producer', 560, 500);
            const fire = () => EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId: taker.id, fromTokenId: giver.id, amount: 1 });
            setDrawingPaused(true);
            fire();
            EventBus.publish(BOARD_EVENTS.COMBAT_RESOLVED, { instanceId: taker.id, outcome: 'victory' });
            EventBus.publish(ENGINE_EVENTS.HERO_CONSUMED, { heroId: 'h', itemId: 'x', healed: 5 });
            expect(rec.calls).toHaveLength(0);
            expect(host.children).toHaveLength(0);
            // Visible again: drawn as before.
            setDrawingPaused(false);
            fire();
            expect(rec.calls).toHaveLength(2);
        } finally {
            unwatch();
        }
    });

    it('a Token effect waiting for a later frame (`later`), asked for while paused, never runs', () => {
        vi.useFakeTimers();
        vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(() => cb(performance.now()), 16));
        vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
        try {
            const hidden = vi.fn();
            setDrawingPaused(true);
            later(0, hidden);
            setDrawingPaused(false);
            const shown = vi.fn();
            later(0, shown);
            vi.advanceTimersByTime(200);
            expect(shown).toHaveBeenCalledTimes(1);
            expect(hidden).not.toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import * as MatFx from '../ui/components/board/fx/matFx.js';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { CalloutLayer } from '../ui/components/board/CalloutLayer.jsx';
import { SPAWN_MS } from '../ui/components/board/spawnMotion.js';
import { playIn, later } from '../ui/components/board/fx/tokenFx.js';
import { ONE_SHOT_SPARE_MS, animateFx } from '../ui/components/board/fx/oneShot.js';
import { setDrawingPaused } from '../ui/components/board/frameClock.js';
import { playTokenFx } from '../ui/components/board/fx/tokenFxPlay.js';
import { playPoses } from '../ui/components/board/fx/pixelSteps.js';
import { playSettle } from '../ui/components/board/fx/regionSettle.js';
import { playSpawn } from '../ui/components/board/spawnMotion.js';
import { playLootArc, playAbsorptionSlide } from '../ui/utils/lootArc.js';
import { playPickupFlight } from '../ui/dnd/pickupFlight.js';

/**
 * ⭐ A hidden window piles up no effects. It draws no frames, so an animation never finishes, and an
 * element taken away only when its animation finishes stayed on the page until the window came
 * back, then every one ended at once. Effects asked for while drawing is paused are not made, and
 * any that is made still goes when its time is up.
 * Chrome also keeps every animation a hidden page starts, and the element it plays on, until the
 * page draws again, even once that element is taken away: the loot hopping out of its Tokens and
 * the mat's callouts piled up that way. So no animation starts while paused (`animateFx`, the only
 * way one starts) and the mat says no callouts.
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

    it('animateFx: no animation while paused, the element\'s own `animate` otherwise', () => {
        const el = document.createElement('span');
        setDrawingPaused(true);
        expect(animateFx(el, [{}, {}], { duration: 100 })).toBeNull();
        expect(rec.calls).toHaveLength(0);
        setDrawingPaused(false);
        const anim = animateFx(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 100, delay: 5 });
        expect(anim).toBe(rec.calls[0]);
        expect(rec.calls[0].el).toBe(el);
        expect(rec.calls[0].options).toEqual({ duration: 100, delay: 5 });
        expect(animateFx(null, [{}, {}], { duration: 100 })).toBeNull();
    });

    it('loot hopping out of its Token, and loot sliding onto a pile: nothing plays', () => {
        const loot = () => {
            const button = document.createElement('button');
            const shadow = document.createElement('span');
            shadow.setAttribute('data-sprite-shadow', 'true');
            button.appendChild(shadow);
            document.body.appendChild(button);
            return button;
        };
        setDrawingPaused(true);
        expect(playLootArc(loot(), 40, -30, { unit: 2 })).toBeNull();
        expect(playAbsorptionSlide(loot(), 20, 0, { unit: 2 })).toBeNull();
        expect(rec.calls).toHaveLength(0);
        // Visible: the hop and its shadow, and the slide, as before.
        setDrawingPaused(false);
        expect(playLootArc(loot(), 40, -30, { unit: 2 })).toBe(rec.calls[0]);
        expect(rec.calls).toHaveLength(2);
        expect(playAbsorptionSlide(loot(), 20, 0, { unit: 2 })).toBe(rec.calls[2]);
    });

    it('a Token\'s own effects (a flash, a ring, the named ones): nothing is made, nothing is left in its wrapper', () => {
        const wrapper = document.createElement('div');
        document.body.appendChild(wrapper);
        setDrawingPaused(true);
        expect(playIn(wrapper, document.createElement('span'), [{}, {}], { duration: 120 })).toBeNull();
        for (const fx of ['blink', 'hide', 'hit', 'flash', 'cycle', 'echo']) playTokenFx(wrapper, { fx }, { unit: 2 });
        expect(rec.calls).toHaveLength(0);
        expect(wrapper.children).toHaveLength(0);
        setDrawingPaused(false);
        playTokenFx(wrapper, { fx: 'blink' }, { unit: 2 });
        expect(rec.calls).toHaveLength(1);
    });

    it('a Token popping out of its spawner, a Region\'s settle, the Hall\'s dip, a pickup\'s flight: nothing plays, nothing is left changed', () => {
        const box = () => {
            const el = document.createElement('div');
            el.style.willChange = 'auto';
            document.body.appendChild(el);
            return el;
        };
        setDrawingPaused(true);
        const spawned = box();
        expect(playSpawn(spawned, 30, -40, { unit: 2, over: 10 })).toBeNull();
        expect(spawned.style.willChange).toBe('auto');
        const settled = [box(), box()];
        expect(playSettle(settled, 200, { unit: 2 })).toEqual([]);
        expect(settled.map(el => el.style.willChange)).toEqual(['auto', 'auto']);
        expect(playPoses(box(), [{ ms: 60, y: 1 }], { unit: 2 })).toBeNull();
        expect(playPickupFlight(box(), { x: 40, y: 30 })).toBeNull();
        expect(rec.calls).toHaveLength(0);
        // Visible: as before, and the spawn's main-thread hint goes back when it ends.
        setDrawingPaused(false);
        const shown = box();
        const anim = playSpawn(shown, 30, -40, { unit: 2, over: 10 });
        expect(anim).toBe(rec.calls[0]);
        expect(shown.style.willChange).toBe('contents');
        anim.finish();
        expect(shown.style.willChange).toBe('auto');
        expect(playSettle([box(), box()], 200, { unit: 2 })).toHaveLength(2);
        expect(playPoses(box(), [{ ms: 60, y: 1 }], { unit: 2 })).not.toBeNull();
        expect(playPickupFlight(box(), { x: 40, y: 30 })).not.toBeNull();
        expect(rec.calls).toHaveLength(5);
    });

    it('the mat\'s callouts ("Needs Coal", a spawn, a rule\'s name): none is said, and no reminder is used up', () => {
        vi.useFakeTimers();
        GameState.initNew();
        clearMat();
        const station = placeAt('fixture_producer', 600, 500);
        const { container } = render(React.createElement(CalloutLayer));
        try {
            const needs = () => act(() => {
                EventBus.publish(BOARD_EVENTS.INPUT_NEEDED, { instanceId: station.id, heroId: 'h', itemId: 'item_coal' });
            });
            setDrawingPaused(true);
            needs();
            act(() => {
                EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId: station.id, title: 'Boost' });
                EventBus.publish(BOARD_EVENTS.TOKEN_SPAWNED, { spawnerId: station.id, instanceId: 'tok_new', typeId: 'x', name: 'Oak Tree' });
            });
            act(() => { vi.advanceTimersByTime(SPAWN_MS); });
            expect(container.querySelector('[data-callout]')).toBeNull();
            // Visible again: the station says it at once, not a reminder's gap later.
            setDrawingPaused(false);
            needs();
            expect(container.querySelector('[data-callout]')).not.toBeNull();
        } finally {
            cleanup();
        }
    });
});

describe('⚠️ every one-shot animation in the game starts through animateFx', () => {
    /**
     * The only `.animate(` calls allowed under `src/ui`: `animateFx` itself, and the two camera
     * glides, which start only from a drawn frame (or turning back a glide already running) and are
     * landed by a timer of their own.
     */
    const ALLOWED = [/fx[\\/]oneShot\.js$/, /board[\\/]HallCamera\.jsx$/, /atlas[\\/]WorldCamera\.jsx$/];
    const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
        const p = path.join(dir, d.name);
        return d.isDirectory() ? files(p) : (/\.(jsx?|tsx?)$/.test(d.name) ? [p] : []);
    });

    it('no `.animate(` in the game\'s UI outside the allowed ones', () => {
        const ui = path.resolve(__dirname, '../ui');
        const offenders = files(ui)
            .filter(f => !ALLOWED.some(re => re.test(f)))
            .filter(f => /\.animate\s*\(/.test(fs.readFileSync(f, 'utf8').replace(/^\s*(\/\/|\*).*$/gm, '')))
            .map(f => path.relative(ui, f));
        expect(offenders).toEqual([]);
    });
});

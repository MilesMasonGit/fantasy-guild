// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { SpriteLayerView } from '../ui/components/board/SpriteLayerView.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Thrown loot lands centred on its point, and nothing is held on it afterwards.** jsdom has
 * no layout, so this composes the sprite's position the way the browser does: its `left`/`top`,
 * then its CSS `translate` (Tailwind's `-translate-x-1/2` class), then any `transform` an
 * animation holds after it ends. The `translate` property and `transform` both apply; an arc
 * whose keyframes also carried `-50%` centred the sprite twice and left it half a sprite up-left
 * of its point, on a layer of its own (a held 3D transform), drawn soft.
 */

const h = React.createElement;
let animations;

beforeEach(() => {
    vi.clearAllMocks();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.board.sprites = [];
    animations = [];
    HTMLElement.prototype.animate = function (keyframes, options) {
        animations.push({ el: this, keyframes, options });
        return { cancel() {}, finished: Promise.resolve() };
    };
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    delete HTMLElement.prototype.animate;
});

const mount = () => render(h(SpriteLayerView));

/** One art pixel of the board at the test's fit (1): the hop moves in whole ones. */
const UNIT = 2;
/** The loot sprite's own animations (its shadow and trail copies animate too). */
const own = () => animations.filter(a => a.el.getAttribute?.('data-item-sprite') === 'true');

/** The share of the element's own size (in %) and the pixels that a translate-like value moves it by, per axis. */
function translateOf(value) {
    const out = { xPct: 0, yPct: 0, xPx: 0, yPx: 0 };
    if (!value || value === 'none') return out;
    const m = /translate(?:3d)?\(([^)]*(?:\([^)]*\)[^)]*)*)\)/.exec(value);
    if (!m) return out;
    const parts = m[1].split(/,(?![^(]*\))/).map(s => s.trim());
    const add = (axis, term) => {
        for (const t of term.replace(/^calc\(|\)$/g, '').split(/\s(?=[+-]\s)/)) {
            const n = parseFloat(t.trim().replace(/^\+\s*/, '').replace(/\s/g, ''));
            if (Number.isNaN(n)) continue;
            if (t.trim().endsWith('%')) out[`${axis}Pct`] += n; else out[`${axis}Px`] += n;
        }
    };
    add('x', parts[0] ?? '0');
    add('y', parts[1] ?? '0');
    return out;
}

/** The `translate` property Tailwind's classes give the element: `-translate-x-1/2` is -50 %. */
function translatePropertyOf(el) {
    const cls = el.className.split(/\s+/);
    return {
        xPct: cls.includes('-translate-x-1/2') ? -50 : 0,
        yPct: cls.includes('-translate-y-1/2') ? -50 : 0
    };
}

/** Where the element's centre sits relative to its `left`/`top`, in px, once an animation is over. */
function restingCentre(anim) {
    const { el, keyframes, options } = anim;
    const size = parseFloat(el.style.width);
    const prop = translatePropertyOf(el);
    const holds = options?.fill === 'both' || options?.fill === 'forwards';
    const held = holds ? translateOf(keyframes[keyframes.length - 1].transform) : translateOf('none');
    return {
        x: size / 2 + (prop.xPct + held.xPct) / 100 * size + held.xPx,
        y: size / 2 + (prop.yPct + held.yPct) / 100 * size + held.yPx
    };
}

/** Where the element's centre sits relative to its `left`/`top` at an animation's first frame. */
function startCentre(anim) {
    const { el, keyframes } = anim;
    const size = parseFloat(el.style.width);
    const prop = translatePropertyOf(el);
    const t = translateOf(keyframes[0].transform);
    return {
        x: size / 2 + (prop.xPct + t.xPct) / 100 * size + t.xPx,
        y: size / 2 + (prop.yPct + t.yPct) / 100 * size + t.yPx
    };
}

const throwLoot = () => SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, { centre: { x: 500, y: 400 } });

describe('⭐ thrown loot lands on its point', () => {
    it('a sprite that arrived with its arc ends centred on its point, like one that did not', async () => {
        const sprite = throwLoot();
        expect(sprite.fromX !== sprite.x || sprite.fromY !== sprite.y).toBe(true);
        await act(async () => { mount(); });
        expect(own()).toHaveLength(1);
        const arc = own()[0];
        expect(parseFloat(arc.el.style.width)).toBeGreaterThan(0);
        expect(translatePropertyOf(arc.el)).toEqual({ xPct: -50, yPct: -50 });
        const c = restingCentre(arc);
        expect(c.x).toBeCloseTo(0, 6);
        expect(c.y).toBeCloseTo(0, 6);
    });

    it('the arc starts centred on where the loot came from, to the nearest whole art pixel', async () => {
        const sprite = throwLoot();
        await act(async () => { mount(); });
        const c = startCentre(own()[0]);
        expect(Math.abs(c.x - Math.round(sprite.fromX - sprite.x))).toBeLessThanOrEqual(UNIT / 2);
        expect(Math.abs(c.y - Math.round(sprite.fromY - sprite.y))).toBeLessThanOrEqual(UNIT / 2);
        expect(c.x % UNIT).toBeCloseTo(0, 6);
    });

    it('no transform is held on the sprite once it has landed', async () => {
        throwLoot();
        await act(async () => { mount(); });
        const { options } = own()[0];
        expect(['both', 'forwards']).not.toContain(options.fill);
    });

    it('the slide into a stack starts from where the sprite rests', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
        const parent = SpriteLayer.addSprite('item', 'fixture_oak_wood', 3, { centre: { x: 300, y: 300 } });
        await act(async () => { mount(); });
        let child;
        await act(async () => { child = SpriteLayer.addSprite('item', 'fixture_oak_wood', 2, { centre: { x: 310, y: 310 } }); });
        expect(child.targetStackId).toBe(parent.id);
        await act(async () => { vi.advanceTimersByTime(850); });
        const slide = own().find(a => a.options?.fill === 'forwards');
        expect(slide).toBeTruthy();
        // It steps over to the pile: a third of the way on its first pose, never a scale.
        const c = startCentre(slide);
        expect(Math.abs(c.x - Math.round(parent.x - child.x) / 3)).toBeLessThanOrEqual(UNIT / 2);
        expect(Math.abs(c.y - Math.round(parent.y - child.y) / 3)).toBeLessThanOrEqual(UNIT / 2);
        expect(slide.keyframes.some(k => /scale/.test(k.transform))).toBe(false);
        const end = translateOf(slide.keyframes[slide.keyframes.length - 1].transform);
        expect(end.xPct).toBeCloseTo(0, 6);
        expect(end.yPct).toBeCloseTo(0, 6);
        expect(Math.abs(end.xPx - Math.round(parent.x - child.x))).toBeLessThanOrEqual(UNIT / 2);
        expect(Math.abs(end.yPx - Math.round(parent.y - child.y))).toBeLessThanOrEqual(UNIT / 2);
    });
});

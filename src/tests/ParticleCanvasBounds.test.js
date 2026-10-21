// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';

/**
 * ⭐ **The loot flight canvas is only as big as the flights.** It used to cover the whole window
 * and be cleared and redrawn whole on every frame of every flight (brief 60, cause #3). It is now
 * sized and placed over the flights in the air, hidden while nothing flies, and everything a
 * flight draws (its trail, glow, item and sparkles) still lands inside it, where the item went.
 */

vi.mock('../systems/core/SettingsManager.js', () => ({
    SettingsManager: { get: () => true }
}));
vi.mock('../config/registries/itemRegistry.js', () => ({
    getItem: (id) => ({ id, icon: '*', color: '#4ade80' })
}));
vi.mock('../utils/AssetManager.js', () => ({ resolveSpritePath: () => '' }));
vi.mock('../state/GameState.js', () => ({ GameState: { heroes: [{ id: 'h1', spriteId: 'recruit' }] } }));

import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import { ParticleOverlay } from '../ui/components/base/ParticleOverlay.jsx';

const VIEW = { w: 1600, h: 1000 };

let queue;
let clock;
let ctx;
let landed;
let unsubLanded;
/** What each frame drew, in screen pixels, and the canvas's rect at the time. */
let frames;

/**
 * A 2D context that records the box of everything drawn, in CANVAS pixels (through the
 * translation `setTransform` set), so a test can check it against the canvas's own size.
 */
function recordingContext() {
    let path = [];
    const t = { e: 0, f: 0 };
    let drawnNow = [];
    const push = (op, x0, y0, x1, y1) => drawnNow.push({ op, box: [x0 + t.e, y0 + t.f, x1 + t.e, y1 + t.f] });
    return {
        take() { const d = drawnNow; drawnNow = []; return d; },
        globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '', strokeStyle: '',
        lineWidth: 1, lineCap: 'butt', font: '10px sans-serif', textAlign: 'start',
        textBaseline: 'alphabetic', imageSmoothingEnabled: true,
        setTransform(a, b, c, d, e, f) { t.e = e; t.f = f; },
        clearRect(x, y, w, h) { push('clear', x, y, x + w, y + h); },
        fillRect(x, y, w, h) { push('fillRect', x, y, x + w, y + h); },
        beginPath() { path = []; },
        moveTo(x, y) { path.push([x, y]); },
        lineTo(x, y) { path.push([x, y]); },
        stroke() { const r = this.lineWidth / 2; for (const [x, y] of path) push('stroke', x - r, y - r, x + r, y + r); },
        arc(x, y, r) { push('arc', x - r, y - r, x + r, y + r); },
        fill() {},
        createRadialGradient() { return { addColorStop() {} }; },
        drawImage(img, x, y, w, h) { push('image', x, y, x + w, y + h); },
        fillText(text, x, y) { const half = parseFloat(this.font) / 2; push('text', x - half, y - half, x + half, y + half); }
    };
}

const canvasOf = (container) => container.querySelector('canvas');
/** The canvas's rect on screen, as the page places it. */
function rectOf(canvas) {
    return {
        left: parseFloat(canvas.style.left) || 0,
        top: parseFloat(canvas.style.top) || 0,
        width: canvas.width,
        height: canvas.height,
        shown: canvas.style.display !== 'none'
    };
}

function frame(canvas, ms = 16) {
    clock += ms;
    const due = queue;
    queue = [];
    for (const cb of due) cb(clock);
    if (due.length) frames.push({ rect: rectOf(canvas), drawn: ctx.take(), landedBy: landed.length });
}
function runUntilAsleep(canvas, limit = 4000) {
    let n = 0;
    while (queue.length && n < limit) { frame(canvas); n++; }
}

const fly = (from, to, extra = {}) => EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
    kind: 'item', refId: 'item_oak_log', quantity: 1,
    fromScreenX: from[0], fromScreenY: from[1], toScreenX: to[0], toScreenY: to[1], ...extra
});

/** Every drawn box of every frame lies inside the canvas as it stood that frame. */
function expectAllInside() {
    let checked = 0;
    const outside = [];
    for (const f of frames) {
        for (const d of f.drawn) {
            const [x0, y0, x1, y1] = d.box;
            if (x0 < 0 || y0 < 0 || x1 > f.rect.width || y1 > f.rect.height) {
                outside.push(`${d.op} [${d.box.map(n => n.toFixed(1)).join(', ')}] in a ${f.rect.width}×${f.rect.height} canvas`);
            }
            checked++;
        }
    }
    expect(outside.slice(0, 5)).toEqual([]);
    return checked;
}

/** A Math.random that plays `cycle` over and over. */
const cycling = (cycle) => { let i = 0; return () => cycle[i++ % cycle.length]; };
const NEAR_ONE = 1 - 1e-9;

beforeEach(() => {
    queue = [];
    clock = 0;
    landed = [];
    frames = [];
    ctx = recordingContext();
    Object.defineProperty(window, 'innerWidth', { value: VIEW.w, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: VIEW.h, configurable: true });
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('requestAnimationFrame', (cb) => { queue.push(cb); return queue.length; });
    vi.stubGlobal('cancelAnimationFrame', () => { queue = []; });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    unsubLanded = EventBus.subscribe(UI_EVENTS.PARTICLE_LANDED, (p) => landed.push(p));
});

afterEach(() => {
    unsubLanded?.();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete window.innerWidth;
    delete window.innerHeight;
});

describe('⭐ the flight canvas covers the flights, not the window', () => {
    it('while nothing flies it is hidden and nothing is drawn', () => {
        const { container } = render(React.createElement(ParticleOverlay, { disabled: false }));
        const canvas = canvasOf(container);
        expect(canvas.style.display).toBe('none');
        expect(ctx.take()).toEqual([]);

        act(() => { fly([700, 500], [900, 450]); });
        runUntilAsleep(canvas);
        expect(landed).toHaveLength(1);
        expect(canvas.style.display).toBe('none');

        frame(canvas, 1000);
        expect(ctx.take()).toEqual([]);
    });

    it('a short hop gets a canvas around its own path, drawn 1:1', () => {
        const { container } = render(React.createElement(ParticleOverlay, { disabled: false }));
        const canvas = canvasOf(container);
        act(() => { fly([700, 500], [900, 450]); });
        frame(canvas);

        const r = rectOf(canvas);
        expect(r.shown).toBe(true);
        expect(r.width).toBeLessThan(VIEW.w / 3);
        expect(r.height).toBeLessThan(VIEW.h / 3);
        for (const [x, y] of [[700, 500], [900, 450]]) {
            expect(x).toBeGreaterThan(r.left);
            expect(x).toBeLessThan(r.left + r.width);
            expect(y).toBeGreaterThan(r.top);
            expect(y).toBeLessThan(r.top + r.height);
        }
        // CSS size equals the bitmap, as the window-sized canvas had it: no scaling of the art.
        expect(canvas.style.width).toBe(`${r.width}px`);
        expect(canvas.style.height).toBe(`${r.height}px`);
        // Each frame clears its own canvas, not the window.
        expect(frames[0].drawn[0]).toEqual({ op: 'clear', box: [0, 0, r.width, r.height] });
    });

    it('a second flight grows it over both; once everything has landed it is hidden again', () => {
        const { container } = render(React.createElement(ParticleOverlay, { disabled: false }));
        const canvas = canvasOf(container);
        act(() => { fly([300, 300], [450, 250]); });
        frame(canvas);
        const first = rectOf(canvas);
        act(() => { fly([1200, 700], [1300, 650]); });
        frame(canvas);
        const both = rectOf(canvas);
        expect(both.left).toBeLessThanOrEqual(first.left);
        expect(both.top).toBeLessThanOrEqual(first.top);
        expect(both.left + both.width).toBeGreaterThan(1300);
        expect(both.top + both.height).toBeGreaterThan(700);

        runUntilAsleep(canvas);
        expect(landed).toHaveLength(2);
        expect(canvas.style.display).toBe('none');
    });

    it('it never reaches past the window', () => {
        const { container } = render(React.createElement(ParticleOverlay, { disabled: false }));
        const canvas = canvasOf(container);
        act(() => { fly([1500, 950], [1590, 990]); fly([20, 30], [5, 8]); });
        runUntilAsleep(canvas);
        for (const f of frames) {
            expect(f.rect.left).toBeGreaterThanOrEqual(0);
            expect(f.rect.top).toBeGreaterThanOrEqual(0);
            expect(f.rect.left + f.rect.width).toBeLessThanOrEqual(VIEW.w);
            expect(f.rect.top + f.rect.height).toBeLessThanOrEqual(VIEW.h);
        }
    });
});

describe('⭐ everything a flight draws lands inside the canvas', () => {
    /** Flights well inside the window, so nothing is clipped by the window's own edge. */
    function flights(n, seed) {
        let s = seed;
        const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        return Array.from({ length: n }, () => [
            [300 + rnd() * 1000, 250 + rnd() * 500],
            [300 + rnd() * 1000, 250 + rnd() * 500]
        ]);
    }

    function run(randomStream, plan) {
        if (randomStream) vi.spyOn(Math, 'random').mockImplementation(randomStream);
        const { container } = render(React.createElement(ParticleOverlay, { disabled: false }));
        const canvas = canvasOf(container);
        for (const burst of plan) {
            act(() => { for (const [from, to, extra] of burst) fly(from, to, extra); });
            // Over the burst queue's quiet spell, so every burst flies; the earlier ones are still in the air.
            for (let i = 0; i < 20 && queue.length; i++) frame(canvas);
        }
        runUntilAsleep(canvas);
        return expectAllInside();
    }

    it('realistic flights, in bursts that overlap', () => {
        let s = 7;
        const seeded = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
        const all = flights(40, 11);
        const plan = [];
        for (let i = 0; i < all.length; i += 5) plan.push(all.slice(i, i + 5));
        expect(run(seeded, plan)).toBeGreaterThan(1000);
        expect(landed).toHaveLength(40);
    });

    it('the sparkles drifting as far as they can: down and left', () => {
        // Each trail sparkle: spawned, jittered left and down, drifting left at full speed and
        // down at full speed, at the slowest fade.
        expect(run(cycling([0.99, 0, NEAR_ONE, 0, NEAR_ONE, 0]), [[[[800, 400], [500, 450]]]])).toBeGreaterThan(100);
    });

    it('the sparkles drifting as far as they can: down and right', () => {
        expect(run(cycling([0.99, NEAR_ONE, NEAR_ONE, NEAR_ONE, NEAR_ONE, 0]), [[[[500, 400], [800, 450]]]])).toBeGreaterThan(100);
    });

    it('the landing sparkles thrown as far as they can: up and left', () => {
        expect(run(() => 0, [[[[500, 600], [800, 400]]]])).toBeGreaterThan(20);
    });

    it('a hero lifted from the dock, flying to the cursor', () => {
        vi.spyOn(Math, 'random').mockImplementation(cycling([0.99, 0, NEAR_ONE, 0, NEAR_ONE, 0]));
        const { container } = render(React.createElement(ParticleOverlay, { disabled: false }));
        const canvas = canvasOf(container);
        act(() => {
            EventBus.publish(UI_EVENTS.UI_PARTICLE_FLY, {
                kind: 'hero', heroId: 'h1', destination: 'cursor',
                fromScreenX: 800, fromScreenY: 900, toScreenX: 760, toScreenY: 600
            });
        });
        runUntilAsleep(canvas);
        expect(landed).toHaveLength(1);
        expect(expectAllInside()).toBeGreaterThan(20);
    });
});

describe('⭐ crisp flight (effect 5): hard pixels, no glow, nothing random', () => {
    it('draws only whole-pixel squares and the item: no glow, no smear, no additive blending, no Math.random', () => {
        const random = vi.spyOn(Math, 'random');
        const ops = [];
        const fill = ctx.fillRect;
        ctx.fillRect = function (x, y, w, h) { ops.push({ x, y, w, h, blend: this.globalCompositeOperation, alpha: this.globalAlpha }); return fill.call(this, x, y, w, h); };
        ctx.arc = () => { throw new Error('a glow was drawn'); };
        ctx.stroke = () => { throw new Error('a smear was drawn'); };
        const { container } = render(React.createElement(ParticleOverlay, { disabled: false }));
        const canvas = canvasOf(container);
        act(() => { fly([300, 700], [1210, 230]); fly([500, 500], [520, 480]); });
        runUntilAsleep(canvas);
        expect(landed).toHaveLength(2);
        expect(random).not.toHaveBeenCalled();
        expect(ops.length).toBeGreaterThan(20);
        for (const o of ops) {
            expect([o.w, o.h]).toEqual([2, 2]);
            expect(Number.isInteger(o.x) && Number.isInteger(o.y)).toBe(true);
            expect(o.blend).toBe('source-over');
            expect(o.alpha).toBe(1);
        }
    });
});

describe('⭐ the item still lands exactly where it went', () => {
    it('the landing burst is drawn on the target, on screen', () => {
        const { container } = render(React.createElement(ParticleOverlay, { disabled: false }));
        const canvas = canvasOf(container);
        const target = [1210, 230];
        act(() => { fly([300, 700], target); });
        runUntilAsleep(canvas);

        expect(landed).toHaveLength(1);
        expect(landed[0]).toMatchObject({ x: target[0], y: target[1] });

        // The frame it landed in: the plink's four 2 px pixels, 3 px out from the very point it
        // landed on, up, right, down and left (effect 5).
        const f = frames.find(fr => fr.landedBy === 1);
        const onScreen = f.drawn.filter(d => d.op === 'fillRect').map(d => [d.box[0] + f.rect.left + 1, d.box[1] + f.rect.top + 1]);
        const plink = onScreen.filter(([x, y]) => Math.hypot(x - target[0], y - target[1]) === 3);
        expect(plink.map(([x, y]) => [x - target[0], y - target[1]])).toEqual([[0, -3], [3, 0], [0, 3], [-3, 0]]);

        // And the item itself, on its last frame in the air, was drawn on its way into the target.
        const lastInAir = frames.filter(fr => fr.landedBy === 0).at(-1);
        const item = lastInAir.drawn.filter(d => d.op === 'text').at(-1);
        const cx = (item.box[0] + item.box[2]) / 2 + lastInAir.rect.left;
        const cy = (item.box[1] + item.box[3]) / 2 + lastInAir.rect.top;
        expect(Math.hypot(cx - target[0], cy - target[1])).toBeLessThan(25);
    });
});

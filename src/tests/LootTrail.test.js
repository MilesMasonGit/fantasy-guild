// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';

/**
 * ⭐ **Collected loot trails shadows of itself** (owner's pick from the comparison page): solid
 * silhouettes in the item's primary colour (its most used colour, outline left out), each darker
 * toward the tail, one shadow for a stack under 10 up to seven for 1,000,000 and more. The colour is
 * worked out once per item, when its sprite loads, never per frame; the flight's path, timing and
 * landing are as before.
 */

vi.mock('../systems/core/SettingsManager.js', () => ({ SettingsManager: { get: () => true } }));
vi.mock('../config/registries/itemRegistry.js', () => ({
    getItem: (id) => ({ id, icon: '*', color: '#4ade80' })
}));
vi.mock('../utils/AssetManager.js', () => ({ resolveSpritePath: () => 'sprite.png' }));
vi.mock('../state/GameState.js', () => ({ GameState: { heroes: [] } }));

import {
    TRAIL_DARKEN_MAX, TRAIL_STEP_MS, primaryColour, shadowColour, trailArt, trailShadowCount
} from '../ui/utils/lootTrail.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import { ParticleOverlay, flightDurationMs } from '../ui/components/base/ParticleOverlay.jsx';

/** A 32×32 sprite: 300 outline pixels (near black), 200 of the primary, 100 of a second colour, the rest clear. */
const PRIMARY = [206, 123, 45];
function spritePixels() {
    const d = new Uint8ClampedArray(32 * 32 * 4);
    const put = (from, to, rgb, a = 255) => {
        for (let p = from; p < to; p++) d.set([...rgb, a], p * 4);
    };
    put(0, 300, [20, 12, 10]);
    put(300, 500, PRIMARY);
    put(500, 600, [253, 165, 115]);
    put(600, 900, [250, 250, 250], 0); // see-through: never counted
    return d;
}

describe('the shadow count follows the stack', () => {
    it.each([
        [1, 1], [9, 1], [10, 2], [99, 2], [100, 3], [999, 3],
        [1000, 4], [9999, 4], [10000, 5], [99999, 5], [100000, 6], [999999, 6],
        [1000000, 7], [50_000_000, 7]
    ])('a stack of %i trails %i', (qty, n) => {
        expect(trailShadowCount(qty)).toBe(n);
    });

    it('a flight with no quantity trails one', () => {
        for (const q of [undefined, null, 0, -4, NaN]) expect(trailShadowCount(q)).toBe(1);
    });
});

describe("the item's primary colour", () => {
    it('is its most used opaque colour, the dark outline left out', () => {
        expect(primaryColour(spritePixels())).toEqual(PRIMARY);
    });

    it('is none when a sprite has only outline', () => {
        const d = new Uint8ClampedArray(8 * 4);
        for (let p = 0; p < 8; p++) d.set([5, 5, 5, 255], p * 4);
        expect(primaryColour(d)).toBeNull();
    });
});

describe('each shadow is darker toward the tail', () => {
    const luma = (hex) => [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0);

    it('the nearest is the primary colour itself, the tail mixed the most toward black', () => {
        expect(shadowColour(PRIMARY, 0, 1)).toBe('#ce7b2d');
        expect(shadowColour(PRIMARY, 0, 5)).toBe('#ce7b2d');
        const k = 1 - TRAIL_DARKEN_MAX;
        expect(shadowColour(PRIMARY, 4, 5)).toBe('#' + PRIMARY.map(v => Math.round(v * k).toString(16).padStart(2, '0')).join(''));
    });

    it('every shadow is darker than the one before it', () => {
        for (let n = 2; n <= 7; n++) {
            const ls = Array.from({ length: n }, (_, i) => luma(shadowColour(PRIMARY, i, n)));
            for (let i = 1; i < n; i++) expect(ls[i]).toBeLessThan(ls[i - 1]);
        }
    });
});

/** A canvas stand-in whose context records reads and fills. */
function fakeCanvasMaker(log) {
    return () => {
        const c = { width: 0, height: 0, fills: [] };
        c.getContext = () => ({
            drawImage() {},
            getImageData: () => { log.reads++; return { data: spritePixels() }; },
            fillRect() { c.fills.push(this.fillStyle); },
            set fillStyle(v) { this._f = v; }, get fillStyle() { return this._f; },
            globalCompositeOperation: 'source-over'
        });
        log.made++;
        return c;
    };
}

describe('the trail art is made once per sprite', () => {
    it('one read of the sprite; for each count its shadows in their darkening colours', () => {
        const log = { reads: 0, made: 0 };
        const art = trailArt({ naturalWidth: 32, naturalHeight: 32 }, fakeCanvasMaker(log));
        expect(log.reads).toBe(1);
        expect(art.colour).toBe('#ce7b2d');
        for (let n = 1; n <= 7; n++) {
            expect(art.byCount[n]).toHaveLength(n);
            art.byCount[n].forEach((c, i) => expect(c.fills).toEqual([shadowColour(PRIMARY, i, n)]));
        }
        // A colour two counts share is one canvas.
        expect(art.byCount[5][0]).toBe(art.byCount[1][0]);
        expect(art.byCount[5][4]).toBe(art.byCount[2][1]);
    });

    it('a sprite that cannot be read has no trail', () => {
        const art = trailArt({ naturalWidth: 32, naturalHeight: 32 }, () => ({
            getContext: () => ({ drawImage() {}, getImageData() { throw new Error('tainted'); } })
        }));
        expect(art).toBeNull();
    });
});

describe('⭐ in flight', () => {
    let queue, clock, images, reads, drawn, landed, unsub;
    const SHADOW = 'shadow';

    beforeEach(() => {
        queue = []; clock = 0; images = []; reads = 0; drawn = []; landed = [];
        Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
        vi.spyOn(performance, 'now').mockImplementation(() => clock);
        vi.stubGlobal('requestAnimationFrame', (cb) => { queue.push(cb); return queue.length; });
        vi.stubGlobal('cancelAnimationFrame', () => { queue = []; });
        vi.stubGlobal('Image', class { constructor() { this.naturalWidth = 32; this.naturalHeight = 32; images.push(this); } });
        // Every canvas: the overlay's own and the trail's silhouettes, told apart by `kind`.
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
            const el = this;
            return {
                setTransform() {}, clearRect() {}, fillRect() {}, fillText() {},
                getImageData: () => { reads++; return { data: spritePixels() }; },
                drawImage(img) {
                    if (el.dataset.kind === 'overlay') drawn.push(img instanceof HTMLCanvasElement ? SHADOW : 'item');
                    else el.dataset.kind = 'trail';
                }
            };
        });
        unsub = EventBus.subscribe(UI_EVENTS.PARTICLE_LANDED, (p) => landed.push({ ...p, at: clock }));
    });

    afterEach(() => {
        unsub?.();
        cleanup();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        delete window.innerWidth;
        delete window.innerHeight;
    });

    /** Fly `quantity` of one item and play every frame; per frame, how many shadows and items drew. */
    function flight(quantity, refId = 'item_ore') {
        const { container } = render(React.createElement(ParticleOverlay, { disabled: false }));
        const canvas = container.querySelector('canvas');
        canvas.dataset.kind = 'overlay';
        act(() => {
            EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
                kind: 'item', refId, quantity, fromScreenX: 300, fromScreenY: 700, toScreenX: 1200, toScreenY: 200
            });
        });
        for (const img of images) img.onload?.();
        const frames = [];
        for (let n = 0; queue.length && n < 4000; n++) {
            clock += 4;
            const due = queue; queue = [];
            drawn = [];
            for (const cb of due) cb(clock);
            frames.push({ at: clock, shadows: drawn.filter(d => d === SHADOW).length, items: drawn.filter(d => d === 'item').length });
        }
        return frames;
    }

    it.each([[1, 1], [40, 2], [300, 3], [2500, 4], [12000, 5], [400000, 6], [3000000, 7]])('a stack of %i trails up to %i shadows', (qty, n) => {
        const frames = flight(qty);
        expect(Math.max(...frames.map(f => f.shadows))).toBe(n);
    });

    it('the landing comes when it always did; the shadows then catch up with it and stop', () => {
        const dur = flightDurationMs(Math.hypot(900, 500));
        const frames = flight(3000000);
        expect(landed).toHaveLength(1);
        // Collected at 0, frames every 4 ms: it lands on the first frame at or past its duration.
        expect(landed[0].at).toBe(Math.ceil(dur / 4) * 4);
        const after = frames.filter(f => f.at > landed[0].at);
        expect(after.every(f => f.items === 0)).toBe(true);
        expect(after.some(f => f.shadows > 0)).toBe(true);
        expect(frames.at(-1).at - landed[0].at).toBeLessThanOrEqual(7 * TRAIL_STEP_MS + 8);
    });

    it('no colour work per frame: one read of the sprite for many flights of it', () => {
        flight(12000);
        expect(reads).toBe(1);
        act(() => {
            for (let i = 0; i < 6; i++) {
                EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
                    kind: 'item', refId: 'item_ore', quantity: 5, fromScreenX: 300, fromScreenY: 700, toScreenX: 1200, toScreenY: 200
                });
            }
        });
        for (let n = 0; queue.length && n < 4000; n++) { clock += 4; const due = queue; queue = []; for (const cb of due) cb(clock); }
        expect(reads).toBe(1);
    });
});

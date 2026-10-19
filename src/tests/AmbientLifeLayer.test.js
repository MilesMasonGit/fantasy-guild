// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { buildGroundPlan } from '../systems/board/TerrainSurface.js';
import { buildScreenPass } from '../ui/components/board/groundScreen.js';
import { groundLife } from '../ui/components/board/ambientGround.js';
import { MAT_Z, STACK_PLACES, placeZ } from '../ui/components/board/matLayers.js';
import { setTuning, resetTuning } from '../config/playmatTuning.js';
import { setDrawn, resetDrawSwitches } from '../ui/dev/perf/drawSwitches.js';
import { groundWith } from './fixtures/ground.js';

/** Every step the layer asks the shared sprite clock for, so a test can step it by hand. */
const clock = vi.hoisted(() => ({ steps: [], stopped: 0 }));
vi.mock('../ui/components/board/frameClock.js', async (original) => ({
    ...(await original()),
    onDue: (fn) => {
        clock.steps.push(fn);
        return () => { clock.stopped++; clock.steps = clock.steps.filter(s => s !== fn); };
    }
}));

const { AmbientLife } = await import('../ui/components/board/AmbientLife.jsx');

/**
 * ⭐ The ambient life's layers on the mat: a canvas per ground effect under every Token, the sky's
 * small sprites over them, each kept in the mat's own layer (T-145) and stepped on the shared
 * sprite clock, which stops while the window is hidden or minimised. Off under reduced motion,
 * and per effect by its Ground tuner switch and its drawing switch.
 */

const h = React.createElement;
let calls;
let puts;

beforeEach(() => {
    calls = [];
    puts = [];
    clock.steps = [];
    clock.stopped = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(type, attrs) {
        calls.push({ canvas: this, type, attrs });
        return {
            createImageData: (w, hgt) => ({ width: w, height: hgt, data: new Uint8ClampedArray(w * hgt * 4) }),
            putImageData: (...args) => { puts.push({ canvas: this, args }); },
            clearRect: () => {},
            fillRect: () => {}
        };
    });
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    resetTuning();
    resetDrawSwitches();
});

/** A picture of grass round a lake, as `TerrainCanvas` hands it on. */
function picture() {
    const ground = groundWith(24, 14, (c, r) => (((c - 16) / 5) ** 2 + ((r - 7) / 4) ** 2 < 1 ? 'water' : 'grass'), { seed: 21, biomes: null });
    const plan = buildGroundPlan(ground);
    const pass = buildScreenPass(plan, { mat: ground.mat, unit: 4, pixel: 2, sheet: () => null, pieces: true });
    return { plan, mat: ground.mat, cols: pass.cols, rows: pass.rows, unit: pass.unit, pixel: 2, fit: 1, life: groundLife(pass, plan) };
}

const mount = (props = {}) => render(h('div', null, h(AmbientLife, { picture: picture(), tokens: [], workedBy: new Map(), carriedId: null, ...props })));
const step = (n = 1) => act(() => {
    for (let k = 0; k < n; k++) for (const fn of [...clock.steps]) fn(performance.now());
});

describe('⭐ the ambient life on the mat', () => {
    it('⭐ draws the ground\'s effects under every Token and the sky over every Token', () => {
        const { container } = mount();
        const water = container.querySelector('canvas[data-ambient="water"]');
        const gust = container.querySelector('canvas[data-ambient="gust"]');
        const sky = container.querySelector('[data-ambient-sky]');
        expect(water).not.toBeNull();
        expect(gust).not.toBeNull();
        expect(sky).not.toBeNull();
        for (const el of [water, gust]) {
            expect(Number(el.style.zIndex)).toBe(MAT_Z.GROUND_FX);
            expect(Number(el.style.zIndex)).toBeGreaterThan(MAT_Z.GROUND);
            expect(Number(el.style.zIndex)).toBeLessThan(MAT_Z.TOKEN_BASE);
        }
        expect(Number(sky.style.zIndex)).toBeGreaterThan(placeZ(STACK_PLACES) + 2);
        expect(Number(sky.style.zIndex)).toBeLessThan(MAT_Z.RINGS);
        expect(sky.style.pointerEvents || 'none').toBe('none');
    });

    it('⭐ keeps every canvas in the mat\'s own layer: a CPU context, no will-change, filter or opacity', () => {
        const { container } = mount();
        step(200);
        const canvases = [...container.querySelectorAll('canvas')];
        expect(canvases.some(c => c.hasAttribute('data-ambient-sprite'))).toBe(true);
        for (const canvas of canvases) {
            const own = calls.filter(c => c.canvas === canvas);
            expect(own.length).toBeGreaterThan(0);
            for (const c of own) {
                expect(c.type).toBe('2d');
                expect(c.attrs).toEqual({ willReadFrequently: true });
            }
            expect(canvas.style.willChange).toBe('');
            expect(canvas.style.filter).toBe('');
            expect(canvas.style.opacity).toBe('');
            // The ground's canvases stand still; a sprite moves by a 2D translate only.
            if (canvas.hasAttribute('data-ambient-sprite')) expect(canvas.style.transform).toMatch(/^(translate\([^)]*\))?$/);
            else expect(canvas.style.transform).toBe('');
        }
    });

    it('⭐ puts back only the box a step changed, never the whole canvas', () => {
        const { container } = mount();
        const water = container.querySelector('canvas[data-ambient="water"]');
        puts.length = 0;
        step(20);
        const own = puts.filter(p => p.canvas === water);
        expect(own.length).toBeGreaterThan(0);
        for (const p of own) {
            expect(p.args).toHaveLength(7);
            // The lake's own box, a small part of the mat.
            expect(p.args[5] * p.args[6]).toBeLessThan(water.width * water.height / 4);
        }
    });

    it('⭐ steps on the shared sprite clock, once, and lets go of it when it leaves', () => {
        const { unmount } = mount();
        expect(clock.steps).toHaveLength(1);
        unmount();
        expect(clock.steps).toHaveLength(0);
    });

    it('⭐ draws nothing under reduced motion', () => {
        window.matchMedia = vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
        const { container } = mount();
        expect(container.querySelector('canvas')).toBeNull();
        expect(container.querySelector('[data-ambient-sky]')).toBeNull();
        expect(clock.steps).toHaveLength(0);
    });

    it('⭐ takes each effect away by its Ground tuner switch, and by its drawing switch', () => {
        const { container } = mount();
        act(() => { setTuning('ambientWater', 0); });
        expect(container.querySelector('canvas[data-ambient="water"]')).toBeNull();
        expect(container.querySelector('canvas[data-ambient="gust"]')).not.toBeNull();
        act(() => { setDrawn('ambientGust', false); });
        expect(container.querySelector('canvas[data-ambient="gust"]')).toBeNull();
        act(() => { setTuning('ambientBirds', 0); setTuning('ambientClouds', 0); setTuning('ambientParticles', 0); });
        expect(container.querySelector('[data-ambient-sky]')).toBeNull();
        expect(clock.steps).toHaveLength(0);
    });

    it('draws nothing without a picture of the ground', () => {
        const { container } = mount({ picture: null });
        expect(container.firstChild.innerHTML).toBe('');
    });
});

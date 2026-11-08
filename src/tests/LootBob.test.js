// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { PixelArt, boardScaleAt, boardArtSteps } from '../ui/components/base/TokenSprite.jsx';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import { BOB_STOPS, BOB_STOP_MS, BOB_PERIOD_MS, BOB_PHASE_GRID_MS, BOB_HOLD, bobAt } from '../ui/components/board/lootBob.js';
import { setSpriteFxManifest } from '../ui/utils/spriteFx.js';

/**
 * ⭐ **A pile's bob is written on the shared sprite clock, not run as a CSS animation.** A transform
 * animation gives every pile a composited layer of its own, and what is drawn after it (the next
 * pile, its quantity badge, the work plates) another for overlap: 39 piles were 98 more layers
 * (measured, `floor40`: 129 against 31), and every frame of every kind pays for each layer. The bob
 * keeps its fourteen stops of 140 ms, each pile on its own phase.
 *
 * ⭐ **It moves in whole art pixels, 1 to 4, and its shadow stays on the ground** (owner,
 * 2026-11-08). A stop of whole mat units is a fraction of a screen pixel at most fits: the art was
 * drawn a row short at some stops (it pinched), and the shadow, moving in the same box but placed
 * another way, drifted against it.
 */

const h = React.createElement;
const SRC = '/assets/items/test/pile.png';

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

const pile = (container) => container.querySelector('.gi-sprite-hover');
const atFit = (fit, el) => h(MatFitProvider, { value: fit }, el);
/** How far the bob's transform (mat units) raises the art on screen, in screen pixels. */
const screenLift = (el, fit) => -Number(/^translateY\((-?[\d.e-]+)px\)$/.exec(el.style.transform)[1]) * fit;

beforeEach(() => {
    queue = [];
    nextId = 1;
    clock = 1000;
    framesAsked = 0;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('requestAnimationFrame', (cb) => { framesAsked++; const id = nextId++; queue.push({ id, cb }); return id; });
    vi.stubGlobal('cancelAnimationFrame', (id) => { queue = queue.filter(q => q.id !== id); });
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('the bob, as a table', () => {
    it('⭐ fourteen stops of 140 ms, 1 to 4 whole art pixels up, as long at the top as at the bottom', () => {
        expect(BOB_STOPS).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 4, 3, 3, 2, 2, 1]);
        expect(BOB_STOP_MS).toBe(140);
        expect(BOB_PERIOD_MS).toBe(1960);
        expect(BOB_STOPS.every(Number.isInteger)).toBe(true);
        expect([Math.min(...BOB_STOPS), Math.max(...BOB_STOPS)]).toEqual([1, 4]);
        // Round the loop, the bottom (the last stop and the first two) and the top hold three stops each.
        expect(BOB_STOPS.filter(k => k === 1)).toHaveLength(3);
        expect(BOB_STOPS.filter(k => k === 4)).toHaveLength(3);
    });

    it('holds each stop for its whole 140 ms, and wraps', () => {
        expect(bobAt(0)).toBe(1);
        expect(bobAt(139)).toBe(1);
        expect(bobAt(2 * 140)).toBe(2);
        expect(bobAt(6 * 140)).toBe(4);
        expect(bobAt(1959)).toBe(1);
        expect(bobAt(1960)).toBe(1);
        expect(bobAt(1960 + 2 * 140)).toBe(2);
    });
});

describe('⭐ a pile on the floor', () => {
    it('is raised from its first paint, before any frame has run: one art pixel (2 px at the mat drawn 1:1)', () => {
        const { container } = render(h(PixelArt, { src: SRC, size: 64, hovering: true }));
        expect(pile(container).style.transform).toBe('translateY(-2px)');
    });

    it('steps through the stops on time, in art pixels of 2 px at the mat drawn 1:1', () => {
        const { container } = render(h(PixelArt, { src: SRC, size: 64, hovering: true }));
        const el = pile(container);
        const seen = [el.style.transform];
        for (let t = 0; t < BOB_PERIOD_MS + 140; t += 6) {
            frame();
            if (el.style.transform !== seen[seen.length - 1]) seen.push(el.style.transform);
        }
        const expected = ['-2', '-4', '-6', '-8', '-6', '-4', '-2'].map(v => `translateY(${v}px)`);
        expect(seen).toEqual(expected);
    });

    it('⭐ at every fit each stop is k whole art pixels: k × boardScaleAt(fit) mat units, k × the art step on screen', () => {
        for (const fit of [0.55, 0.76, 0.83, 1, 1.4]) {
            const { container, unmount } = render(atFit(fit, h(PixelArt, { src: SRC, size: 64, hovering: true })));
            const el = pile(container);
            const heights = new Set();
            for (let t = 0; t < BOB_PERIOD_MS; t += 6) {
                frame();
                const k = screenLift(el, fit) / boardArtSteps(fit);
                expect(k).toBeCloseTo(Math.round(k), 9);
                expect(screenLift(el, 1)).toBeCloseTo(Math.round(k) * boardScaleAt(fit), 9);
                heights.add(Math.round(k));
            }
            expect([...heights].sort()).toEqual([1, 2, 3, 4]);
            unmount();
        }
    });

    it('a new fit restarts it in the new art pixel', () => {
        const view = render(atFit(1, h(PixelArt, { src: SRC, size: 64, hovering: true })));
        expect(pile(view.container).style.transform).toBe('translateY(-2px)');
        // At a fit of 0.5 the art is drawn 1×: one art pixel is one screen pixel.
        view.rerender(atFit(0.5, h(PixelArt, { src: SRC, size: 64, hovering: true })));
        expect(screenLift(pile(view.container), 0.5)).toBeCloseTo(1, 9);
        view.rerender(atFit(1.6, h(PixelArt, { src: SRC, size: 64, hovering: true })));
        expect(screenLift(pile(view.container), 1.6)).toBeCloseTo(3, 9);
    });

    it('⭐ its shadow stays on the ground: outside the box that bobs, and the bob never writes it', () => {
        setSpriteFxManifest({ sprites: { 'assets/items/test/pile.png': { w: 32, h: 32, outlined: false } } });
        try {
            const { container } = render(h(PixelArt, { src: SRC, size: 64, hovering: true }));
            const art = pile(container);
            const shadow = container.querySelector('[data-sprite-shadow]');
            expect(shadow).not.toBeNull();
            expect(art.contains(shadow)).toBe(false);
            expect(art.contains(container.querySelector('img:not([data-sprite-shadow])'))).toBe(true);
            const placed = shadow.getAttribute('style');
            run(BOB_PERIOD_MS);
            expect(shadow.getAttribute('style')).toBe(placed);
        } finally {
            setSpriteFxManifest(null);
        }
    });

    it('writes only when its stop changes: six writes a period, not one a frame', () => {
        const { container } = render(h(PixelArt, { src: SRC, size: 64, hovering: true }));
        const el = pile(container);
        const seen = new MutationObserver(() => {});
        seen.observe(el, { attributes: true, attributeFilter: ['style'] });
        let writes = 0;
        for (let t = 0; t < BOB_PERIOD_MS; t += 6) {
            frame();
            writes += seen.takeRecords().length;
        }
        seen.disconnect();
        expect(writes).toBe(6);
    });

    it('keeps its own phase: two piles landed apart bob apart, as they always did', () => {
        const a = render(h(PixelArt, { src: SRC, size: 64, hovering: true }));
        run(420);
        const b = render(h(PixelArt, { src: SRC, size: 64, hovering: true }));
        run(10);
        expect(pile(a.container).style.transform).toBe('translateY(-4px)');
        expect(pile(b.container).style.transform).toBe('translateY(-2px)');
    });

    it('forty piles share one clock: at most one animation frame per wake, none between stops', () => {
        const piles = [];
        for (let i = 0; i < 40; i++) piles.push(render(h(PixelArt, { src: SRC, size: 64, hovering: true })));
        framesAsked = 0;
        run(BOB_STOP_MS * 2);
        // Born together, so they step together: two steps in 280 ms.
        expect(framesAsked).toBeLessThanOrEqual(3);
        for (const p of piles) expect(pile(p.container).style.transform).toBe('translateY(-4px)');
    });

    it('⭐ piles landed apart step on one grid: a frame of the bob a quarter stop at most, not one every frame', () => {
        const piles = [];
        for (let i = 0; i < 40; i++) {
            piles.push(render(h(PixelArt, { src: SRC, size: 64, hovering: true })));
            run(13);
        }
        framesAsked = 0;
        run(BOB_PERIOD_MS);
        // 56 grid points a period. Each pile writing whenever it pleased: a frame nearly every frame (326).
        expect(framesAsked).toBeLessThanOrEqual(BOB_PERIOD_MS / BOB_PHASE_GRID_MS);
        for (const p of piles) expect(pile(p.container).style.transform).toMatch(/^translateY\(-\d+px\)$/);
    });

    it('leaves the clock when it goes: nothing is scheduled after the last pile', () => {
        const { unmount } = render(h(PixelArt, { src: SRC, size: 64, hovering: true }));
        frame();
        unmount();
        framesAsked = 0;
        queue = [];
        run(BOB_PERIOD_MS);
        expect(framesAsked).toBe(0);
    });

    it('⭐ with reduced motion it is held 3 whole art pixels up, from JavaScript, and asks for no frame', () => {
        vi.stubGlobal('matchMedia', (q) => ({ matches: /reduce/.test(q) }));
        expect(BOB_HOLD).toBe(3);
        for (const fit of [0.55, 0.83, 1]) {
            const { container, unmount } = render(atFit(fit, h(PixelArt, { src: SRC, size: 64, hovering: true })));
            framesAsked = 0;
            run(BOB_PERIOD_MS);
            expect(framesAsked).toBe(0);
            expect(screenLift(pile(container), fit)).toBeCloseTo(3 * boardArtSteps(fit), 9);
            unmount();
        }
        // No fixed-px rule in the stylesheet: a fixed px is a fraction of an art pixel at most fits.
        const css = fs.readFileSync(path.join(process.cwd(), 'src/tailwind.css'), 'utf8');
        expect(css).not.toMatch(/\.gi-sprite-hover\s*\{[^}]*transform/);
    });

    it('a sprite that does not hover never touches the clock', () => {
        const { container } = render(h(PixelArt, { src: SRC, size: 64, outline: null }));
        framesAsked = 0;
        run(300);
        expect(framesAsked).toBe(0);
        expect(pile(container)).toBeNull();
    });
});

describe('⭐ no compositor animation is left on a pile', () => {
    it('no CSS animation names the hover: a keyframed transform is a layer per pile, and overlap layers after it', () => {
        const css = fs.readFileSync(path.join(process.cwd(), 'src/tailwind.css'), 'utf8');
        expect(css).not.toMatch(/@keyframes gi-sprite-hover/);
        expect(css).not.toMatch(/animation:\s*gi-sprite-hover/);
    });
});

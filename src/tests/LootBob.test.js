// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { PixelArt } from '../ui/components/base/TokenSprite.jsx';
import { BOB_STOPS, BOB_STOP_MS, BOB_PERIOD_MS, BOB_PHASE_GRID_MS, bobAt } from '../ui/components/board/lootBob.js';

/**
 * ⭐ **A pile's bob is written on the shared sprite clock, not run as a CSS animation.** A transform
 * animation gives every pile a composited layer of its own, and what is drawn after it (the next
 * pile, its quantity badge, the work plates) another for overlap: 39 piles were 98 more layers
 * (measured, `floor40`: 129 against 31), and every frame of every kind pays for each layer. The bob
 * still looks the same: the same fourteen stops, each pile on its own phase.
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
    it('fourteen stops of 140 ms, whole pixels, the same as the keyframes it replaced', () => {
        expect(BOB_STOPS).toEqual([-3, -4, -5, -6, -7, -8, -9, -9, -8, -7, -6, -5, -4, -3]);
        expect(BOB_STOP_MS).toBe(140);
        expect(BOB_PERIOD_MS).toBe(1960);
        expect(BOB_STOPS.every(Number.isInteger)).toBe(true);
    });

    it('holds each stop for its whole 140 ms, and wraps', () => {
        expect(bobAt(0)).toBe(-3);
        expect(bobAt(139)).toBe(-3);
        expect(bobAt(140)).toBe(-4);
        expect(bobAt(6 * 140)).toBe(-9);
        expect(bobAt(1959)).toBe(-3);
        expect(bobAt(1960)).toBe(-3);
        expect(bobAt(1960 + 140)).toBe(-4);
    });
});

describe('⭐ a pile on the floor', () => {
    it('is raised from its first paint, before any frame has run', () => {
        const { container } = render(h(PixelArt, { src: SRC, size: 64, hovering: true }));
        expect(pile(container).style.transform).toBe('translateY(-3px)');
    });

    it('steps through the stops on time, art and shadow in one box', () => {
        const { container } = render(h(PixelArt, { src: SRC, size: 64, hovering: true }));
        const el = pile(container);
        const seen = [el.style.transform];
        for (let t = 0; t < BOB_PERIOD_MS + 140; t += 6) {
            frame();
            if (el.style.transform !== seen[seen.length - 1]) seen.push(el.style.transform);
        }
        const expected = ['-3', '-4', '-5', '-6', '-7', '-8', '-9', '-8', '-7', '-6', '-5', '-4', '-3', '-4'].map(v => `translateY(${v}px)`);
        expect(seen).toEqual(expected);
    });

    it('writes only when its stop changes: twelve writes a period, not one a frame', () => {
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
        expect(writes).toBe(12);
    });

    it('keeps its own phase: two piles landed apart bob apart, as they always did', () => {
        const a = render(h(PixelArt, { src: SRC, size: 64, hovering: true }));
        run(420);
        const b = render(h(PixelArt, { src: SRC, size: 64, hovering: true }));
        run(10);
        expect(pile(a.container).style.transform).toBe('translateY(-6px)');
        expect(pile(b.container).style.transform).toBe('translateY(-3px)');
    });

    it('forty piles share one clock: at most one animation frame per wake, none between stops', () => {
        const piles = [];
        for (let i = 0; i < 40; i++) piles.push(render(h(PixelArt, { src: SRC, size: 64, hovering: true })));
        framesAsked = 0;
        run(BOB_STOP_MS * 2);
        // Born together, so they step together: two steps in 280 ms.
        expect(framesAsked).toBeLessThanOrEqual(3);
        for (const p of piles) expect(pile(p.container).style.transform).toBe('translateY(-5px)');
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

    it('with reduced motion it stays raised and asks for no frame (the CSS rule holds it)', () => {
        vi.stubGlobal('matchMedia', (q) => ({ matches: /reduce/.test(q) }));
        const { container } = render(h(PixelArt, { src: SRC, size: 64, hovering: true }));
        framesAsked = 0;
        run(BOB_PERIOD_MS);
        expect(framesAsked).toBe(0);
        expect(pile(container).style.transform).toBe('');
        const css = fs.readFileSync(path.join(process.cwd(), 'src/tailwind.css'), 'utf8');
        expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.gi-sprite-hover\s*\{\s*transform: translateY\(-6px\);/);
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

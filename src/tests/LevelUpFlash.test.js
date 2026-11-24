// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { floatsOf, clearAllFloats } from '../ui/components/board/levelUpFloats.js';
import {
    LEVEL_UP_FLASH, BIG_FLASH_LEVELS, flashSizeFor, flashFrame, flashEndMs, currentFlashes, clearAllFlashes,
    FLASH_GOLD, FLASH_WHITE
} from '../ui/components/board/levelUpFlash.js';
import { LevelUpFlashLayer } from '../ui/components/board/LevelUpFlashLayer.jsx';
import { setDrawingPaused } from '../ui/components/board/frameClock.js';
import { manualFrames } from './fixtures/manualFrames.js';

/**
 * The level-up flash (brief 800 F2, picked from the page's tile D): glowing rings spread from the
 * hero one after another, fading as they grow, with a shower of sparkles; small every 5 levels, big
 * at 10, 25, 50, 75 and 99. It starts with the level-up float, plays once and is gone: nothing at
 * rest, none while minimised, under reduced motion or for the level-ups of time away.
 */

const h = React.createElement;
const heroes = [{ heroId: 'h1', state: 'working', x: 300, y: 500, moving: false }];
const level = (oldLevel, newLevel, heroId = 'h1') => act(() => {
    EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, { heroId, skillId: 'mining', skillName: 'Mining', oldLevel, newLevel });
});

/** A 2D context that records what is drawn, as jsdom draws nothing. */
function recordCanvas() {
    const calls = [];
    const ctx = {
        globalAlpha: 1,
        fillStyle: '#000',
        clearRect: () => calls.push(['clear']),
        fillRect(x, y) { calls.push(['fill', this.fillStyle, this.globalAlpha, x, y]); }
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx);
    return calls;
}

let frames;
beforeEach(() => {
    frames = manualFrames();
    clearAllFlashes();
    clearAllFloats();
});
afterEach(() => {
    cleanup();
    setDrawingPaused(false);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('which flash a level-up gets', () => {
    it('big at 10, 25, 50, 75 and 99; small at every other 5; none between', () => {
        for (const L of BIG_FLASH_LEVELS) expect(flashSizeFor(L - 1, L)).toBe('big');
        for (const L of [5, 15, 20, 30, 45, 60, 95]) expect(flashSizeFor(L - 1, L)).toBe('small');
        for (const L of [2, 7, 11, 24, 51, 98]) expect(flashSizeFor(L - 1, L)).toBeNull();
    });

    it('a jump of several levels takes the biggest it passes', () => {
        expect(flashSizeFor(8, 11)).toBe('big');
        expect(flashSizeFor(11, 16)).toBe('small');
        expect(flashSizeFor(16, 19)).toBeNull();
    });

    it('the big one has more rings, wider, and more sparkles than the small one', () => {
        const { small, big } = LEVEL_UP_FLASH;
        expect(big.rings.count).toBeGreaterThan(small.rings.count);
        expect(big.rings.R).toBeGreaterThan(small.rings.R);
        expect(big.sparkles.count).toBeGreaterThan(small.sparkles.count);
        // Halfway through its first ring the big one shows more at once.
        const at = (size) => flashFrame(size, LEVEL_UP_FLASH[size].rings.growMs * 0.75, 1);
        expect(at('big').rings.length).toBeGreaterThan(at('small').rings.length);
        expect(at('big').sparkles.length).toBeGreaterThan(at('small').sparkles.length);
    });

    it('each ring grows from the hero and fades in steps as it grows, gone at its radius', () => {
        const { rings } = LEVEL_UP_FLASH.big;
        const first = (t) => flashFrame('big', t, 1).rings.find(r => r.colour === FLASH_WHITE && t < rings.growMs);
        expect(first(rings.growMs * 0.1).alpha).toBe(1);
        expect(first(rings.growMs * 0.95).alpha).toBeLessThan(first(rings.growMs * 0.5).alpha);
        expect(first(rings.growMs * 0.95).r).toBeGreaterThan(first(rings.growMs * 0.5).r);
        const end = flashFrame('big', flashEndMs('big'), 1);
        expect(end.rings).toEqual([]);
        expect(end.sparkles).toEqual([]);
    });
});

describe('a level-up on the mat', () => {
    it('starts with the float, on the same level-up, at the same moment', () => {
        level(9, 10);
        expect(floatsOf('h1')).toHaveLength(1);
        const [flash] = currentFlashes();
        expect(flash).toMatchObject({ heroId: 'h1', size: 'big', at: performance.now() });
    });

    it('small every 5 levels, big at the majors, none between', () => {
        level(4, 5, 'h1');
        level(74, 75, 'h2');
        level(6, 7, 'h3');
        expect(currentFlashes().map(f => [f.heroId, f.size])).toEqual([['h1', 'small'], ['h2', 'big']]);
    });

    it('plays once over the hero and is gone, asking for no frames at rest', () => {
        const calls = recordCanvas();
        const { container } = render(h(LevelUpFlashLayer, { heroes }));
        expect(container.querySelector('[data-level-flash-layer]')).toBeNull();
        expect(frames.pending()).toBe(0);

        level(24, 25);
        const canvas = container.querySelector('[data-level-flash="h1"]');
        expect(canvas.getAttribute('data-level-flash-size')).toBe('big');
        expect(frames.pending()).toBe(1);
        frames.run(300);
        expect(calls.some(([k, colour]) => k === 'fill' && colour === FLASH_GOLD)).toBe(true);
        expect(canvas.style.visibility).toBe('');
        expect(canvas.style.transform).toContain('translate(');

        frames.run(flashEndMs('big'));
        expect(container.querySelector('[data-level-flash-layer]')).toBeNull();
        expect(currentFlashes()).toEqual([]);
        expect(frames.pending()).toBe(0);
    });

    it('none while the window is minimised', () => {
        setDrawingPaused(true);
        level(9, 10);
        expect(floatsOf('h1')).toHaveLength(1);
        expect(currentFlashes()).toEqual([]);
    });

    it('none under reduced motion', () => {
        vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce'), media: q }));
        level(9, 10);
        expect(currentFlashes()).toEqual([]);
    });

    it('none for the level-ups of time away: the summary tells them', () => {
        for (const show of [false, true]) {
            act(() => {
                EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, {
                    show,
                    summary: { levelUps: [{ heroId: 'h1', skillId: 'mining', skillName: 'Mining', from: 8, to: 10 }] }
                });
                EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'catch_up' });
            });
            expect(currentFlashes()).toEqual([]);
        }
    });

    it('a hero already flashing keeps theirs unless the new one is bigger', () => {
        level(4, 5);
        const small = currentFlashes()[0];
        level(14, 15);
        expect(currentFlashes()).toEqual([small]);
        level(9, 10);
        expect(currentFlashes().map(f => f.size)).toEqual(['big']);
    });
});

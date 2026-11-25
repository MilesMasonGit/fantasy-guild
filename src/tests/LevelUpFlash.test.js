// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { floatsOf, clearAllFloats } from '../ui/components/board/levelUpFloats.js';
import {
    LEVEL_UP_FLASH, SPARKLE_STEPS, SPARKLE_FLY_MS, flashSizeFor, flashFrame, flashEndMs, currentFlashes, clearAllFlashes,
    FLASH_GOLD, FLASH_WHITE
} from '../ui/components/board/levelUpFlash.js';
import { LevelUpFlashLayer } from '../ui/components/board/LevelUpFlashLayer.jsx';
import { setDrawingPaused } from '../ui/components/board/frameClock.js';
import { manualFrames } from './fixtures/manualFrames.js';

/**
 * The level-up flash (brief 800 F2, picked from the page's tile D): glowing rings spread from the
 * hero one after another, fading as they grow, with a shower of sparkles; the same big one for every
 * level gained. It starts with the level-up float, plays once and is gone: nothing at
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
    it('every level gained gets the big flash, none for no gain', () => {
        expect(flashSizeFor(3, 4)).toBe('big');
        for (const L of [2, 5, 7, 10, 11, 24, 51, 99]) expect(flashSizeFor(L - 1, L)).toBe('big');
        expect(flashSizeFor(8, 11)).toBe('big');
        expect(flashSizeFor(5, 5)).toBeNull();
        expect(flashSizeFor(5, 4)).toBeNull();
        expect(flashSizeFor(3, NaN)).toBeNull();
        expect(flashSizeFor(3, undefined)).toBeNull();
    });

    it('there is one flash, lasting 1.75 times as long as it did', () => {
        expect(Object.keys(LEVEL_UP_FLASH)).toEqual(['big']);
        const { rings, sparkles } = LEVEL_UP_FLASH.big;
        expect([rings.growMs, rings.staggerMs, sparkles.jitterMs, SPARKLE_FLY_MS]).toEqual([1120, 193, 525, 788]);
        expect(SPARKLE_STEPS.map(([until]) => until)).toEqual([263, 525, 788, 910, 1085, 1260, 1365, 1505]);
        expect(flashEndMs('big')).toBe(2310);
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

    it('every level gained flashes big', () => {
        level(4, 5, 'h1');
        level(74, 75, 'h2');
        level(6, 7, 'h3');
        expect(currentFlashes().map(f => [f.heroId, f.size])).toEqual([['h1', 'big'], ['h2', 'big'], ['h3', 'big']]);
    });

    it('plays once over the hero and is gone, asking for no frames at rest', () => {
        const calls = recordCanvas();
        const { container } = render(h(LevelUpFlashLayer, { heroes }));
        expect(container.querySelector('[data-levelup-burst-layer]')).toBeNull();
        expect(frames.pending()).toBe(0);

        level(24, 25);
        const canvas = container.querySelector('[data-levelup-burst="h1"]');
        expect(canvas.getAttribute('data-levelup-burst-size')).toBe('big');
        expect(frames.pending()).toBe(1);
        frames.run(300);
        expect(calls.some(([k, colour]) => k === 'fill' && colour === FLASH_GOLD)).toBe(true);
        expect(canvas.style.visibility).toBe('');
        expect(canvas.style.transform).toContain('translate(');

        frames.run(flashEndMs('big'));
        expect(container.querySelector('[data-levelup-burst-layer]')).toBeNull();
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

    it('a hero already flashing keeps theirs', () => {
        level(4, 5);
        const first = currentFlashes()[0];
        level(14, 15);
        expect(currentFlashes()).toEqual([first]);
    });
});

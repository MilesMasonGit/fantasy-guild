// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { AnimatedEnemySprite } from '../ui/components/board/AnimatedEnemySprite.jsx';
import { AnimatedHeroSprite } from '../ui/components/board/AnimatedHeroSprite.jsx';
import { heroSpriteFrame, HERO_FRAME_MS } from '../ui/components/board/hitAnimations.js';

vi.mock('../systems/board/BoardState.js', () => ({
    heroBodyOf: vi.fn(() => null)
}));

import * as BoardState from '../systems/board/BoardState.js';

/**
 * ⭐ **Which frame a sprite sheet shows, over time** (R10 §2).
 */

const h = React.createElement;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
    BoardState.heroBodyOf.mockReturnValue(null);
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Enemy sheets: 4 columns × 4 rows, idle = rows 0–1, attack = rows 2–3
// ---------------------------------------------------------------------------

const enemyCell = (container, size = 64) => {
    const el = container.querySelector('[role="img"]');
    const m = el.style.backgroundPosition.match(/(-?\d+(?:\.\d+)?)px (-?\d+(?:\.\d+)?)px/);
    return [Math.abs(Number(m[2])) / size, Math.abs(Number(m[1])) / size];   // [row, col]
};

describe('⭐ an enemy sheet plays its cells in order', () => {
    it('idle: rows 0–1, left to right, one cell per frame, then round again', () => {
        const { container } = render(h(AnimatedEnemySprite, { src: 'ani_cow.png', size: 64, frameMs: 100 }));
        const seen = [];
        for (let i = 0; i < 10; i++) {
            seen.push(enemyCell(container).join(','));
            act(() => { vi.advanceTimersByTime(100); });
        }
        expect(seen).toEqual(['0,0', '0,1', '0,2', '0,3', '1,0', '1,1', '1,2', '1,3', '0,0', '0,1']);
    });

    it('attack: the same eight cells two rows down, while a hero fights it', () => {
        BoardState.heroBodyOf.mockReturnValue({ side: -1 });
        const { container } = render(h(AnimatedEnemySprite, { src: 'ani_cow.png', heroId: 'h1', size: 64, frameMs: 100 }));
        const seen = [];
        for (let i = 0; i < 9; i++) {
            seen.push(enemyCell(container).join(','));
            act(() => { vi.advanceTimersByTime(100); });
        }
        expect(seen).toEqual(['2,0', '2,1', '2,2', '2,3', '3,0', '3,1', '3,2', '3,3', '2,0']);
    });

    it('a fight starting mid-cycle switches rows at once and keeps counting', () => {
        const props = { src: 'ani_cow.png', size: 64, frameMs: 100 };
        const { container, rerender } = render(h(AnimatedEnemySprite, props));
        act(() => { vi.advanceTimersByTime(300); });
        expect(enemyCell(container)).toEqual([0, 3]);
        BoardState.heroBodyOf.mockReturnValue({ side: -1 });
        rerender(h(AnimatedEnemySprite, { ...props, heroId: 'h1' }));
        expect(enemyCell(container)).toEqual([2, 3]);
        act(() => { vi.advanceTimersByTime(100); });
        expect(enemyCell(container)).toEqual([3, 0]);
    });

    it('a different size scales the cell, not the sequence', () => {
        const { container } = render(h(AnimatedEnemySprite, { src: 'ani_cow.png', size: 128, frameMs: 100 }));
        act(() => { vi.advanceTimersByTime(500); });
        expect(enemyCell(container, 128)).toEqual([1, 1]);
    });
});

// ---------------------------------------------------------------------------
// Hero sheets: 8 columns × 3 rows (attack, walk, idle), frame read from the clock
// ---------------------------------------------------------------------------

const ROW_INDEX = { attack: 0, walk: 1, idle: 2 };

const heroShown = (container) => {
    const root = container.querySelector('[data-hero-row]');
    const img = root.querySelector('img');
    const m = img.style.transform.match(/translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/);
    return {
        row: root.getAttribute('data-hero-row'),
        frame: Number(root.getAttribute('data-hero-frame')),
        dx: Math.abs(Number(m[1])),
        dy: Math.abs(Number(m[2]))
    };
};

/** Steps the clock a frame boundary at a time and checks the sprite against the rule at each. */
function expectFollowsClock(container, state, { heroId, frameMs = HERO_FRAME_MS, size = 64, steps = 20 }) {
    for (let i = 0; i < steps; i++) {
        const want = heroSpriteFrame(state, performance.now(), { heroId, frameMs });
        const got = heroShown(container);
        expect(got.row).toBe(want.row);
        expect(got.frame).toBe(want.frame);
        expect(got.dx).toBe(want.frame * size);
        expect(got.dy).toBe(ROW_INDEX[want.row] * size);
        act(() => { vi.advanceTimersByTime(want.nextInMs + 1); });
    }
}

describe('⭐ a hero sheet shows the frame the clock says', () => {
    it('working: the attack row on the hero\'s own phase (the Token strikes on the same clock)', () => {
        vi.advanceTimersByTime(12345);
        const { container } = render(h(AnimatedHeroSprite, { src: 'h.png', heroId: 'hero_7', size: 64, animationState: 'attack' }));
        expectFollowsClock(container, 'attack', { heroId: 'hero_7' });
    });

    it('walking and idle loop their own rows', () => {
        const walk = render(h(AnimatedHeroSprite, { src: 'h.png', heroId: 'hero_a', size: 128, animationState: 'walk' }));
        expectFollowsClock(walk.container, 'walk', { heroId: 'hero_a', size: 128 });
        cleanup();
        const idle = render(h(AnimatedHeroSprite, { src: 'h.png', heroId: 'hero_b', size: 64, animationState: 'idle' }));
        expectFollowsClock(idle.container, 'idle', { heroId: 'hero_b' });
    });

    it('a limping hero (250 ms frames) walks at half the pace', () => {
        const { container } = render(h(AnimatedHeroSprite, { src: 'h.png', heroId: 'hero_l', size: 64, animationState: 'walk', frameMs: 250 }));
        expectFollowsClock(container, 'walk', { heroId: 'hero_l', frameMs: 250 });
        // Over one second a limper shows 4 frames, a sound hero 8.
        const start = heroShown(container).frame;
        act(() => { vi.advanceTimersByTime(1000); });
        expect((heroShown(container).frame - start + 8) % 8).toBe(4);
    });

    it('a state change shows the new row at once', () => {
        const props = { src: 'h.png', heroId: 'hero_s', size: 64 };
        const { container, rerender } = render(h(AnimatedHeroSprite, { ...props, animationState: 'idle' }));
        expect(heroShown(container).row).toBe('idle');
        rerender(h(AnimatedHeroSprite, { ...props, animationState: 'walk' }));
        expect(heroShown(container).row).toBe('walk');
        expectFollowsClock(container, 'walk', { heroId: 'hero_s', steps: 5 });
    });

    it('a fight: one attack play-through from the attack, then idle', () => {
        const props = { src: 'h.png', heroId: 'hero_f', size: 64, animationState: 'combat' };
        const at = performance.now();
        const { container } = render(h(AnimatedHeroSprite, { ...props, attackAt: at }));
        // Sample mid-frame: each step lands just after its frame boundary.
        act(() => { vi.advanceTimersByTime(HERO_FRAME_MS / 2); });
        const rows = [];
        for (let i = 0; i < 10; i++) {
            const s = heroShown(container);
            rows.push(`${s.row}:${s.frame}`);
            act(() => { vi.advanceTimersByTime(HERO_FRAME_MS); });
        }
        expect(rows.slice(0, 8)).toEqual(['attack:0', 'attack:1', 'attack:2', 'attack:3', 'attack:4', 'attack:5', 'attack:6', 'attack:7']);
        expect(rows[8].startsWith('idle:')).toBe(true);
    });
});

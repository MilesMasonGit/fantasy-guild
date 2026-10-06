import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { Profiler } from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { AnimatedEnemySprite } from '../ui/components/board/AnimatedEnemySprite.jsx';
import { AnimatedHeroSprite } from '../ui/components/board/AnimatedHeroSprite.jsx';

vi.mock('../systems/board/BoardState.js', () => ({
    heroBodyOf: vi.fn(() => null)
}));

/**
 * ⭐ **A sprite's frame is a clock, not React state** (R6 rule 4).
 */

const h = React.createElement;
let commits;
const counted = (el) => h(Profiler, { id: 'sprite', onRender: () => { commits++; } }, el);

beforeEach(() => {
    commits = 0;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('⭐ frame steps commit nothing to React', () => {
    it('a walking hero: two seconds of frames, no commit after the first draw', () => {
        const { container } = render(counted(h(AnimatedHeroSprite, { src: 'h.png', heroId: 'hero_1', size: 64, animationState: 'walk' })));
        const afterMount = commits;
        const frames = new Set();
        for (let i = 0; i < 16; i++) {
            act(() => { vi.advanceTimersByTime(125); });
            frames.add(container.querySelector('[data-hero-frame]').getAttribute('data-hero-frame'));
        }
        expect(frames.size).toBe(8);          // it did animate
        expect(commits - afterMount).toBe(0); // without React
    });

    it('a fought enemy: two seconds of frames, no commit after the first draw', () => {
        const { container } = render(counted(h(AnimatedEnemySprite, { src: 'e.png', size: 64, frameMs: 125 })));
        const afterMount = commits;
        const cells = new Set();
        for (let i = 0; i < 16; i++) {
            act(() => { vi.advanceTimersByTime(125); });
            cells.add(container.querySelector('[role="img"]').style.backgroundPosition);
        }
        expect(cells.size).toBe(8);
        expect(commits - afterMount).toBe(0);
    });
});

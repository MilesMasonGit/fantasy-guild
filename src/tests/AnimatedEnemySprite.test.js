import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { AnimatedEnemySprite } from '../ui/components/board/AnimatedEnemySprite.jsx';

vi.mock('../systems/board/BoardState.js', () => ({
    heroBodyOf: vi.fn(() => null)
}));

import * as BoardState from '../systems/board/BoardState.js';

/**
 * ⭐ Enemy Animations EA-A. `AnimatedEnemySprite` is pure presentation —
 * no board, no engine, no events — so these mock `BoardState` entirely
 * rather than booting a board just to read one hero's `side`.
 */

const sprite = (container) => container.querySelector('[role="img"]');
const rowOf = (el) => {
    // backgroundPosition: "-{col*size}px -{row*size}px" — pull the y term
    // back into a row index at the fixture's own size (64). A zero offset
    // renders as "0px", not "-0px", so the minus sign is optional here.
    const m = el.style.backgroundPosition.match(/(-?\d+)px (-?\d+)px/);
    return Math.abs(Number(m[2])) / 64;
};
const colOf = (el) => {
    const m = el.style.backgroundPosition.match(/(-?\d+)px (-?\d+)px/);
    return Math.abs(Number(m[1])) / 64;
};

beforeEach(() => {
    vi.useFakeTimers();
    BoardState.heroBodyOf.mockReturnValue(null);
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe('⭐ which cycle plays (EAP-2)', () => {
    it('plays the idle cycle (rows 0-1) with no worker', () => {
        const { container } = render(
            React.createElement(AnimatedEnemySprite, { src: 'ani_cow.png', heroId: null, size: 64 })
        );
        expect(rowOf(sprite(container))).toBeLessThan(2);
    });

    it('plays the attack cycle (rows 2-3) while a hero works it', () => {
        BoardState.heroBodyOf.mockReturnValue({ side: -1 });
        const { container } = render(
            React.createElement(AnimatedEnemySprite, { src: 'ani_cow.png', heroId: 'h1', size: 64 })
        );
        expect(rowOf(sprite(container))).toBeGreaterThanOrEqual(2);
    });

    it('drops back to idle the instant the worker is gone — no fight-ended event needed', () => {
        BoardState.heroBodyOf.mockReturnValue({ side: -1 });
        const { container, rerender } = render(
            React.createElement(AnimatedEnemySprite, { src: 'ani_cow.png', heroId: 'h1', size: 64 })
        );
        expect(rowOf(sprite(container))).toBeGreaterThanOrEqual(2);

        rerender(React.createElement(AnimatedEnemySprite, { src: 'ani_cow.png', heroId: null, size: 64 }));
        expect(rowOf(sprite(container))).toBeLessThan(2);
    });
});

// Frame advance — which cell shows, in what order — is pinned as an exact
// sequence in `SpriteFrameSequence.test.js`, which does not care whether
// the frame is held in React state or written to the element.
describe('⭐ frame advance', () => {
    it('shows a different cell for each of the 8 frames of the active cycle', () => {
        const { container } = render(
            React.createElement(AnimatedEnemySprite, { src: 'ani_cow.png', size: 64, frameMs: 100 })
        );
        const seen = new Set();
        for (let i = 0; i < 8; i++) {
            seen.add(`${rowOf(sprite(container))},${colOf(sprite(container))}`);
            act(() => { vi.advanceTimersByTime(100); });
        }
        expect(seen.size).toBe(8);
    });
});

describe('⭐ facing (EA-2, EA-3, EA-4)', () => {
    it('starts facing left, the sheet\'s native pose — no flip', () => {
        const { container } = render(
            React.createElement(AnimatedEnemySprite, { src: 'ani_cow.png', size: 64 })
        );
        expect(container.querySelector('[style*="scaleX"]')).toBeNull();
    });

    it('turns to face a hero working it from the right (flipped)', () => {
        BoardState.heroBodyOf.mockReturnValue({ side: 1 });
        const { container } = render(
            React.createElement(AnimatedEnemySprite, { src: 'ani_cow.png', heroId: 'h1', size: 64 })
        );
        const flipped = container.querySelector('[style*="scaleX(-1)"]');
        expect(flipped).not.toBeNull();
    });

    it('stays facing left for a hero working it from the left (no flip)', () => {
        BoardState.heroBodyOf.mockReturnValue({ side: -1 });
        const { container } = render(
            React.createElement(AnimatedEnemySprite, { src: 'ani_cow.png', heroId: 'h1', size: 64 })
        );
        expect(container.querySelector('[style*="scaleX(-1)"]')).toBeNull();
    });

    it('turns on its own while idle, somewhere in the 12-24s window (EA-4)', () => {
        const { container } = render(
            React.createElement(AnimatedEnemySprite, { src: 'ani_cow.png', heroId: null, size: 64 })
        );
        expect(container.querySelector('[style*="scaleX(-1)"]')).toBeNull();

        act(() => { vi.advanceTimersByTime(11999); });
        expect(container.querySelector('[style*="scaleX(-1)"]')).toBeNull();

        act(() => { vi.advanceTimersByTime(12001); });
        expect(container.querySelector('[style*="scaleX(-1)"]')).not.toBeNull();
    });

    it('never turns on its own while a hero is fighting it', () => {
        BoardState.heroBodyOf.mockReturnValue({ side: -1 });
        const { container } = render(
            React.createElement(AnimatedEnemySprite, { src: 'ani_cow.png', heroId: 'h1', size: 64 })
        );
        act(() => { vi.advanceTimersByTime(30000); });
        expect(container.querySelector('[style*="scaleX(-1)"]')).toBeNull();
    });
});

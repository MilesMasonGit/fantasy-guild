import { describe, it, expect, afterEach, vi } from 'vitest';
import * as GameClock from '../systems/core/GameClock.js';

/**
 * The clock the rules read. Live it is the wall clock; in a catch-up it starts where the save was
 * written and moves only with the steps, because the wall clock barely moves while 24 hours play.
 */

afterEach(() => {
    GameClock.end();
    vi.useRealTimers();
});

describe('GameClock', () => {
    it('live, it is Date.now()', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1_800_000_000_000);
        expect(GameClock.isCatchingUp()).toBe(false);
        expect(GameClock.now()).toBe(Date.now());
        vi.advanceTimersByTime(5000);
        expect(GameClock.now()).toBe(1_800_000_005_000);
    });

    it('in a catch-up it starts at savedAt and moves only with the steps', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1_800_000_000_000);
        const savedAt = 1_800_000_000_000 - 24 * 3_600_000;

        GameClock.begin(savedAt);
        expect(GameClock.isCatchingUp()).toBe(true);
        expect(GameClock.now()).toBe(savedAt);

        vi.advanceTimersByTime(250);          // the wall clock moves; the game clock does not
        expect(GameClock.now()).toBe(savedAt);

        GameClock.advance(1000);
        GameClock.advance(1000);
        expect(GameClock.now()).toBe(savedAt + 2000);

        GameClock.end();
        expect(GameClock.isCatchingUp()).toBe(false);
        expect(GameClock.now()).toBe(Date.now());
    });

    it('advancing outside a catch-up changes nothing', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1_800_000_000_000);
        GameClock.advance(60_000);
        expect(GameClock.now()).toBe(1_800_000_000_000);
    });
});

import { describe, it, expect } from 'vitest';
import { getXpProgress, xpForLevel, levelFromXp } from '../utils/XPCurve.js';

describe('XPCurve', () => {
    describe('getXpProgress', () => {
        it('calculates progress for level 1', () => {
            const xp = xpForLevel(1);
            const progress = getXpProgress(xp);
            expect(progress.level).toBe(1);
            expect(progress.progress).toBe(0);
        });

        it('calculates 50% progress between levels', () => {
            const xp1 = xpForLevel(1);
            const xp2 = xpForLevel(2);
            const midXp = xp1 + (xp2 - xp1) / 2;
            const progress = getXpProgress(midXp);
            expect(progress.level).toBe(1);
            expect(progress.progress).toBe(0.5);
        });

        it('handles level 99 (max level) without divide by zero', () => {
            const xp99 = xpForLevel(99);
            const progress = getXpProgress(xp99);
            expect(progress.level).toBe(99);
            expect(progress.progress).toBe(1); // Should be 1, not NaN
        });

        it('handles level > 99 without divide by zero', () => {
            // Even if someone has more XP than level 99
            const xp99 = xpForLevel(99);
            const progress = getXpProgress(xp99 + 1000000);
            expect(progress.level).toBe(99);
            expect(progress.progress).toBe(1);
        });

        it('handles xp for next level (edge of 100%)', () => {
            const xp2 = xpForLevel(2);
            const progress = getXpProgress(xp2);
            expect(progress.level).toBe(2);
            expect(progress.progress).toBe(0);
        });
    });

    /**
     * ⭐ A golden over every level (written before its fix). The fix makes
     * `levelFromXp` read the pre-built XP table instead of re-summing the curve
     * for every candidate level; these pin today's answers at, just below and
     * between every threshold, so the faster lookup must agree exactly.
     */
    describe('levelFromXp agrees with xpForLevel at every level (CR3-258)', () => {
        it('lands exactly on each level at its threshold, and one level lower one XP short', () => {
            for (let L = 1; L <= 99; L++) {
                expect(levelFromXp(xpForLevel(L)), `at level ${L}`).toBe(L);
                if (L >= 2) expect(levelFromXp(xpForLevel(L) - 1), `one XP short of ${L}`).toBe(L - 1);
            }
        });

        it('stays on a level anywhere between its threshold and the next', () => {
            for (let L = 1; L < 99; L++) {
                const mid = xpForLevel(L) + Math.floor((xpForLevel(L + 1) - xpForLevel(L)) / 2);
                expect(levelFromXp(mid), `between ${L} and ${L + 1}`).toBe(L);
            }
        });

        it('keeps the curve itself where it is (literals taken 2026-09-30)', () => {
            expect([2, 10, 50, 98, 99].map(xpForLevel)).toEqual([83, 1154, 101333, 11805606, 13034431]);
            expect(levelFromXp(101333)).toBe(50);
            expect(levelFromXp(101332)).toBe(49);
            expect(levelFromXp(13034430)).toBe(98);
        });

        it('clamps to 1 at or below zero and to 99 far above the top', () => {
            expect(levelFromXp(0)).toBe(1);
            expect(levelFromXp(-50)).toBe(1);
            expect(levelFromXp(xpForLevel(99) * 10)).toBe(99);
        });
    });
});

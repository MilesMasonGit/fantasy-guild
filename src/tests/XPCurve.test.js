import { describe, it, expect } from 'vitest';
import { getXpProgress, xpForLevel } from '../utils/XPCurve.js';

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
});

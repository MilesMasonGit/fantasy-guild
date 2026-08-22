import { describe, it, expect, beforeEach, vi } from 'vitest';
import { XpRateTracker } from '../systems/hero/XpRateTracker.js';

describe('XpRateTracker — rolling XP gain rate & ETA calculation', () => {
    beforeEach(() => {
        XpRateTracker.clearAll();
        vi.useRealTimers();
    });

    it('records XP gains and calculates XP per hour rate', () => {
        const heroId = 'hero_test_1';
        const skillId = 'woodcutting';

        XpRateTracker.recordGain(heroId, skillId, 100);
        const rate = XpRateTracker.getRate(heroId, skillId);
        expect(rate).toBeGreaterThan(0);
    });

    it('calculates time to next level based on remaining XP and rate', () => {
        const heroId = 'hero_test_1';
        const skillId = 'mining';

        XpRateTracker.recordGain(heroId, skillId, 1000);
        const rate = XpRateTracker.getRate(heroId, skillId);
        const timeSecs = XpRateTracker.getTimeToNextLevelSeconds(heroId, skillId, 500);

        expect(timeSecs).toBeGreaterThan(0);
        expect(timeSecs).toBeCloseTo((500 / rate) * 3600, 1);
    });

    it('formats duration strings accurately', () => {
        expect(XpRateTracker.formatDuration(null)).toBe('--');
        expect(XpRateTracker.formatDuration(0)).toBe('Ready');
        expect(XpRateTracker.formatDuration(45)).toBe('45s');
        expect(XpRateTracker.formatDuration(125)).toBe('2m 5s');
        expect(XpRateTracker.formatDuration(3665)).toBe('1h 1m');
        expect(XpRateTracker.formatDuration(90000)).toBe('1d 1h');
    });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { XpRateTracker } from '../systems/hero/XpRateTracker.js';
import { ItemRateTracker } from '../systems/inventory/ItemRateTracker.js';
import * as GameClock from '../systems/core/GameClock.js';

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

describe('a rate counts the first gain’s own interval', () => {
    const T0 = 1_000_000_000;
    beforeEach(() => { XpRateTracker.clearAll(); ItemRateTracker.clearAll(); GameClock.begin(T0); });
    afterEach(() => GameClock.end());
    const at = (ms) => GameClock.begin(T0 + ms);

    it('steady work reads the true rate just after a gain, not n gains over n - 1 gaps', () => {
        // 10 XP every 12 s is 3,000 XP an hour.
        for (let i = 0; i < 5; i++) { at(i * 12_000); XpRateTracker.recordGain('h', 'mining', 10); }
        expect(XpRateTracker.getRate('h', 'mining')).toBeCloseTo(3000, 6);
        // Never above the truth between gains.
        at(4 * 12_000 + 6_000);
        expect(XpRateTracker.getRate('h', 'mining')).toBeLessThan(3000);
    });

    it('once the first gains age out of the window, the one before the first marks where it began', () => {
        for (let i = 0; i < 40; i++) { at(i * 12_000); XpRateTracker.recordGain('h', 'mining', 10); }
        expect(XpRateTracker.getRate('h', 'mining')).toBeCloseTo(3000, 6);
    });

    it('a boss every 2.5 minutes reads true, so Next level is not halved', () => {
        for (let i = 0; i < 4; i++) { at(i * 150_000); XpRateTracker.recordGain('h', 'melee', 100); }
        expect(XpRateTracker.getRate('h', 'melee')).toBeCloseTo(100 * 3600 / 150, 6);
        expect(XpRateTracker.getTimeToNextLevelSeconds('h', 'melee', 200)).toBeCloseTo(300, 6);
    });

    it('a lone gain is taken as earned over at least 15 s, and falls as time passes', () => {
        at(0);
        XpRateTracker.recordGain('h', 'melee', 39);
        expect(XpRateTracker.getRate('h', 'melee')).toBeCloseTo(39 * 3600 / 15, 6);
        at(60_000);
        expect(XpRateTracker.getRate('h', 'melee')).toBeCloseTo(39 * 3600 / 75, 6);
    });

    it('an item’s per hour: two outputs of one cycle share its interval', () => {
        for (let i = 0; i < 5; i++) { at(i * 12_000); ItemRateTracker.recordGain('oak', 1); ItemRateTracker.recordGain('oak', 1); }
        expect(ItemRateTracker.getRate('oak')).toBeCloseTo(600, 6);
    });
});


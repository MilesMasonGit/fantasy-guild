import { describe, it, expect } from 'vitest';
import { xpForLevel, levelFromXp, PACE_START_MINUTES, PACE_STEP_PCT, XP_HOUR_AT_1, MAX_SKILL_LEVEL } from '../utils/XPCurve.js';
import { DEFAULT_LEDGER_SETTINGS, minutesPerLevelAt, settingsOf } from '../../cms/src/engine/ledger/settings.js';

/**
 * The XP table is the balance rules' (BALANCE_RULES section 1): XP from level L to the next is the
 * XP an hour new work pays at L (1,660 x 2^((L - 1) / 20)) times the pace curve's minutes at L / 60,
 * rounded, each level on its own.
 */
describe('the XP table follows the balance rules', () => {
    it('matches the rules page at every level it lists', () => {
        const toNext = L => xpForLevel(L + 1) - xpForLevel(L);
        expect([1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 98].map(toNext))
            .toEqual([83, 122, 196, 507, 1316, 3411, 8845, 22936, 59474, 154217, 399887, 857000]);
        expect([5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 98].map(xpForLevel))
            .toEqual([384, 1127, 4244, 12328, 33291, 87649, 228602, 594093, 1541815, 3999274, 8571820]);
    });

    it('needs about 9.4 million XP to reach 99', () => {
        expect(xpForLevel(MAX_SKILL_LEVEL)).toBe(8571820 + 857000);
    });

    it('is the formula at every level, not only the listed ones', () => {
        for (let L = 1; L < MAX_SKILL_LEVEL; L++) {
            const minutes = PACE_START_MINUTES * (1 + PACE_STEP_PCT / 100) ** (L - 1);
            const want = Math.round(XP_HOUR_AT_1 * 2 ** ((L - 1) / 20) * minutes / 60);
            expect(xpForLevel(L + 1) - xpForLevel(L), `level ${L}`).toBe(want);
        }
    });

    it('keeps its pace curve the same as the CMS ledger\'s default pace rule', () => {
        const rule = DEFAULT_LEDGER_SETTINGS.paceRule;
        expect(PACE_START_MINUTES).toBe(rule.startMinutes);
        expect(PACE_STEP_PCT).toBe(rule.stepPct);
        const settings = settingsOf(null);
        for (const L of [1, 10, 50, 99]) {
            expect(PACE_START_MINUTES * (1 + PACE_STEP_PCT / 100) ** (L - 1)).toBeCloseTo(minutesPerLevelAt(settings, L), 9);
        }
    });

    it('still reads back each level at its threshold', () => {
        for (let L = 1; L <= MAX_SKILL_LEVEL; L++) {
            expect(levelFromXp(xpForLevel(L)), `level ${L}`).toBe(L);
            if (L >= 2) expect(levelFromXp(xpForLevel(L) - 1), `one short of ${L}`).toBe(L - 1);
        }
    });
});

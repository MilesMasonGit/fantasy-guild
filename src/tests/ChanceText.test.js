import { describe, it, expect } from 'vitest';
import { chanceFigure, chanceText, timesText } from '../utils/Formatters.js';
import { badgeAmountText, badgeText, chanceBreakdownText } from '../ui/components/board/effectBadgeText.js';
import { EFFECT_KEY, UNIT } from '../systems/board/EffectBreakdown.js';
import { outputSummary } from '../ui/components/board/recipeText.js';
import { describeModifierDirection, getPaletteEntry } from '../config/registries/modifierPalette.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

// One row per case in the owner's rule (docs/active/audit/topic_chances.md, "The rule").
describe('any chance: one decimal, trailing .0 dropped, under 1% two significant figures', () => {
    it.each([
        ['40%', 40],
        ['40%', 40.04],
        ['12.5%', 12.5],
        ['12.5%', 12.46],
        ['33.3%', 100 / 3],
        ['1%', 1],
        ['1%', 0.999],
        ['0.17%', 0.1666],
        ['0.005%', 0.005],
        ['0.0051%', 0.00512],
        ['0.5%', 0.5],
        ['0.25%', 0.25],
        ['0%', 0],
        ['0%', null],
        ['100%', 100],
        ['12.3%', 12.34]
    ])('reads %s', (text, percent) => {
        expect(chanceText(percent)).toBe(text);
    });

    it('never puts a space before the sign, and keeps a sign on the figure', () => {
        expect(chanceText(25)).not.toContain(' ');
        expect(chanceFigure(-0.1234)).toBe(-0.12);
        expect(chanceFigure(-12.34)).toBe(-12.3);
    });

    it('a rare find never reads 0%', () => {
        expect(chanceText(0.0004)).toBe('0.0004%');
    });
});

describe('a multiplier: two decimals at most', () => {
    it.each([['×1.2', 1.2], ['×1.25', 1.25], ['×2', 2], ['×0.8', 0.8], ['×1.13', 1.125]])('reads %s', (text, f) => {
        expect(timesText(f)).toBe(text);
    });
});

describe('a certain output: shown only in odds lists', () => {
    it('a recipe drops 100% and rounds the rest by the rule', () => {
        expect(outputSummary({ outputs: [{ itemId: 'x_a', minQty: 1, chance: 100 }, { itemId: 'x_b', minQty: 1, chance: 12.345 }] }))
            .toMatch(/^1× .+, 1× .+ \(12\.3%\)$/);
    });
});

const luckyBadge = (sources, base = 1, counted) => ({
    key: EFFECT_KEY.LUCKY, name: 'Lucky', unit: UNIT.PERCENT, base,
    total: sources.reduce((s, x) => s + x.amount, 0),
    counted: counted ?? sources.reduce((s, x) => s + x.amount, 0),
    final: base * (1 + sources.reduce((s, x) => s + x.amount, 0) / 100),
    sources
});

describe('Lucky reads as a multiplier, a flat Lucky in points', () => {
    it('a percentage Lucky: ×1.2 on the badge and on its source', () => {
        const badge = luckyBadge([{ key: 'gear:a', name: 'Ana\'s Ring', amount: 20, rules: [{ bucket: 'percentage', value: 0.2 }] }]);
        expect(badgeText(badge)).toBe('×1.2');
        expect(badgeAmountText(badge, -20)).toBe('×0.8');
    });

    it('a flat Lucky: points of the table\'s chance', () => {
        // +1 point on a 2% table is +50% of it.
        const badge = luckyBadge([{ key: 'star:s', name: 'Hall star Luck I', amount: 50, rules: [{ bucket: 'flat', value: 1 }] }], 2);
        expect(badgeText(badge)).toBe('+1%');
        expect(badgeAmountText(badge, -50)).toBe('−1%');
    });

    it('every other badge keeps reading in its unit', () => {
        const speed = { key: EFFECT_KEY.SPEED, unit: UNIT.PERCENT, counted: 20, sources: [] };
        expect(badgeText(speed)).toBe('+20%');
        expect(badgeText({ key: EFFECT_KEY.DOUBLE_LOOT, unit: UNIT.CHANCE, counted: 0.123, sources: [] })).toBe('0.12%');
    });
});

describe('a live chance explains itself on hover when a bonus counts', () => {
    it('base, each bonus with its source, the result', () => {
        const badge = luckyBadge([{ key: 'gear:a', name: 'Ana\'s Ring', amount: 20, rules: [{ bucket: 'percentage', value: 0.2 }] }]);
        expect(chanceBreakdownText(badge)).toBe('1% base · Lucky ×1.2 (Ana\'s Ring) · = 1.2%');
    });

    it('two bonuses, a flat one in points', () => {
        const badge = luckyBadge([
            { key: 'gear:a', name: 'Ana\'s Ring', amount: 20, rules: [{ bucket: 'percentage', value: 0.2 }] },
            { key: 'star:s', name: 'Hall star Luck I', amount: 100, rules: [{ bucket: 'flat', value: 1 }] }
        ]);
        expect(chanceBreakdownText(badge)).toBe('1% base · Lucky ×1.2 (Ana\'s Ring) · Lucky +1% (Hall star Luck I) · = 2.2%');
    });

    it('no badge, no extra hover', () => {
        expect(chanceBreakdownText(null)).toBeNull();
    });
});

describe('the CMS says a percentage Lucky as a multiplier', () => {
    it('Lucky ×1.2', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.LUCKY);
        expect(describeModifierDirection(entry, 0.2, 'percentage').text).toBe('Lucky ×1.2 — a buff.');
    });
});

import { describe, it, expect } from 'vitest';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { getPaletteEntry, describeModifierDirection } from '../config/registries/modifierPalette.js';
import { effectTag } from '../config/registries/effectWords.js';
import { effectAmountText } from '../ui/components/board/effectBadgeText.js';
import { UNIT } from '../systems/board/EffectBreakdown.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';

/**
 * Brief 790 W3: an effect is worded as its badge everywhere. One writer gives its name and number,
 * good always plus, a chance plain, a multiplier `×`; the time effects read as speeds; an effect
 * against its bearer keeps its name with a minus, a bad chance reads plainly, and both say so.
 */

const tag = (type, bucket, value, extra = {}) => effectTag(getPaletteEntry(type), { type, bucket, value, ...extra }, (id) => ({ i_nest: 'Bird Nest' })[id] || null);

describe('a short tag: the effect\'s name, then its number', () => {
    it.each([
        [EFFECT_TYPES.WORK_TIME, 'percentage', -0.25, 'Speed +25%'],
        [EFFECT_TYPES.GROW_TIME, 'percentage', -0.1, 'Growth +10%'],
        [EFFECT_TYPES.INPUT_COST, 'percentage', -0.2, 'Efficiency +20%'],
        [EFFECT_TYPES.YIELD, 'percentage', 0.1, 'Yield +10%'],
        [EFFECT_TYPES.XP_BONUS, 'percentage', 0.1, 'XP +10%'],
        [EFFECT_TYPES.LOOT_MULT, 'flat', 10, 'Double Loot 10%'],
        [EFFECT_TYPES.CROP_LOAD, 'flat', 1, 'Abundance +1'],
        [EFFECT_TYPES.LUCKY, 'percentage', 0.2, 'Lucky ×1.2'],
        [EFFECT_TYPES.WOUND_TIME, 'percentage', -0.1, 'Recovery +10%'],
        [EFFECT_TYPES.PASSIVE_LAP, 'percentage', -0.1, 'Lap Speed +10%'],
        [EFFECT_TYPES.SWING_TIME, 'percentage', -0.1, 'Attack Speed +10%']
    ])('%s %s %s reads %s', (type, bucket, value, text) => {
        expect(tag(type, bucket, value)).toEqual({ text, against: false });
    });

    it('a bonus drop is named by its item, its chance plain', () => {
        expect(tag(EFFECT_TYPES.BONUS_DROP, undefined, undefined, { itemId: 'i_nest', chance: 5 }).text).toBe('Bird Nest 5%');
    });

    it('writes its number with the badge\'s own writer', () => {
        expect(tag(EFFECT_TYPES.WORK_TIME, 'percentage', -0.25).text).toBe(`Speed ${effectAmountText(UNIT.PERCENT, 25)}`);
        expect(tag(EFFECT_TYPES.LOOT_MULT, 'flat', 10).text).toBe(`Double Loot ${effectAmountText(UNIT.CHANCE, 10)}`);
        expect(tag(EFFECT_TYPES.CROP_LOAD, 'flat', 1).text).toBe(`Abundance ${effectAmountText(UNIT.COUNT, 1)}`);
    });
});

describe('an effect against its bearer', () => {
    it('keeps its name with a minus', () => {
        expect(tag(EFFECT_TYPES.WORK_TIME, 'percentage', 0.1)).toEqual({ text: 'Speed −10%', against: true });
        expect(tag(EFFECT_TYPES.YIELD, 'percentage', -0.1)).toEqual({ text: 'Yield −10%', against: true });
        expect(tag(EFFECT_TYPES.LUCKY, 'percentage', -0.2)).toEqual({ text: 'Lucky ×0.8', against: true });
    });

    it('a bad chance reads plainly, and a cut to it is good', () => {
        expect(tag(EFFECT_TYPES.FAIL_CHANCE, 'flat', 5)).toEqual({ text: 'Failure 5%', against: true });
        expect(tag(EFFECT_TYPES.FAIL_CHANCE, 'flat', -5)).toEqual({ text: 'Failure −5%', against: false });
    });
});

describe('the time effects read as speeds', () => {
    it('are named Recovery, Lap Speed and Attack Speed, and their hints say a negative value is faster', () => {
        for (const [type, label] of [[EFFECT_TYPES.WOUND_TIME, 'Recovery'], [EFFECT_TYPES.PASSIVE_LAP, 'Lap Speed'], [EFFECT_TYPES.SWING_TIME, 'Attack Speed']]) {
            const entry = getPaletteEntry(type);
            expect(entry.label).toBe(label);
            expect(entry.inverted).toBe(true);
            expect(entry.hint).toMatch(/A negative value is faster/);
        }
    });

    it('the CMS says a value as its badge does', () => {
        expect(describeModifierDirection(getPaletteEntry(EFFECT_TYPES.SWING_TIME), -0.1).text).toBe('Attack Speed +10% — a buff.');
        expect(describeModifierDirection(getPaletteEntry(EFFECT_TYPES.WORK_TIME), 0.05).text).toBe('Speed −5% — a penalty.');
    });
});

describe('a rule line leads with name and number, then where or when', () => {
    const provides = (payload, extra = {}) => ({ ...makeStatement(KEYWORD.PROVIDES), payload, ...extra });

    it('on a building, a perk and a Hall star', () => {
        expect(renderStatement(provides({ type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.05, category: 'mining' })))
            .toBe('Speed +5% on every nearby Mining Token.');
        expect(renderStatement(provides({ type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.05, category: 'mining' }), { carried: true }))
            .toBe('Speed +5% on Mining Tokens.');
        expect(renderStatement(provides({ type: EFFECT_TYPES.LUCKY, bucket: 'percentage', value: 0.2 }, { to: { mode: 'tag', value: 'Vein' } })))
            .toBe('Lucky ×1.2 on nearby Vein Tokens.');
    });

    it('an enemy\'s own buff reads with its plain sign', () => {
        expect(renderStatement(provides({ type: EFFECT_TYPES.SWING_TIME, bucket: 'percentage', value: -0.25 }), { carried: true }))
            .toBe('Attack Speed +25% in combat.');
    });

    it('a moment keeps the effect\'s capital, and a length is written by the time writer', () => {
        const timed = provides({ type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1 }, { when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 2500 } });
        expect(renderStatement(timed)).toMatch(/: Yield \+10% .*, at most once every 2\.5s\.$/);
    });
});

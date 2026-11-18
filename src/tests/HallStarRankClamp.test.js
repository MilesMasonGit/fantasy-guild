// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { hallRulesOf, hallLinesOf, xpForEveryoneOf } from '../systems/progression/hallModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';


describe('A star held above its top rank reads as its top rank', () => {
    const rule = (value) => ({
        id: `r${value}`, keyword: KEYWORD.PROVIDES,
        payload: { type: EFFECT_TYPES.XP_BONUS, bucket: 'percentage', value, category: 'mining' },
        to: { mode: 'all', value: '' }, when: null
    });
    const star = {
        id: 's',
        ranks: [
            { rules: [rule(0.1)], lines: [{ itemId: 'x', quantity: 1 }] },
            { rules: [rule(0.2)], lines: [{ itemId: 'x', quantity: 2 }] }
        ]
    };

    it('gives the top rank\'s effect and lines, and leaves a rank of 0 and the saved number alone', () => {
        const ranks = { s: 3 };
        expect(hallRulesOf([star], ranks).modifiers.map(m => m.value)).toEqual([0.2]);
        expect(hallLinesOf([star], ranks)).toEqual([{ itemId: 'x', quantity: 2 }]);
        expect(xpForEveryoneOf([star], ranks)).toBe(0);
        expect(hallRulesOf([star], { s: 0 }).modifiers).toEqual([]);
        expect(ranks.s).toBe(3);
    });
});

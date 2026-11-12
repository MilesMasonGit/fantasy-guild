import { describe, it, expect } from 'vitest';
import { renderStatement, rulesLinesOf } from '../systems/effects/statementText.js';
import { slotsOf } from '../../cms/src/engine/ledger/statementSlots.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { perkLines } from '../ui/components/dock/heroPerks.js';

/**
 * A rule a hero carries (an item's, a perk's) reaches its hero and the work or fight they are doing,
 * never the Tokens around them, so its sentence and its moment picker say so. The same statement on
 * a Token keeps the Token's words: a library effect can be on both.
 */

const carried = { carried: true, effect: (id) => ({ fx_valor: 'Valor', fx_poison: 'Poison' })[id] || id, item: (id) => ({ item_nest: 'Bird Nest' })[id] || id };
const S = (keyword, extra = {}) => ({ ...makeStatement(keyword), ...extra });
const provides = (type, bucket, value, category) =>
    S(KEYWORD.PROVIDES, { payload: { type, bucket, value, ...(category ? { category } : {}) } });

describe('a carried rule reads as the hero\'s and names its skill', () => {
    it.each([
        ['LOOT_MULT', 'flat', 5, 'mining', 'Gives the hero a 5% chance of double loot at Mining.'],
        ['LOOT_MULT', 'flat', 5, undefined, 'Gives the hero a 5% chance of double loot.'],
        ['FAIL_CHANCE', 'flat', -10, 'cooking', 'Gives the hero 10% less chance to fail at Cooking.'],
        ['XP_BONUS', 'percentage', 0.1, 'smithing', 'Gives the hero 10% more XP at Smithing.'],
        ['WORK_TIME', 'percentage', -0.05, 'mining', 'Makes the hero work 5% faster at Mining.'],
        ['YIELD', 'percentage', 0.25, 'fishing', 'Gives the hero 25% more yield at Fishing.'],
        ['ARMOR', 'flat', 3, undefined, 'Gives the hero 3 more armor in combat.']
    ])('%s %s %s at %s', (type, bucket, value, skill, sentence) => {
        expect(renderStatement(provides(type, bucket, value, skill), carried)).toBe(sentence);
    });

    it('a fight-start rule says the hero\'s fight, and lands on the hero', () => {
        const rule = S(KEYWORD.APPLIES, {
            when: { event: 'COMBAT_ENGAGED', scope: 'self' },
            payload: { effectId: 'fx_valor', forFight: true, chance: 100 }
        });
        expect(renderStatement(rule, carried)).toBe('When this hero\'s fight starts: applies Valor to the hero for the fight.');
    });

    it('a work-start rule says the hero\'s work', () => {
        const rule = S(KEYWORD.APPLIES, {
            when: { event: 'CYCLE_START', scope: 'nearby' },
            payload: { effectId: 'fx_valor', forCycle: true, chance: 100 }
        });
        expect(renderStatement(rule, carried)).toBe('When this hero starts work: applies Valor to the hero for the cycle.');
    });

    it('⚠️ a role still names its role, and a fight moment with none still reaches the heroes it does reach', () => {
        const atEnemy = S(KEYWORD.APPLIES, {
            when: { event: 'FIGHT_HIT', scope: 'self' }, target: { role: 'opponent' },
            payload: { effectId: 'fx_poison', chance: 100 }
        });
        expect(renderStatement(atEnemy, carried)).toBe('On Hit: applies Poison to the enemy.');
        const aroundEnemy = S(KEYWORD.APPLIES, {
            when: { event: 'FIGHT_HIT', scope: 'self' },
            payload: { effectId: 'fx_poison', chance: 100 }
        });
        expect(renderStatement(aroundEnemy, carried)).toContain('heroes on');
    });

    it('a grant lands with the hero, at its moment or when they finish work', () => {
        const standing = S(KEYWORD.GRANTS, { payload: { itemId: 'item_nest', quantity: 1, chance: 5 } });
        expect(renderStatement(standing, carried)).toBe('Grants 1 Bird Nest to the hero when they finish work, 5% of the time.');
        const atMoment = { ...standing, when: { event: 'COMBAT_ENGAGED', scope: 'self' } };
        expect(renderStatement(atMoment, carried)).toBe('When this hero\'s fight starts: grants 1 Bird Nest to the hero, 5% of the time.');
    });

    it('⚠️ the same rule on a Token keeps the Token\'s words', () => {
        expect(renderStatement(provides('LOOT_MULT', 'flat', 5, 'mining'))).toBe('Makes every nearby Token have a 5% chance of double loot, but only for Mining work.');
        const rule = S(KEYWORD.APPLIES, {
            when: { event: 'COMBAT_ENGAGED', scope: 'nearby' },
            payload: { effectId: 'fx_valor', forFight: true, chance: 100 }
        });
        expect(renderStatement(rule, { effect: carried.effect })).toBe("On Neighbour's Fight: applies Valor to heroes on nearby Tokens for the fight.");
    });

    it('a whole effect reads the same way through rulesLinesOf', () => {
        expect(rulesLinesOf({ statements: [provides('LOOT_MULT', 'flat', 5, 'mining')] }, carried))
            .toEqual(['Gives the hero a 5% chance of double loot at Mining.']);
    });
});

describe('the moment picker of a carried rule', () => {
    const momentLabel = (ctx, id) => slotsOf(S(KEYWORD.APPLIES), ctx).find(s => s.id === 'moment').options.find(o => o.id === id).label;

    it('words the moment as the hero hears it', () => {
        expect(momentLabel({ carried: true }, 'COMBAT_ENGAGED')).toBe('When this hero\'s fight starts');
        expect(momentLabel({ carried: true }, 'CYCLE_START')).toBe('When this hero starts work');
    });

    it('⚠️ a Token\'s picker keeps its tags', () => {
        expect(momentLabel({}, 'COMBAT_ENGAGED')).toBe("On Neighbour's Fight");
        expect(momentLabel({}, 'CYCLE_START')).toBe("On Neighbour's Start");
    });
});

describe('a perk with a moment on the hero sheet', () => {
    it('reads as the hero\'s', () => {
        registerEffects({
            crt_valor_perk: {
                id: 'crt_valor_perk', name: 'Valor Perk',
                statements: [S(KEYWORD.APPLIES, {
                    id: 'stm_crt_valor', when: { event: 'COMBAT_ENGAGED', scope: 'self' },
                    payload: { effectId: 'crt_valor_perk', forFight: true, chance: 100 }
                })]
            }
        });
        expect(perkLines({ effectId: 'crt_valor_perk', scale: 1 })[0]).toMatch(/^When this hero's fight starts: applies .* to the hero for the fight\.$/);
    });
});

describe('a count of one reads in the singular', () => {
    it.each([
        ['CROP_LOAD', 1, 'Makes every nearby Token hold 1 more harvest when ripe.'],
        ['CROP_LOAD', -1, 'Makes every nearby Token hold 1 fewer harvest when ripe.'],
        ['CROP_LOAD', 2, 'Makes every nearby Token hold 2 more harvests when ripe.'],
        ['CATCH_WEIGHT', 1, 'Provides 1 more bite of any fish to every nearby Token.'],
        ['CATCH_WEIGHT', -1, 'Provides 1 fewer bite of any fish to every nearby Token.'],
        ['CATCH_WEIGHT', 2, 'Provides 2 more bites of any fish to every nearby Token.']
    ])('%s at %s', (type, value, sentence) => {
        expect(renderStatement(provides(type, 'flat', value))).toBe(sentence);
    });

    it('⚠️ a percentage of 100 stays plural', () => {
        expect(renderStatement(provides('CROP_LOAD', 'percentage', 1))).toBe('Makes every nearby Token hold 100% more harvests when ripe.');
    });

    it('Sunder says one point', () => {
        expect(renderStatement(provides('SUNDER', 'flat', 1), carried)).toBe('Gives the hero Sunder 1: every resistance 1 point lower, never below 0, in combat.');
        expect(renderStatement(provides('SUNDER', 'flat', 2), carried)).toBe('Gives the hero Sunder 2: every resistance 2 points lower, never below 0, in combat.');
    });
});

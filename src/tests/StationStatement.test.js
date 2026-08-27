import { describe, it, expect } from 'vitest';

import { KEYWORD, makeStatement, blankPayload, getKeyword, stationSkillOf } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { deriveTokenType, derivedTokenType } from '../config/registries/tokenTypeDerivation.js';
import { recipesForToken } from '../config/registries/recipePoolRegistry.js';
import { TOKENS } from '../config/registries/tokenRegistry.js';
import { defaultRecipeFor } from '../systems/board/StationRecipe.js';

/**
 * Station is an authored statement (rework P2.5, R-14/R-15).
 *
 * Before this phase a Token became a station by accident of shape — "it has a
 * work cycle and at least one input" — and its recipe pool came from a separate
 * `recipePool` field that nothing in the statement grammar knew about. The two
 * could disagree, and they did: `token_ceramics_kiln` pooled `crafting`, which
 * has no recipes, and derived as a `buff` because its input list was empty.
 *
 * These tests hold the two halves together: the statement decides the type, and
 * the same statement decides the pool.
 */

const station = skill => ({ id: 's1', keyword: KEYWORD.STATION, payload: { skill } });

describe('the Station keyword', () => {
    it('is in the grammar, takes no filter, no trigger and no upkeep', () => {
        const keyword = getKeyword(KEYWORD.STATION);
        expect(keyword).toBeTruthy();
        expect(keyword.filter).toBe(false);
        expect(keyword.when).toBe('never');
        expect(keyword.upkeep).toBe(false);
    });

    it('starts blank with an empty skill', () => {
        expect(blankPayload(KEYWORD.STATION)).toEqual({ skill: '' });
        expect(makeStatement(KEYWORD.STATION).payload).toEqual({ skill: '' });
    });

    it('reads back as a sentence naming the skill', () => {
        expect(renderStatement(station('smithing'))).toBe('Works as a Smithing station.');
    });

    it('says so when the skill is still blank', () => {
        expect(renderStatement(station(''))).toBe('Works as a … station.');
    });

    it('reports the skill of the Token that carries it', () => {
        expect(stationSkillOf({ statements: [station('cooking')] })).toBe('cooking');
        expect(stationSkillOf({ statements: [] })).toBe(null);
        expect(stationSkillOf(null)).toBe(null);
    });
});

describe('type derivation reads Station off the statement (R-15)', () => {
    it('derives station from the statement alone, with no work cycle at all', () => {
        expect(derivedTokenType({ statements: [station('cooking')] })).toBe('station');
    });

    it('no longer infers station from a work cycle with inputs', () => {
        const def = {
            config: {
                inputs: [{ itemId: 'item_copper_ore', quantity: 4 }],
                outputs: [{ itemId: 'item_copper_ingot', chance: 100 }]
            }
        };
        expect(derivedTokenType(def)).not.toBe('station');
    });

    it('outranks the Provides rung, so a station that also buffs is still a station', () => {
        const def = {
            statements: [
                station('cooking'),
                { id: 's2', keyword: KEYWORD.PROVIDES, payload: { type: 'YIELD', bucket: 'flat', value: 5 } }
            ]
        };
        expect(derivedTokenType(def)).toBe('station');
    });

    it('gives a reason that points at the statement', () => {
        expect(deriveTokenType({ statements: [station('smithing')] }).why).toContain('says');
    });
});

describe('the statement is also the recipe pool (R-14)', () => {
    it('pools the named skill', () => {
        const pool = recipesForToken({ statements: [station('smithing')] });
        expect(pool.length).toBeGreaterThan(0);
        expect(pool.every(r => r.skill === 'smithing')).toBe(true);
    });

    it('gives a Token with no Station statement an empty pool', () => {
        expect(recipesForToken({ config: { inputs: [{ itemId: 'x' }] } })).toEqual([]);
    });

    it('ignores a private recipes[] array — that path is retired', () => {
        expect(recipesForToken({ recipes: [{ id: 'ghost' }] })).toEqual([]);
    });

    it('gives an unauthored skill an empty pool rather than throwing', () => {
        expect(recipesForToken({ statements: [station('crafting')] })).toEqual([]);
    });
});

describe('the shipped Tokens that used to be stations by inference', () => {
    const AUTHORED = {
        token_forge: 'smithing',
        token_campfire: 'smithing',
        token_windmill: 'cooking'
    };

    for (const [id, skill] of Object.entries(AUTHORED)) {
        it(`${id} says it is a ${skill} station and can pick a real recipe`, () => {
            const def = TOKENS[id];
            expect(def, `${id} is missing from data/tokens.json`).toBeTruthy();
            expect(stationSkillOf(def)).toBe(skill);
            expect(derivedTokenType(def)).toBe('station');
            expect(defaultRecipeFor(def), `${id} has an empty pool`).toBeTruthy();
        });
    }

    it('leaves no shipped Token carrying the retired recipePool field', () => {
        const offenders = Object.entries(TOKENS)
            .filter(([, def]) => def.recipePool || def.config?.recipePool)
            .map(([id]) => id);
        expect(offenders).toEqual([]);
    });

    it('leaves no shipped Token carrying a private recipes[] array', () => {
        const offenders = Object.entries(TOKENS)
            .filter(([, def]) => Array.isArray(def.recipes) && def.recipes.length)
            .map(([id]) => id);
        expect(offenders).toEqual([]);
    });
});

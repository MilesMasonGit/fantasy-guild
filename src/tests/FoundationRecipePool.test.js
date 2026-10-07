import { describe, it, expect } from 'vitest';
import './fixtures/testTokens.js';
import { registerTokenTypes, getTokenType, getAllTokenTypes } from '../config/registries/tokenRegistry.js';
import {
    registerRecipePools,
    getSkillRecipePool,
    recipesForToken,
    recipesForFoundation,
    buildsOnFoundation,
} from '../config/registries/recipePoolRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';

/**
 * Token Lifecycle slice 4.3 — recipes that build (roadmap v1 §3.1).
 */

registerTokenTypes({
    fixture_furnace_built: {
        id: 'fixture_furnace_built', name: 'Fixture Furnace', tokenType: 'station',
        rarity: 'common', theme: 'fixture', uses: 100,
        config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 16000, xp: 1 },
        statements: [{ id: 'stm_fixture_furnace_built', keyword: KEYWORD.STATION, payload: { skill: 'smithing' } }],
    },
    fixture_stone_foundation: {
        id: 'fixture_stone_foundation', name: 'Fixture Stone Foundation',
        rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'stone', skill: 'construction' },
    },
    fixture_wood_foundation: {
        id: 'fixture_wood_foundation', name: 'Fixture Wood Foundation',
        rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'wood', skill: 'construction' },
    },
    fixture_farmland_foundation: {
        id: 'fixture_farmland_foundation', name: 'Fixture Farmland',
        rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'farmland', skill: 'farming' },
    },
    // An ORDINARY Construction station: it draws the construction pool the
    // ordinary way, so it is the sharpest check that a building recipe stays
    // out of a station's pool even when the skills match.
    fixture_construction_bench: {
        id: 'fixture_construction_bench', name: 'Fixture Construction Bench', tokenType: 'station',
        rarity: 'common', theme: 'fixture', uses: 100,
        config: { skill: 'construction', skillRequired: 1, cycleTimeMs: 16000, xp: 1 },
        statements: [{ id: 'stm_fixture_construction_bench', keyword: KEYWORD.STATION, payload: { skill: 'construction' } }],
    },
});

registerRecipePools({
    construction: [
        {
            id: 'fixture_recipe_build_furnace',
            name: 'Build Furnace',
            levelRequirement: 3,
            foundationKinds: ['stone'],
            inputs: [{ itemId: 'item_fixture_stone', quantity: 5 }],
            outputs: [{ tokenId: 'fixture_furnace_built', chance: 100, minQty: 1, maxQty: 1 }],
            durationMs: 30000,
            xp: 10,
        },
        {
            id: 'fixture_recipe_plank_bundle',
            name: 'Plank Bundle',
            levelRequirement: 1,
            inputs: [],
            outputs: [{ itemId: 'item_fixture_plank', chance: 100, minQty: 1, maxQty: 1 }],
            durationMs: 10000,
            xp: 1,
        },
    ],
    farming: [
        {
            id: 'fixture_recipe_plant_patch',
            name: 'Plant Patch',
            levelRequirement: 1,
            foundationKinds: ['farmland'],
            inputs: [],
            outputs: [{ tokenId: 'fixture_furnace_built', chance: 100, minQty: 1, maxQty: 1 }],
            durationMs: 10000,
            xp: 1,
        },
    ],
});

const ids = (list) => list.map((r) => r.id);

describe('Recipes that build (slice 4.3)', () => {
    it('Build Furnace is in a Stone Foundation’s pool', () => {
        const pool = recipesForToken(getTokenType('fixture_stone_foundation'));
        expect(ids(pool)).toEqual(['fixture_recipe_build_furnace']);
        expect(ids(recipesForFoundation(getTokenType('fixture_stone_foundation')))).toEqual(ids(pool));
        expect(pool[0].outputs).toEqual([{ tokenId: 'fixture_furnace_built', chance: 100, minQty: 1, maxQty: 1 }]);
    });

    it('is not in a Wood Foundation’s pool', () => {
        expect(recipesForToken(getTokenType('fixture_wood_foundation'))).toEqual([]);
    });

    it('a Foundation’s pool follows its skill as well as its kind', () => {
        expect(ids(recipesForToken(getTokenType('fixture_farmland_foundation')))).toEqual(['fixture_recipe_plant_patch']);
    });

    it('never appears in an ordinary station’s pool, even one of the same skill', () => {
        expect(ids(getSkillRecipePool('construction'))).toEqual(['fixture_recipe_plank_bundle']);
        expect(ids(recipesForToken(getTokenType('fixture_construction_bench')))).toEqual(['fixture_recipe_plank_bundle']);
        expect(getSkillRecipePool('farming')).toEqual([]);

        for (const def of Object.values(getAllTokenTypes())) {
            if (def?.foundation) continue;
            for (const recipe of recipesForToken(def)) expect(buildsOnFoundation(recipe)).toBe(false);
        }
    });

    it('a recipe without foundationKinds never appears on a Foundation', () => {
        for (const def of Object.values(getAllTokenTypes())) {
            if (!def?.foundation) continue;
            for (const recipe of recipesForToken(def)) expect(buildsOnFoundation(recipe)).toBe(true);
        }
    });

    it('a Token without a foundation block has no Foundation pool', () => {
        expect(recipesForFoundation(getTokenType('fixture_construction_bench'))).toEqual([]);
        expect(recipesForFoundation(null)).toEqual([]);
    });

    it('an empty foundationKinds is an ordinary recipe', () => {
        expect(buildsOnFoundation({ foundationKinds: [] })).toBe(false);
        expect(buildsOnFoundation({})).toBe(false);
        expect(buildsOnFoundation({ foundationKinds: ['stone'] })).toBe(true);
    });
});

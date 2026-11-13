import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as RecipeResolver from '../systems/board/RecipeResolver.js';
import { RECIPE } from '../systems/board/RecipeResolver.js';
import * as RecipeList from '../systems/board/RecipeList.js';
import { registerRecipePools, recipesForToken, getSkillRecipePool } from '../config/registries/recipePoolRegistry.js';
import { registerTokenTypes, getTokenType, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { STATION_KINDS, stationKindLabel, recipeStationKinds } from '../config/registries/tokenConstants.js';
import { KEYWORD, stationKindOf, stationSkillOf } from '../systems/effects/statements.js';

/**
 * Per-station recipe pools: a station kind on the `Works as` rule, station kinds on a recipe. A
 * recipe with no kinds is offered by every station of its skill; a station with no kind offers its
 * whole skill. Only Farming still splits its recipes this way (a Field's crops, a Herb Garden's, a
 * Windmill's flour); every other skill has one building offering all of it
 * (`OneBuildingPerSkill.test.js`, where the retired craft kinds are checked).
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

const out = (itemId) => [{ itemId, chance: 100, minQty: 1, maxQty: 1 }];

// ⚠️ A fixture registration takes over its skill: shipped Farming and Smithing are hidden here.
registerRecipePools({
    farming: [
        { id: 'sk_wheat', name: 'Wheat', levelRequirement: 1, stationKinds: ['field'], inputs: [], outputs: out('item_wheat'), durationMs: 5000, xp: 1 },
        { id: 'sk_sage', name: 'Sage', levelRequirement: 1, stationKinds: ['herb_garden'], inputs: [], outputs: out('item_lavender'), durationMs: 5000, xp: 1 },
        { id: 'sk_mint', name: 'Mint', levelRequirement: 1, stationKinds: ['field', 'herb_garden'], inputs: [], outputs: out('item_lavender'), durationMs: 5000, xp: 1 },
        { id: 'sk_flour', name: 'Flour', levelRequirement: 1, stationKinds: ['windmill'], inputs: [], outputs: out('item_flour'), durationMs: 5000, xp: 1 },
        { id: 'sk_compost', name: 'Compost', levelRequirement: 1, inputs: [], outputs: out('item_worm'), durationMs: 5000, xp: 1 }
    ],
    smithing: [
        {
            id: 'sk_sword', name: 'Sword', levelRequirement: 1,
            requiresContext: [{ tag: 'anvil', minTier: 1, chargeCost: 0 }],
            inputs: [], outputs: out('item_copper_ingot'), durationMs: 5000, xp: 1
        }
    ]
});

const station = (id, skill, stationKind) => ({
    id, name: id, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_flask',
    config: { skill, skillRequired: 1, cycleTimeMs: 5000, xp: 1 },
    statements: [{ id: `stm_${id}`, keyword: KEYWORD.STATION, payload: stationKind ? { skill, stationKind } : { skill } }]
});

registerTokenTypes({
    sk_field: station('sk_field', 'farming', 'field'),
    sk_wild_patch: station('sk_wild_patch', 'farming', 'field'),
    sk_herb_garden: station('sk_herb_garden', 'farming', 'herb_garden'),
    sk_windmill: station('sk_windmill', 'farming', 'windmill'),
    sk_farmhouse: station('sk_farmhouse', 'farming'),
    sk_blacksmith: station('sk_blacksmith', 'smithing'),
    sk_anvil: {
        id: 'sk_anvil', name: 'sk_anvil', tokenType: 'context', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_flask',
        statements: [{ id: 'stm_sk_anvil', keyword: KEYWORD.ACTS_AS, payload: { tag: 'anvil', tier: 1 } }]
    }
});

const ids = (recipes) => recipes.map(r => r.id).sort();
const def = (typeId) => getTokenType(typeId);

function place(typeId, point) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    return instance;
}

beforeEach(() => GameState.initNew());

describe('the station kind on the Works as rule', () => {
    it('reads the kind beside the skill, and none when the rule names none', () => {
        expect(stationSkillOf(def('sk_field'))).toBe('farming');
        expect(stationKindOf(def('sk_field'))).toBe('field');
        expect(stationKindOf(def('sk_farmhouse'))).toBeNull();
        expect(stationKindOf(null)).toBeNull();
    });

    it('a recipe lists its kinds; none is an empty list', () => {
        expect(recipeStationKinds({ stationKinds: ['field', 'herb_garden'] })).toEqual(['field', 'herb_garden']);
        expect(recipeStationKinds({})).toEqual([]);
        expect(recipeStationKinds({ stationKinds: 'field' })).toEqual([]);
    });

    it('the kinds left are Farming\'s, each with words', () => {
        expect([...STATION_KINDS]).toEqual(['field', 'herb_garden', 'windmill']);
        for (const kind of STATION_KINDS) expect(stationKindLabel(kind)).toMatch(/\S/);
        expect(stationKindLabel('herb_garden')).toBe('Herb Garden');
    });
});

describe('a station offers only its kind (and recipes that name no kind)', () => {
    it('a Field offers its crops, never the Herb Garden\'s', () => {
        expect(ids(recipesForToken(def('sk_field')))).toEqual(['sk_compost', 'sk_mint', 'sk_wheat']);
    });

    it('a Herb Garden offers its own, and the crop both kinds name', () => {
        expect(ids(recipesForToken(def('sk_herb_garden')))).toEqual(['sk_compost', 'sk_mint', 'sk_sage']);
    });

    it('two stations of one kind share one list; the Windmill has its own', () => {
        expect(ids(recipesForToken(def('sk_wild_patch')))).toEqual(ids(recipesForToken(def('sk_field'))));
        expect(ids(recipesForToken(def('sk_windmill')))).toEqual(['sk_compost', 'sk_flour']);
    });

    it('a station with no kind offers its whole skill', () => {
        expect(ids(recipesForToken(def('sk_farmhouse')))).toEqual(ids(getSkillRecipePool('farming')));
    });

    it('the recipe picker lists the same pool', () => {
        const hero = { id: 'h1', skills: { farming: { level: 5 } } };
        const listed = RecipeList.recipeListFor(def('sk_field'), { heroes: [hero] }).entries
            .filter(e => e.kind === RecipeList.ENTRY.RECIPE)
            .map(e => e.recipe);
        expect(ids(listed)).toEqual(['sk_compost', 'sk_mint', 'sk_wheat']);
    });
});

describe('choosing a recipe', () => {
    it('a Field refuses a Herb Garden crop and accepts its own', () => {
        const field = place('sk_field', { x: 400, y: 300 });
        expect(StationRecipe.setSelectedRecipe(field, 'sk_sage')).toBe(false);
        expect(field.selectedRecipeId).toBeUndefined();
        expect(StationRecipe.setSelectedRecipe(field, 'sk_wheat')).toBe(true);
        expect(StationRecipe.selectedRecipe(field)?.id).toBe('sk_wheat');
    });

    it('an old save: a Herb Garden set to a Field crop falls back to Choose a recipe', () => {
        const garden = place('sk_herb_garden', { x: 400, y: 300 });
        // Written when the crop was still offered there.
        garden.selectedRecipeId = 'sk_wheat';
        const saved = JSON.parse(JSON.stringify(GameState.state));
        GameState.initNew();
        GameState.state.board = saved.board;
        const loaded = BoardState.getTokenById(garden.id);
        expect(loaded.selectedRecipeId).toBe('sk_wheat');

        const res = RecipeResolver.resolveRecipe(loaded.id, loaded);
        expect(res.status).toBe(RECIPE.NONE);
        expect(res.reason).toBe('choose_recipe');
        expect(loaded.selectedRecipeId).toBeUndefined();
        // And the player can pick again.
        expect(StationRecipe.setSelectedRecipe(loaded, 'sk_sage')).toBe(true);
        expect(RecipeResolver.resolveRecipe(loaded.id, loaded).status).toBe(RECIPE.OK);
    });
});

describe('the anvil context tag keeps working', () => {
    it('a recipe that still needs an anvil waits for one at the skill\'s building, and runs beside it', () => {
        const smith = place('sk_blacksmith', { x: 400, y: 300 });
        expect(StationRecipe.setSelectedRecipe(smith, 'sk_sword')).toBe(true);
        expect(RecipeResolver.resolveRecipe(smith.id, smith).reason).toBe('missing_context');
        place('sk_anvil', { x: 560, y: 300 });
        expect(RecipeResolver.resolveRecipe(smith.id, smith).status).toBe(RECIPE.OK);
    });
});

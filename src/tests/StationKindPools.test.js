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
 * Per-station recipe pools (brief 230 S6a): a station kind on the `Works as` rule, station kinds
 * on a recipe. A recipe with no kinds is offered by every station of its skill; a station with no
 * kind offers its whole skill, as before.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

const out = (itemId) => [{ itemId, chance: 100, minQty: 1, maxQty: 1 }];

// ⚠️ A fixture registration takes over its skill: shipped Smithing and Cooking are hidden here.
registerRecipePools({
    smithing: [
        { id: 's6_ingot', name: 'Ingot', levelRequirement: 1, stationKinds: ['furnace'], inputs: [], outputs: out('item_copper_ingot'), durationMs: 5000, xp: 1 },
        { id: 's6_pickaxe', name: 'Pickaxe', levelRequirement: 1, stationKinds: ['smithy'], inputs: [], outputs: out('item_copper_pickaxe'), durationMs: 5000, xp: 1 },
        { id: 's6_hinge', name: 'Hinge', levelRequirement: 1, inputs: [], outputs: out('item_copper_ingot'), durationMs: 5000, xp: 1 },
        {
            id: 's6_sword', name: 'Sword', levelRequirement: 1, stationKinds: ['smithy'],
            requiresContext: [{ tag: 'anvil', minTier: 1, chargeCost: 0 }],
            inputs: [], outputs: out('item_copper_ingot'), durationMs: 5000, xp: 1
        }
    ],
    cooking: [
        { id: 's6_stew', name: 'Stew', levelRequirement: 1, stationKinds: ['kitchen'], inputs: [], outputs: out('item_apple'), durationMs: 5000, xp: 1 },
        { id: 's6_beer', name: 'Beer', levelRequirement: 1, stationKinds: ['brewery'], inputs: [], outputs: out('item_beer'), durationMs: 5000, xp: 1 },
        { id: 's6_tea', name: 'Tea', levelRequirement: 1, stationKinds: ['kitchen', 'brewery'], inputs: [], outputs: out('item_water'), durationMs: 5000, xp: 1 }
    ]
});

const station = (id, skill, stationKind) => ({
    id, name: id, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_flask',
    config: { skill, skillRequired: 1, cycleTimeMs: 5000, xp: 1 },
    statements: [{ id: `stm_${id}`, keyword: KEYWORD.STATION, payload: stationKind ? { skill, stationKind } : { skill } }]
});

registerTokenTypes({
    s6_furnace: station('s6_furnace', 'smithing', 'furnace'),
    s6_smithy: station('s6_smithy', 'smithing', 'smithy'),
    s6_forge: station('s6_forge', 'smithing'),
    s6_campfire: station('s6_campfire', 'cooking', 'kitchen'),
    s6_kitchen: station('s6_kitchen', 'cooking', 'kitchen'),
    s6_brewery: station('s6_brewery', 'cooking', 'brewery'),
    // An Anvil, the context-tag gate today's copper weapon recipes keep until S8 moves them.
    s6_anvil: {
        id: 's6_anvil', name: 's6_anvil', tokenType: 'context', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_flask',
        statements: [{ id: 'stm_s6_anvil', keyword: KEYWORD.ACTS_AS, payload: { tag: 'anvil', tier: 1 } }]
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
        expect(stationSkillOf(def('s6_furnace'))).toBe('smithing');
        expect(stationKindOf(def('s6_furnace'))).toBe('furnace');
        expect(stationKindOf(def('s6_forge'))).toBeNull();
        expect(stationKindOf(null)).toBeNull();
    });

    it('a recipe lists its kinds; none is an empty list', () => {
        expect(recipeStationKinds({ stationKinds: ['kitchen', 'brewery'] })).toEqual(['kitchen', 'brewery']);
        expect(recipeStationKinds({})).toEqual([]);
        expect(recipeStationKinds({ stationKinds: 'furnace' })).toEqual([]);
    });

    it('the engine knows every station shape the content pack needs', () => {
        for (const kind of ['furnace', 'smithy', 'kitchen', 'brewery', 'workbench', 'alchemy_table', 'summoning_circle']) {
            expect(STATION_KINDS).toContain(kind);
            expect(stationKindLabel(kind)).toMatch(/\S/);
        }
    });
});

describe('a station offers only its kind (and recipes that name no kind)', () => {
    it('the Furnace offers smelting, never the Smithy\'s tools', () => {
        expect(ids(recipesForToken(def('s6_furnace')))).toEqual(['s6_hinge', 's6_ingot']);
    });

    it('the Smithy offers tools and weapons, never smelting', () => {
        expect(ids(recipesForToken(def('s6_smithy')))).toEqual(['s6_hinge', 's6_pickaxe', 's6_sword']);
    });

    it('a station with no kind offers its whole skill, as before', () => {
        expect(ids(recipesForToken(def('s6_forge')))).toEqual(ids(getSkillRecipePool('smithing')));
    });

    it('a Campfire and a Kitchen share one kind and one list; the Brewery has its own', () => {
        expect(ids(recipesForToken(def('s6_campfire')))).toEqual(['s6_stew', 's6_tea']);
        expect(ids(recipesForToken(def('s6_kitchen')))).toEqual(['s6_stew', 's6_tea']);
        expect(ids(recipesForToken(def('s6_brewery')))).toEqual(['s6_beer', 's6_tea']);
    });

    it('the recipe picker lists the same pool', () => {
        const hero = { id: 'h1', skills: { smithing: { level: 5 } } };
        const listed = RecipeList.recipeListFor(def('s6_furnace'), { heroes: [hero] }).entries
            .filter(e => e.kind === RecipeList.ENTRY.RECIPE)
            .map(e => e.recipe);
        expect(ids(listed)).toEqual(['s6_hinge', 's6_ingot']);
    });
});

describe('choosing a recipe', () => {
    it('a Furnace refuses a Smithy recipe and accepts its own', () => {
        const furnace = place('s6_furnace', { x: 400, y: 300 });
        expect(StationRecipe.setSelectedRecipe(furnace, 's6_pickaxe')).toBe(false);
        expect(furnace.selectedRecipeId).toBeUndefined();
        expect(StationRecipe.setSelectedRecipe(furnace, 's6_ingot')).toBe(true);
        expect(StationRecipe.selectedRecipe(furnace)?.id).toBe('s6_ingot');
    });

    it('an old save: a Furnace set to a tool recipe falls back to Choose a recipe', () => {
        const furnace = place('s6_furnace', { x: 400, y: 300 });
        // Written before the Furnace had a kind, when it offered every Smithing recipe.
        furnace.selectedRecipeId = 's6_pickaxe';
        const saved = JSON.parse(JSON.stringify(GameState.state));
        GameState.initNew();
        GameState.state.board = saved.board;
        const loaded = BoardState.getTokenById(furnace.id);
        expect(loaded.selectedRecipeId).toBe('s6_pickaxe');

        const res = RecipeResolver.resolveRecipe(loaded.id, loaded);
        expect(res.status).toBe(RECIPE.NONE);
        expect(res.reason).toBe('choose_recipe');
        expect(loaded.selectedRecipeId).toBeUndefined();
        // And the player can pick again.
        expect(StationRecipe.setSelectedRecipe(loaded, 's6_ingot')).toBe(true);
        expect(RecipeResolver.resolveRecipe(loaded.id, loaded).status).toBe(RECIPE.OK);
    });
});

describe('the anvil context tag keeps working', () => {
    it('a Smithy recipe that still needs an anvil waits for one, and runs beside it', () => {
        const smithy = place('s6_smithy', { x: 400, y: 300 });
        expect(StationRecipe.setSelectedRecipe(smithy, 's6_sword')).toBe(true);
        expect(RecipeResolver.resolveRecipe(smithy.id, smithy).reason).toBe('missing_context');
        place('s6_anvil', { x: 560, y: 300 });
        expect(RecipeResolver.resolveRecipe(smithy.id, smithy).status).toBe(RECIPE.OK);
    });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { GAME_VERSION } from '../state/StateSchema.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as RecipeResolver from '../systems/board/RecipeResolver.js';
import { RECIPE } from '../systems/board/RecipeResolver.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { QuestManager } from '../systems/quests/QuestManager.js';

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * `A` and `NEIGHBOUR` are 160 u apart, so the context Token beside the station
 * is a neighbour at the shipped 164 u Near.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** The Token standing exactly on spot `i`, and its instance id. */
const tokenAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0] ?? null;
const idAt = (i) => tokenAt(i)?.id ?? null;

/**
 * Station recipe selection (Recipe & Charges rework, P2).
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * A second cooking pool entry that is LOWER level than the fixtures' own, and
 * authored last.
 */
registerRecipePools({
    cooking: [{
        id: 'pooled_gruel',
        levelRequirement: 0,
        requiresContext: [],
        inputs: [],
        outputs: [{ itemId: 'fixture_carrot', minQty: 1, maxQty: 1, chance: 100 }],
        durationMs: 10000,
        xp: 1
    }]
});

const A = 15, NEIGHBOUR = 16;

function place(tile, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, C(tile));
    return instance;
}

beforeEach(() => {
    GameState.initNew();
});

describe('TL-15 — a freshly placed station starts with no recipe', () => {
    it('is placed with nothing selected, though its pool holds a level-0 recipe', () => {
        // `pooled_gruel` is level 0: would have picked it.
        const kitchen = place(A, 'fixture_kitchen');
        expect(kitchen.selectedRecipeId).toBeUndefined();
        expect(StationRecipe.selectedRecipe(kitchen)).toBeNull();
    });

    it('a PRIVATE-recipe station starts with nothing selected too', () => {
        const forge = place(A, 'fixture_station');
        expect(forge.selectedRecipeId).toBeUndefined();
    });

    it('with nothing picked, the resolver says choose_recipe and runs nothing', () => {
        const kitchen = place(A, 'fixture_kitchen');
        const res = RecipeResolver.resolveRecipe(kitchen.id, kitchen);
        expect(res.status).toBe(RECIPE.NONE);
        expect(res.reason).toBe('choose_recipe');
        expect(RecipeResolver.effectiveIO(kitchen.id, kitchen).outputs).toEqual([]);
    });

    it('a picked recipe stays: placing it again does not clear or change it', () => {
        const kitchen = place(A, 'fixture_kitchen');
        expect(StationRecipe.setSelectedRecipe(kitchen, 'pooled_stew')).toBe(true);
        Placement.placeTokenAt(kitchen, C(20));
        expect(kitchen.selectedRecipeId).toBe('pooled_stew');
        expect(RecipeResolver.resolveRecipe(kitchen.id, kitchen).reason).not.toBe('choose_recipe');
    });

    it('a picked recipe survives a save round trip', () => {
        const kitchen = place(A, 'fixture_kitchen');
        StationRecipe.setSelectedRecipe(kitchen, 'pooled_pie');
        const saved = JSON.parse(JSON.stringify(GameState.state));
        GameState.initNew();
        GameState.state.board = saved.board;
        const loaded = BoardState.getTokenById(kitchen.id);
        expect(loaded.selectedRecipeId).toBe('pooled_pie');
        expect(StationRecipe.selectedRecipe(loaded).id).toBe('pooled_pie');
    });

    it('leaves a Token with no recipes alone', () => {
        // A Forest is not a station. Writing a null selection onto every
        // resource on the board would be noise in every save.
        const forest = place(A, 'fixture_producer');
        expect('selectedRecipeId' in forest).toBe(false);
    });
});

describe('The selection is the recipe\'s stable id', () => {
    it('survives a recipe being inserted ahead of it in the pool', () => {
        const kitchen = place(A, 'fixture_kitchen');
        StationRecipe.setSelectedRecipe(kitchen, 'pooled_pie');

        registerRecipePools({
            cooking: [{
                id: 'pooled_inserted', levelRequirement: 4, requiresContext: [],
                inputs: [], outputs: [], durationMs: 10000, xp: 1
            }]
        });

        expect(StationRecipe.selectedRecipe(kitchen).id).toBe('pooled_pie');
    });

    it('refuses a recipe from another station\'s pool', () => {
        const kitchen = place(A, 'fixture_kitchen');
        StationRecipe.setSelectedRecipe(kitchen, 'pooled_stew');
        expect(StationRecipe.setSelectedRecipe(kitchen, 'pooled_charged_bar')).toBe(false);
        expect(kitchen.selectedRecipeId).toBe('pooled_stew');
    });

    it('a selection whose recipe no longer exists becomes no recipe (TL-15)', () => {
        // A CMS deletion under a live save. It used to re-default; now the
        // station waits for the player and says so ("Choose a recipe").
        const kitchen = place(A, 'fixture_kitchen');
        kitchen.selectedRecipeId = 'recipe_that_was_deleted';
        expect(StationRecipe.validateSelection(kitchen)).toBeNull();
        expect('selectedRecipeId' in kitchen).toBe(false);
        expect(RecipeResolver.resolveRecipe(kitchen.id, kitchen).reason).toBe('choose_recipe');
    });
});

describe('Persistence — until it reaches the Vault', () => {
    it('keeps its recipe when moved across the board', () => {
        const forge = place(A, 'fixture_station');
        StationRecipe.setSelectedRecipe(forge, 'recipe_b');

        Placement.moveTokenTo(forge.id, C(30));

        expect(tokenAt(30).selectedRecipeId).toBe('recipe_b');
    });

    // 'forgets it in the Vault, and re-defaults when placed again' went with
    // the Vault (Token Lifecycle 9.3).
});

// The 'Save migration — a save written before the field existed' suite was deleted
// in Free Playmat slice 1.6a with `StationRecipe.backfillBoardSelections`: saves
// from before schema 0.8.0 are refused outright. A station placed today starts
// with no recipe — see the suites above.

describe('Validation, not discovery', () => {
    it('reports the selected recipe\'s own missing context, and only that', () => {
        const kitchen = place(A, 'fixture_kitchen');
        StationRecipe.setSelectedRecipe(kitchen, 'pooled_pie');

        const missing = RecipeResolver.getMissingRequirements(idAt(A), kitchen);
        expect(missing.type).toBe('tokens');
        // The pie's two tags. Not `ctx_fixture_a`, which only the stew wants.
        expect(missing.items.sort()).toEqual(['Ctx Berry Cookbook', 'Ctx Pie Tin']);
    });

    it('returns the selected recipe even while it is gated, so callers can say what is missing', () => {
        const kitchen = place(A, 'fixture_kitchen');
        StationRecipe.setSelectedRecipe(kitchen, 'pooled_pie');

        const resolved = RecipeResolver.resolveRecipe(idAt(A), kitchen);
        expect(resolved.status).toBe(RECIPE.NONE);
        expect(resolved.reason).toBe('missing_context');
        expect(resolved.recipe.id).toBe('pooled_pie');
    });

    it('clears once the context arrives', () => {
        const kitchen = place(A, 'fixture_kitchen');
        StationRecipe.setSelectedRecipe(kitchen, 'pooled_stew');
        place(NEIGHBOUR, 'fixture_context_a');

        expect(RecipeResolver.resolveRecipe(idAt(A), kitchen).status).toBe(RECIPE.OK);
    });

    it('has no CONFLICT state left to reach', () => {
        expect(RECIPE.CONFLICT).toBeUndefined();
    });
});

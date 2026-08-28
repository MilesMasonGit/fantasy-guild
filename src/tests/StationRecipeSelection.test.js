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
import * as TokenBank from '../systems/board/TokenBank.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { QuestManager } from '../systems/quests/QuestManager.js';

/**
 * Station recipe selection (Recipe & Charges rework, P2).
 *
 * The rework's central reversal: **the player chooses the recipe and the board
 * gates it**, where adjacency used to choose. These tests pin the three things
 * that reversal turns on — the default on placement (R-5), the id being stable
 * rather than positional, and a save written before the field existed loading
 * into the same state a fresh placement would produce.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * A second cooking pool entry that is LOWER level than the fixtures' own, and
 * authored last. It is the instrument for two separate claims: that the default
 * is the lowest level rather than the first authored, and that inserting a
 * recipe cannot renumber an existing selection.
 */
registerRecipePools({
    cooking: [{
        id: 'pooled_gruel',
        levelRequirement: 0,
        requiresContext: [],
        inputs: [],
        outputs: [{ itemId: 'item_carrot', minQty: 1, maxQty: 1, chance: 100 }],
        durationMs: 10000,
        xp: 1
    }]
});

const A = 17, NEIGHBOUR = 18;

function place(tile, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeToken(tile, instance);
    return BoardState.getToken(tile);
}

beforeEach(() => {
    GameState.initNew();
});

describe('R-5 — a freshly placed station defaults to its pool\'s lowest-level recipe', () => {
    it('takes the lowest level, not the first authored', () => {
        // `pooled_gruel` is registered after stew and pie, and is level 0.
        const kitchen = place(A, 'fixture_kitchen');
        expect(kitchen.selectedRecipeId).toBe('pooled_gruel');
    });

    it('defaults with nobody assigned at all', () => {
        // R-5 is explicit that the worker is not consulted — not their level,
        // not their existence.
        const kitchen = place(A, 'fixture_kitchen');
        expect(StationRecipe.selectedRecipe(kitchen).id).toBe('pooled_gruel');
    });

    it('defaults a PRIVATE-recipe station from its own list', () => {
        const forge = place(A, 'fixture_station');
        expect(forge.selectedRecipeId).toBe('recipe_a');
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
        expect(StationRecipe.setSelectedRecipe(kitchen, 'pooled_charged_bar')).toBe(false);
        expect(kitchen.selectedRecipeId).toBe('pooled_gruel');
    });

    it('re-defaults a selection whose recipe no longer exists', () => {
        // A CMS deletion under a live save. The alternative is a station idle
        // forever for a reason nothing on screen can explain.
        const kitchen = place(A, 'fixture_kitchen');
        kitchen.selectedRecipeId = 'recipe_that_was_deleted';
        expect(StationRecipe.ensureSelection(kitchen).id).toBe('pooled_gruel');
    });
});

describe('Persistence — until it reaches the Vault', () => {
    it('keeps its recipe when moved across the board', () => {
        const forge = place(A, 'fixture_station');
        StationRecipe.setSelectedRecipe(forge, 'recipe_b');

        Placement.moveToken(A, 30);

        expect(BoardState.getToken(30).selectedRecipeId).toBe('recipe_b');
    });

    it('keeps its recipe through the Tray', () => {
        const forge = place(A, 'fixture_station');
        StationRecipe.setSelectedRecipe(forge, 'recipe_b');

        Placement.returnTokenToTray(A);
        const fromTray = BoardState.takeFromTray(0);
        Placement.placeToken(A, fromTray);

        expect(BoardState.getToken(A).selectedRecipeId).toBe('recipe_b');
    });

    it('forgets it in the Vault, and re-defaults when placed again', () => {
        vi.spyOn(QuestManager, 'isTokenVaultSendUnlocked').mockReturnValue(true);
        const forge = place(A, 'fixture_station');
        StationRecipe.setSelectedRecipe(forge, 'recipe_b');

        Placement.returnTokenToVault(A);
        const drawn = TokenBank.withdraw('fixture_station');
        Placement.placeToken(A, drawn);

        expect(BoardState.getToken(A).selectedRecipeId).toBe('recipe_a');
        vi.restoreAllMocks();
    });
});

describe('Save migration — a save written before the field existed', () => {
    /** A save whose placed stations carry no `selectedRecipeId`, as all do. */
    function legacySave() {
        const state = structuredClone(GameState.state);
        state.board.tiles = {
            17: { id: 'tok_a', typeId: 'fixture_kitchen', usesRemaining: 900, cycleElapsedMs: 0 },
            18: { id: 'tok_b', typeId: 'fixture_station', usesRemaining: 700, cycleElapsedMs: 0 },
            19: { id: 'tok_c', typeId: 'fixture_producer', usesRemaining: 5000, cycleElapsedMs: 0 }
        };
        return state;
    }

    it('comes out holding the R-5 default', () => {
        const migrated = migrateState(legacySave(), GAME_VERSION);
        expect(migrated.board.tiles[17].selectedRecipeId).toBe('pooled_gruel');
        expect(migrated.board.tiles[18].selectedRecipeId).toBe('recipe_a');
    });

    it('leaves non-stations without the field', () => {
        const migrated = migrateState(legacySave(), GAME_VERSION);
        expect('selectedRecipeId' in migrated.board.tiles[19]).toBe(false);
    });

    it('does not overwrite a selection a save already carries', () => {
        const state = legacySave();
        state.board.tiles[17].selectedRecipeId = 'pooled_pie';

        const migrated = migrateState(state, GAME_VERSION);
        expect(migrated.board.tiles[17].selectedRecipeId).toBe('pooled_pie');
    });

    it('loads a migrated station straight into a runnable state', () => {
        // The end-to-end claim: a save that predates the field is not merely
        // patched, it plays. `pooled_gruel` needs no context, so the station
        // resolves OK the moment it is on the board.
        const migrated = migrateState(legacySave(), GAME_VERSION);
        GameState.state.board = migrated.board;

        const resolved = RecipeResolver.resolveRecipe(17, BoardState.getToken(17));
        expect(resolved.status).toBe(RECIPE.OK);
        expect(resolved.recipe.id).toBe('pooled_gruel');
    });

    it('needs no save-schema bump — the same version still loads', () => {
        // The field is optional and its absence has a defined meaning, so
        // bumping GAME_VERSION would refuse every existing save rather than
        // migrate it.
        expect(() => migrateState(legacySave(), GAME_VERSION)).not.toThrow();
    });
});

describe('Validation, not discovery', () => {
    it('reports the selected recipe\'s own missing context, and only that', () => {
        const kitchen = place(A, 'fixture_kitchen');
        StationRecipe.setSelectedRecipe(kitchen, 'pooled_pie');

        const missing = RecipeResolver.getMissingRequirements(A, kitchen);
        expect(missing.type).toBe('tokens');
        // The pie's two tags. Not `ctx_fixture_a`, which only the stew wants.
        expect(missing.items.sort()).toEqual(['Ctx Berry Cookbook', 'Ctx Pie Tin']);
    });

    it('returns the selected recipe even while it is gated, so callers can say what is missing', () => {
        const kitchen = place(A, 'fixture_kitchen');
        StationRecipe.setSelectedRecipe(kitchen, 'pooled_pie');

        const resolved = RecipeResolver.resolveRecipe(A, kitchen);
        expect(resolved.status).toBe(RECIPE.NONE);
        expect(resolved.reason).toBe('missing_context');
        expect(resolved.recipe.id).toBe('pooled_pie');
    });

    it('clears once the context arrives', () => {
        const kitchen = place(A, 'fixture_kitchen');
        StationRecipe.setSelectedRecipe(kitchen, 'pooled_stew');
        place(NEIGHBOUR, 'fixture_context_a');

        expect(RecipeResolver.resolveRecipe(A, kitchen).status).toBe(RECIPE.OK);
    });

    it('has no CONFLICT state left to reach', () => {
        expect(RECIPE.CONFLICT).toBeUndefined();
    });
});

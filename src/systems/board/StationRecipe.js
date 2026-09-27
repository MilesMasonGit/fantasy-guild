// Fantasy Guild — station recipe selection (Recipe & Charges rework, P2)

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { recipesForToken } from '../../config/registries/recipePoolRegistry.js';

/**
 * Which recipe a station is set to — the one place `selectedRecipeId` is read
 * or written.
 *
 * ## The selection is the station's, and the board only gates it
 * Before this phase a station had no selection at all: `RecipeResolver` looked
 * at the Tokens beside it and *inferred* what it was making. That is reversed
 * here (roadmap §2). The player picks the recipe; adjacency decides whether the
 * pick can run right now.
 *
 * ## It is the recipe's stable `id`, never a position
 * A pool index renumbers the moment a recipe is inserted in the CMS, which would
 * silently repoint every saved station. P0 put an `id` on every recipe for this
 * field to hold.
 *
 * ## No default: a station starts with nothing selected (TL-15)
 * Every station, however it arrives (bought, built on a Foundation, made by a
 * recipe, placed), is idle until the player picks a recipe; heroes do not work
 * it until then, and a picked recipe stays. This replaced R-5, under which a
 * freshly placed station took the lowest-level recipe of its pool, so a hero
 * started working it the moment it landed (owner feedback FB-13). Foundations
 * never had a default (Token Lifecycle 6.1, SP-49); stations now behave the
 * same way. With nothing picked the resolver says `choose_recipe` (a
 * Foundation says `choose_build`), and flags pass it over.
 *
 * ## Lifetime
 * The selection lives on the Token instance, so it travels with the Token: it
 * survives a save and a move across the mat, and ends when the Token is
 * removed. (A trip through the Vault used to end it too; the Vault went in
 * Token Lifecycle 9.3.)
 */

/** A recipe's level gate. Absent means ungated — fixtures author no level. */
export function recipeLevel(recipe) {
    return typeof recipe?.levelRequirement === 'number' ? recipe.levelRequirement : 0;
}

/** The recipes this Token may choose between: its `Works as` skill's pool. */
export function poolFor(def) {
    return recipesForToken(def) || [];
}

/** The Token type behind an instance, tolerating a def the caller already has. */
function defOf(instance, def) {
    return def || getTokenType(instance?.typeId);
}

/**
 * The recipe object this instance is set to, or null.
 *
 * Resolved **within the station's own pool** rather than through the global
 * registry, so a selection can never name a recipe this station has no business
 * running — a Kitchen cannot be set to a Smithing recipe by id.
 */
export function selectedRecipe(instance, def = null) {
    const id = instance?.selectedRecipeId;
    if (!id) return null;
    return poolFor(defOf(instance, def)).find(r => r.id === id) || null;
}

/**
 * Set a station's recipe. Refused unless the id is in that station's pool.
 *
 * This is what P3's modal calls. It is deliberately the only writer: a caller
 * that assigns `selectedRecipeId` by hand can set a station to a recipe it
 * cannot run, which the engine would then read as "no recipe" forever.
 *
 * @returns {boolean} whether the selection was accepted
 */
export function setSelectedRecipe(instance, recipeId, def = null) {
    if (!instance) return false;
    const inPool = poolFor(defOf(instance, def)).some(r => r.id === recipeId);
    if (!inPool) return false;
    instance.selectedRecipeId = recipeId;
    return true;
}

/** Forget a station's selection. It then waits for the player to pick again (TL-15). */
export function clearSelection(instance) {
    if (instance) delete instance.selectedRecipeId;
}

/**
 * The recipe this instance is set to, having first dropped a selection that is
 * no longer valid. Returns null when nothing (valid) is selected.
 *
 * **It never picks for the player** (TL-15): a station with nothing selected
 * stays that way until the player chooses.
 *
 * **An id that is no longer in the pool becomes no recipe.** A recipe can be
 * renamed or deleted in the CMS under a save that references it. Before TL-15
 * such a station re-defaulted; it now waits for the player like a new one, and
 * says so ("Choose a recipe"), so it is never idle for a reason nothing on
 * screen explains.
 */
export function validateSelection(instance, def = null) {
    if (!instance) return null;
    const current = selectedRecipe(instance, defOf(instance, def));
    if (current) return current;
    if (instance.selectedRecipeId) delete instance.selectedRecipeId;
    return null;
}

// `backfillBoardSelections` (the P2 save migration) was deleted in Free Playmat
// slice 1.6a: it only carried pre-0.8.0 boards forward, and those saves are now
// refused outright.

/**
 * The work config a hero is checked against on this Token: its own `config`,
 * or, for a Foundation (Token Lifecycle 6.1, DP-6), one built from its
 * `foundation` block. A Foundation authors no `config` of its own; the skill is
 * `foundation.skill` (Construction, or Farming for farmland, SP-47) and the
 * level is the **selected recipe's** `levelRequirement` (SP-49), so a hero
 * below it cannot work it. With nothing selected the level is 0: the
 * Foundation is stopped by "Choose what to build", not by a level.
 *
 * Returns null for a Token with neither, which is inert.
 */
export function workConfigOf(def, instance = null) {
    if (!def?.foundation) return def?.config || null;
    const recipe = instance ? selectedRecipe(instance, def) : null;
    return {
        ...(def.config || {}),
        skill: def.foundation.skill,
        skillRequired: Math.max(def.config?.skillRequired || 0, recipeLevel(recipe))
    };
}

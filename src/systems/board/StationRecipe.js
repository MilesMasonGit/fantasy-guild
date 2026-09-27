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
 * ## Default: the pool's lowest level, always (R-5)
 * Not "the best the assigned worker can run", and not "the best anyone in the
 * guild can run" — a freshly placed station takes the lowest-`levelRequirement`
 * recipe of its pool regardless of who is standing on it, or whether anyone is.
 * If that worker cannot run it, the existing skill-too-low alert fires; that is
 * the intended outcome, not a case to design around.
 *
 * Ties break on pool order, so the default is deterministic. It is not otherwise
 * meaningful — three cooking recipes share `levelRequirement: 1` today, and
 * which of them a new Kitchen starts on is arbitrary by design.
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

/**
 * The recipe a freshly placed station starts on (R-5), or null when its pool is
 * empty. An empty pool is not an error: a Forest is not a station and has no
 * recipes at all.
 */
export function defaultRecipeFor(def) {
    // A Foundation never picks for the player (Token Lifecycle 6.1, SP-49):
    // what it becomes is the player's choice, and until they make it the
    // Foundation says "Choose what to build" and nobody works it.
    if (def?.foundation) return null;
    const pool = poolFor(def);
    if (!pool.length) return null;
    let best = pool[0];
    for (const recipe of pool) {
        if (recipeLevel(recipe) < recipeLevel(best)) best = recipe;
    }
    return best;
}

/** The id of that default, or null. */
export function defaultRecipeIdFor(def) {
    return defaultRecipeFor(def)?.id ?? null;
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

/** Forget a station's selection. Placing it again re-defaults per R-5. */
export function clearSelection(instance) {
    if (instance) delete instance.selectedRecipeId;
}

/**
 * Give an instance a selection if it has no valid one, and return the recipe.
 *
 * Called on placement, so a station is set the moment it lands, and again from
 * the resolver and the save backfill so no path can produce a station sitting
 * on nothing.
 *
 * **An id that is no longer in the pool re-defaults.** A recipe can be renamed
 * or deleted in the CMS under a save that references it; the alternative is a
 * station that is permanently idle for a reason nothing on screen can explain.
 */
export function ensureSelection(instance, def = null) {
    if (!instance) return null;
    const resolvedDef = defOf(instance, def);
    const current = selectedRecipe(instance, resolvedDef);
    if (current) return current;

    const fallback = defaultRecipeFor(resolvedDef);
    if (!fallback) {
        // No pool at all — leave the field off rather than writing null onto
        // every Forest and Campfire on the board.
        if (instance.selectedRecipeId) delete instance.selectedRecipeId;
        return null;
    }
    instance.selectedRecipeId = fallback.id;
    return fallback;
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

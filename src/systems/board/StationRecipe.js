// station recipe selection

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { recipesForToken } from '../../config/registries/recipePoolRegistry.js';
import { fieldOf } from '../../config/registries/tokenConstants.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import * as Demolition from './Demolition.js';

/**
 * Which recipe a station is set to: the one place `selectedRecipeId` is read or written.
 *
 * The selection is the station's and the board only gates it: the player picks the recipe and
 * adjacency decides whether the pick can run right now.
 *
 * It is the recipe's stable `id`, never a pool position, which renumbers when a recipe is inserted
 * in the CMS and would silently repoint every saved station.
 *
 * No default: every station, however it arrives, starts with nothing selected and is idle until the
 * player picks; heroes do not work it until then. With nothing picked the resolver says
 * `choose_recipe` (a Foundation says `choose_build`), and flags pass it over.
 *
 * The selection lives on the Token instance, so it survives a save and a move across the mat, and
 * ends when the Token is removed.
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
 * Deliberately the only writer: assigning `selectedRecipeId` by hand can set a station to a recipe
 * it cannot run, which the engine would read as no recipe forever.
 *
 * A new selection starts the work cycle from zero ({@link restartCycle}).
 *
 * It announces its own change: a new selection publishes `TILE_CHANGED { instanceId, typeId }`,
 * which the Token's gear badge and inspection panel re-read on. The UI never publishes engine
 * events.
 *
 * @returns {boolean} whether the selection was accepted
 */
export function setSelectedRecipe(instance, recipeId, def = null) {
    if (!instance) return false;
    const inPool = poolFor(defOf(instance, def)).some(r => r.id === recipeId);
    if (!inPool) return false;
    if (instance.selectedRecipeId === recipeId) return true;
    instance.selectedRecipeId = recipeId;
    restartCycle(instance, defOf(instance, def));
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId: instance.typeId });
    return true;
}

/**
 * A new recipe starts its work cycle from zero, so the cycle that finishes is one that began as this
 * recipe and announced its start (a drink's dose, On Work Start).
 * ⚠️ Not a Field, whose pick waits for the next sowing while its hero harvests the crop in the
 * ground, nor a Token marked for demolition, whose progress is the demolishing.
 */
function restartCycle(instance, def) {
    if (!(instance.cycleElapsedMs > 0) || fieldOf(def) != null || Demolition.isMarked(instance)) return;
    instance.cycleElapsedMs = 0;
    EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: instance.id, percent: 0 });
}

/** Forget a station's selection. It then waits for the player to pick again. */
export function clearSelection(instance) {
    if (instance) delete instance.selectedRecipeId;
}

/**
 * The recipe this instance is set to, or null when nothing (valid) is selected.
 *
 * It never picks for the player.
 *
 * An id no longer in the pool reads as no recipe: a recipe can be deleted in the CMS, or moved to
 * another skill or station kind, under a save that references it. The station then waits for the
 * player and says so (Choose a recipe), so it is never idle for a reason nothing on screen explains.
 * ⚠️ The id itself is kept, so a recipe that comes back in the next Sync is picked again; only
 * the player's next pick overwrites it.
 */
export function validateSelection(instance, def = null) {
    if (!instance) return null;
    return selectedRecipe(instance, defOf(instance, def));
}

/**
 * The work config a hero is checked against on this Token: its own `config` with the selected
 * recipe's level folded into `skillRequired`, or, for a Foundation, one built from its
 * `foundation` block. A Foundation authors no `config`; the skill is
 * `foundation.skill` (Construction, or Farming for farmland) and the level is the selected recipe's
 * `levelRequirement`. With nothing selected the level is 0: the Foundation is stopped by Choose
 * what to build, not by a level.
 *
 * Returns null for a Token with neither, which is inert.
 *
 * A Token marked for demolition is demolition work whatever it is (`Demolition.DEMOLITION_CONFIG`).
 * ⚠️ So every caller deciding who works a Token, or how, must pass the instance: the type alone
 * cannot know the mark.
 */
export function workConfigOf(def, instance = null) {
    if (Demolition.isMarked(instance)) return Demolition.DEMOLITION_CONFIG;
    if (!def?.foundation) {
        if (!def?.config) return null;
        const level = recipeLevel(instance ? selectedRecipe(instance, def) : null);
        if (level <= (def.config.skillRequired || 0)) return def.config;
        return { ...def.config, skillRequired: level };
    }
    const recipe = instance ? selectedRecipe(instance, def) : null;
    return {
        ...(def.config || {}),
        skill: def.foundation.skill,
        skillRequired: Math.max(def.config?.skillRequired || 0, recipeLevel(recipe))
    };
}

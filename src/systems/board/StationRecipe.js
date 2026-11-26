// station recipe selection

import { getTokenType, registryVersion } from '../../config/registries/tokenRegistry.js';
import { recipesForToken, recipePoolsVersion } from '../../config/registries/recipePoolRegistry.js';
import { fieldOf, shrineOf } from '../../config/registries/tokenConstants.js';
import { hasCatchPools } from '../../config/registries/catchPools.js';
import { SUMMONING_SKILL } from '../../config/registries/summonRules.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import * as Demolition from './Demolition.js';
import * as Laboratories from './Laboratories.js';

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
 *
 * **A second recipe** (Many Hands, `SecondRecipe.js`): a making station may also be set to a second
 * recipe, `secondRecipeId`, run beside the first while a hero holding Second Recipe works it, on its
 * own clock (`secondElapsedMs`). The first recipe is lane 1 and the second lane 2: every reader of a
 * selection takes the lane, lane 1 when none is named. Both are saved on the instance.
 */

/** The station's two recipes: the first, every station's, and the second, a Many Hands station's. */
export const LANE = Object.freeze({ FIRST: 1, SECOND: 2 });

/** A recipe's level gate. Absent means ungated — fixtures author no level. */
export function recipeLevel(recipe) {
    return typeof recipe?.levelRequirement === 'number' ? recipe.levelRequirement : 0;
}

/**
 * Each Token type's pool, kept while the Token registry and the recipe pools are as they were
 * (`registryVersion`, `recipePoolsVersion`). ⚠️ A pool is a filter over every recipe in the game,
 * and the runner, the flags and the resolver each ask a station's several times a tick.
 */
let pools = { tokens: -1, version: -1, byDef: new WeakMap() };

const NO_POOL = Object.freeze([]);

/**
 * The recipes this Token may choose between: its `Works as` skill's pool. Shared and frozen: read
 * it, never change it.
 */
export function poolFor(def) {
    if (!def || typeof def !== 'object') return NO_POOL;
    const tokens = registryVersion();
    const version = recipePoolsVersion();
    if (pools.tokens !== tokens || pools.version !== version) pools = { tokens, version, byDef: new WeakMap() };
    let pool = pools.byDef.get(def);
    if (!pool) {
        pool = Object.freeze(recipesForToken(def) || []);
        pools.byDef.set(def, pool);
    }
    return pool;
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
export function selectedRecipe(instance, def = null, lane = LANE.FIRST) {
    const id = lane === LANE.SECOND ? instance?.secondRecipeId : instance?.selectedRecipeId;
    if (!id) return null;
    return poolFor(defOf(instance, def)).find(r => r.id === id) || null;
}

/**
 * Set a station's recipe. Refused unless the id is in that station's pool.
 *
 * Deliberately the only writer: assigning `selectedRecipeId` by hand can set a station to a recipe
 * it cannot run, which the engine would read as no recipe forever.
 *
 * A new selection starts the work cycle from zero ({@link restartCycle}). A pick of the recipe the
 * second lane runs clears the second lane: the two are always different recipes.
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
    if (instance.secondRecipeId === recipeId) dropSecond(instance);
    restartCycle(instance, defOf(instance, def));
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId: instance.typeId });
    return true;
}

const secondMemo = new WeakMap();

/**
 * Whether a Token type may be set to a second recipe: a making station with a recipe pool. Never a
 * Foundation (its pick is a build), a Field (a crop), a water, a Hideout or a Laboratory (no recipe),
 * a shrine (an offering) or a Summoning Circle (one summon each). Which skill's stations the effect
 * reaches is its own narrowing (Many Hands: Crafting). Kept per definition.
 */
export function takesSecondRecipe(def) {
    if (!def || typeof def !== 'object') return false;
    let answer = secondMemo.get(def);
    if (answer === undefined) {
        answer = !def.foundation && fieldOf(def) == null && shrineOf(def) == null && !hasCatchPools(def)
            && !Laboratories.isLaboratory(def) && def.config?.skill !== SUMMONING_SKILL
            && poolFor(def).length > 0;
        secondMemo.set(def, answer);
    }
    return answer;
}

/**
 * Set a station's second recipe. Refused unless the station takes one ({@link takesSecondRecipe}),
 * the id is in its pool and it is not the recipe the first lane runs: the two are always different.
 * The only writer of `secondRecipeId`. A new pick starts the second lane's cycle from zero and
 * announces itself as a first pick does (`TILE_CHANGED`).
 *
 * @returns {boolean} whether the selection was accepted
 */
export function setSecondRecipe(instance, recipeId, def = null) {
    if (!instance) return false;
    const type = defOf(instance, def);
    if (!takesSecondRecipe(type) || recipeId === instance.selectedRecipeId) return false;
    if (!poolFor(type).some(r => r.id === recipeId)) return false;
    if (instance.secondRecipeId === recipeId) return true;
    instance.secondRecipeId = recipeId;
    forfeitSecond(instance);
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId: instance.typeId });
    return true;
}

/** Clear a station's second recipe: its second lane stops, its progress and problem gone. */
export function clearSecondRecipe(instance) {
    if (!instance || instance.secondRecipeId === undefined) return false;
    dropSecond(instance);
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId: instance.typeId });
    return true;
}

function dropSecond(instance) {
    forfeitSecond(instance);
    delete instance.secondRecipeId;
    delete instance.secondElapsedMs;
    delete instance.secondAlert;
}

/**
 * The second lane's cycle from zero, said to the card (`SECOND_PROGRESS`): its forfeit wherever the
 * first lane's cycle is forfeited (its hero leaving, a move, a demolition mark, a journey), and a new
 * second pick. Nothing for a station whose second lane stands at zero.
 */
export function forfeitSecond(instance) {
    if (!(instance?.secondElapsedMs > 0)) return;
    instance.secondElapsedMs = 0;
    EventBus.publish(BOARD_EVENTS.SECOND_PROGRESS, { instanceId: instance.id, percent: 0 });
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
export function validateSelection(instance, def = null, lane = LANE.FIRST) {
    if (!instance) return null;
    return selectedRecipe(instance, defOf(instance, def), lane);
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
 *
 * `lane` names the recipe whose level counts: the second lane's asks its own recipe's level.
 */
export function workConfigOf(def, instance = null, lane = LANE.FIRST) {
    if (Demolition.isMarked(instance)) return Demolition.DEMOLITION_CONFIG;
    if (!def?.foundation) {
        if (!def?.config) return null;
        // A Laboratory asks its chosen node's gathering level in Science, as a station its recipe's.
        const level = instance && Laboratories.isLaboratory(def)
            ? Laboratories.studyLevelOf(instance)
            : recipeLevel(instance ? selectedRecipe(instance, def, lane) : null);
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

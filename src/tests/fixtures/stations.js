// Fantasy Guild — test helper: a player picking a station's recipe

/**
 * **For tests only.**
 */

import * as StationRecipe from '../../systems/board/StationRecipe.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';

/** The recipe a test player picks for a station: its pool's lowest level. Null for no pool. */
export function lowestRecipeFor(def) {
    const pool = StationRecipe.poolFor(def);
    if (!pool.length) return null;
    let best = pool[0];
    for (const recipe of pool) {
        if (StationRecipe.recipeLevel(recipe) < StationRecipe.recipeLevel(best)) best = recipe;
    }
    return best;
}

/**
 * Pick a recipe for `instance` as the player would. With no `recipeId`, the
 * pool's lowest level. Does nothing to a Foundation (what it builds is a
 * separate pick) or to a Token with no pool. Returns the instance.
 */
export function pickRecipe(instance, recipeId = null) {
    if (!instance) return instance;
    const def = getTokenType(instance.typeId);
    if (!def || def.foundation) return instance;
    const id = recipeId || lowestRecipeFor(def)?.id;
    if (id) StationRecipe.setSelectedRecipe(instance, id, def);
    return instance;
}

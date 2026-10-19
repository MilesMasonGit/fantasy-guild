// ⚠️ Kept only while Board.jsx still opens the old recipe window from the mat's gear: it hands
// this result to StationRecipeModal. Delete both once the gear opens the Token card's list.

import { recipeListFor } from './RecipeList.js';

/** The recipe list for one station, with what the window needs to draw it. */
export function bandStationRecipes(def, workerId, heroes) {
    return { def, workerId: workerId || null, heroes: heroes || [], ...recipeListFor(def, { workerId, heroes }) };
}

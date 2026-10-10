/**
 * How the CMS's authored content becomes the files in `data/`. Recipes go through `recalculateEconomy` like everything else.
 * ⚠️ Copy, never rebuild: a recipe is spread, not reconstructed field by field, because sync drops whatever the writer does not name and a recipe carries fields with no editor behind them (`requiresContext`, `stationChargeCost`, `tokenId` outputs). `src/tests/RecipeSyncRoundTrip.test.js` pins that.
 */

/** Flatten the CMS's skill-keyed recipe pools into the flat array the game reads. The pool key is only a grouping; the recipe's own `skill` field is what the game filters on (`recipePoolRegistry.js`). A recipe with no `skill` is stamped with its pool's key so the flattened list stays loadable. */
export function recipesToFile(recipePools = {}) {
    const out = [];
    for (const [skillId, pool] of Object.entries(recipePools || {})) {
        for (const recipe of pool || []) {
            if (!recipe) continue;
            out.push(recipe.skill ? { ...recipe } : { ...recipe, skill: skillId });
        }
    }
    return out;
}

/** The full set of files one sync writes to `data/`. `balanced` is the output of `recalculateEconomy`, including the recipe pools. */
export function syncFiles(balanced = {}) {
    return {
        'items.json': balanced.items,
        'tokens.json': balanced.tokens,
        'tokenRecipes.json': recipesToFile(balanced.recipePools),
        // The named effect library. A Token carries references into it, so it must be written by the same sync as `tokens.json` or the game loads Tokens whose rules resolve to nothing. ⚠️ The write is wholesale; nothing merges with what is already on disk.
        'effects.json': balanced.effects || {},
        // ⚠️ Only when the workspace holds a Starter Camp: a workspace that never loaded one must not overwrite the one in `data/`.
        ...(balanced.starterCamp ? { 'starterCamp.json': balanced.starterCamp } : {}),
    };
}

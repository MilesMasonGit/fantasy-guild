// Fantasy Guild CMS — the sync payload builder

/**
 * How the CMS's authored content becomes the four files in `data/`.
 *
 * ## Recipes go through the economy pass, like everything else
 *
 * They did not always. A bypass used to take recipes straight from the store's
 * `recipePools`, around `recalculateEconomy`, because the solver of the day
 * rewrote a recipe's `xp` and because a recipe carried nine EV / auto-balance
 * fields that had to survive untouched. Both reasons are gone: the EV fields
 * are deleted, and the simulator that replaced that solver derives a recipe's
 * `durationMs` and output quantities and leaves its `xp` alone. So the payload
 * is built from one place — the recalculation's output — and a recipe is priced
 * on the same terms as a Token.
 *
 * ## Copy, never rebuild
 *
 * A recipe is spread, not reconstructed field by field. The CMS's known failure
 * mode is that sync drops whatever the writer does not name — and a recipe
 * carries fields with no editor behind them: `requiresContext` entries
 * (`{tag, minTier, chargeCost}`), `stationChargeCost`, `tokenId` outputs.
 * Spreading carries all of them, and their key order, without this file having
 * to know they exist.
 *
 * `src/tests/RecipeSyncRoundTrip.test.js` pins that: authored intent survives a
 * round trip byte-for-byte, and the retired fields cannot get back in.
 */

/**
 * Flatten the CMS's skill-keyed recipe pools into the flat array the game reads.
 *
 * The pool key is only a grouping; the recipe's own `skill` field is what the
 * game filters on (`recipePoolRegistry.js`). A recipe that has no `skill` — an
 * older workspace predates the field — is stamped with its pool's key so the
 * flattened list stays loadable.
 */
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

/**
 * The full set of files one sync writes to `data/`.
 *
 * `balanced` is the output of `recalculateEconomy` — all four collections,
 * including the recipe pools, which is what retiring the bypass bought.
 */
export function syncFiles(balanced = {}) {
    return {
        'items.json': balanced.items,
        'tokens.json': balanced.tokens,
        'maps.json': balanced.maps,
        'tokenRecipes.json': recipesToFile(balanced.recipePools),
    };
}

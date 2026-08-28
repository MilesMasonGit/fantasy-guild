// Fantasy Guild CMS — recipe sync payload (Recipe & Charges rework, P6a)

/**
 * How authored recipes become `data/tokenRecipes.json`.
 *
 * ## Recipes bypass the economy pass
 * `syncToGame` runs `recalculateEconomy` and writes *that* result for items,
 * tokens and maps. Recipes are taken from the store's `recipePools` instead.
 *
 * That is not a stylistic choice. `runFullBalance` returns a `recipes` map in
 * which `solveEntityXP` has already replaced `xp` with its own solved value
 * (`balanceRunner.js:108-112`), and the recipe carries nine EV / auto-balance
 * fields — `targetEV`, `calculatedEV`, `autoBalance`, `fieldLocks`,
 * `profitSplit`, `liquidityEV`, `progressionEV`, `goldPerMinute`,
 * `xpPerMinute` — that belong to the economic simulator rework and must be
 * carried through untouched (roadmap R-6, R-11). `recalculateEconomy` already
 * discards `result.recipes` and writes back only items, tokens and maps, so
 * reading the pools gives the authored recipe exactly as it was authored.
 *
 * ## Copy, never rebuild
 * A recipe is spread, not reconstructed field by field. The CMS's known failure
 * mode is that sync drops whatever the writer does not name — and a recipe
 * carries fields with no editor behind them: `requiresContext` entries
 * (`{tag, minTier, chargeCost}`), `stationChargeCost`, `durationMs`, `tokenId`
 * outputs, and the nine EV fields. Spreading carries all of them, and their key
 * order, without this file having to know they exist.
 *
 * `src/tests/RecipeSyncRoundTrip.test.js` pins that: the shipped file loaded in
 * and written back out must be byte-identical.
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
 * `balanced` is the output of `recalculateEconomy`; `recipePools` is the raw
 * store collection, deliberately not routed through it.
 */
export function syncFiles(balanced = {}, recipePools = {}) {
    return {
        'items.json': balanced.items,
        'tokens.json': balanced.tokens,
        'maps.json': balanced.maps,
        'tokenRecipes.json': recipesToFile(recipePools),
    };
}

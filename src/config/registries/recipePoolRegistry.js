// Fantasy Guild — Skill-pooled Token recipes (CMS rework Phase 3)

/**
 * Recipes that belong to a **skill** rather than to one station (CMS-39).
 *
 * ## The problem this solves
 * `token_forge` and `token_smelter` each carry their own private `recipes[]`.
 * That is fine for a station with two recipes and unworkable for a Kitchen,
 * which wants dozens — and worse, a second Cooking station (a Camp Stove, say)
 * would need every Kitchen recipe copied into it by hand, then kept in step
 * forever.
 *
 * Pooled recipes live here, keyed by skill id. Any station that opts in draws
 * the whole pool, so adding a Cooking recipe makes it available to every
 * Cooking station at once.
 *
 * ## Opt-in per station, not a skill-wide rule (CMS-76)
 * Smithing already has four stations, and only two of them want multi-recipe
 * behaviour — Charcoal Kiln and Deep Kiln are simple fixed producers. Nothing
 * forces every station of a skill into the pooled model because one station of
 * that skill wants variety.
 *
 * A Token opts in with `recipePool: '<skillId>'`. A Token without it keeps its
 * private `recipes[]` (or has no recipes at all).
 *
 * ## Strictly one or the other (CMS-77)
 * A station is pooled **or** private, never both. A would-be station-exclusive
 * recipe is authored *into* the pool instead, gated by a context tag that only
 * that station's setup satisfies (CMS-6) — same practical effect, without a
 * second recipe-source concept for the engine to track.
 * `ContentRules.test.js` asserts no Token declares both.
 *
 * ## Cycle time moves to the recipe (CMS-70)
 * A pooled recipe carries its own `cycleTimeMs` and `xp`, so a Feast can take
 * longer than Bread. Private stations keep the flat `config.cycleTimeMs` they
 * already have (CMS-79) — which is why nothing needed migrating.
 *
 * ## Recipe shape
 * ```jsonc
 * {
 *   "cooking": [
 *     {
 *       "id": "strawberry_pie",
 *       "requiresContext": ["ctx_pie_tin", "ctx_strawberry_cookbook"],
 *       "inputs":  [{ "itemId": "item_strawberry", "quantity": 3 }],
 *       "outputs": [{ "itemId": "item_strawberry_pie", "minQty": 1, "maxQty": 1, "chance": 100 }],
 *       "cycleTimeMs": 18000,
 *       "xp": 12
 *     }
 *   ]
 * }
 * ```
 *
 * ⚠️ **Never hand-edit `data/tokenRecipes.json` once the CMS is live** (CMS-53).
 */

import { DatabaseManager } from '../DatabaseManager.js';

/** Merge every recipe-pool JSON source into one object keyed by skill id. */
function loadJsonRecipePools() {
    const pools = {};

    for (const source of [DatabaseManager.recipePoolFilesSingle, DatabaseManager.recipePoolFilesGlob]) {
        for (const [path, module] of Object.entries(source || {})) {
            try {
                const data = module.default || module;
                for (const [skillId, recipes] of Object.entries(data)) {
                    if (!Array.isArray(recipes)) continue;
                    // Concatenate rather than replace, so a pool can be split
                    // across files by topic without one file shadowing another.
                    pools[skillId] = [...(pools[skillId] || []), ...recipes];
                }
            } catch (error) {
                console.warn(`[RecipePoolRegistry] Error loading recipe pool from ${path}:`, error);
            }
        }
    }

    return pools;
}

/** @type {Record<string, object[]>} */
const RECIPE_POOLS = loadJsonRecipePools();

/**
 * Every recipe belonging to a skill. Always an array — an unknown skill is an
 * empty pool, not an error, so a station that opts into a pool nobody has
 * authored yet behaves like a station with no valid context: it makes nothing.
 */
export function getSkillRecipePool(skillId) {
    return RECIPE_POOLS[skillId] || [];
}

/** Every skill that has at least one pooled recipe. */
export function listPooledSkillIds() {
    return Object.keys(RECIPE_POOLS);
}

/**
 * The recipes a Token can actually attempt — pooled or private, never both.
 *
 * The single place the pooled/private choice is resolved, so no caller has to
 * know which kind of station it is holding.
 */
export function recipesForToken(def) {
    if (def?.recipePool) return getSkillRecipePool(def.recipePool);
    return def?.recipes || [];
}

/** Add pooled recipes at runtime. **Test fixtures only** — mirrors `registerTokenTypes`. */
export function registerRecipePools(pools) {
    for (const [skillId, recipes] of Object.entries(pools || {})) {
        RECIPE_POOLS[skillId] = [...(RECIPE_POOLS[skillId] || []), ...recipes];
    }
}

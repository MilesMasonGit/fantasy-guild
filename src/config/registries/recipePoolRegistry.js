// Fantasy Guild — Recipe registry (Recipe & Charges rework, P0)

/**
 * Every recipe in the game, loaded from `data/tokenRecipes.json`.
 *
 * ## The file is a flat array and every recipe has an id
 * It used to be an object keyed by skill (`{ "cooking": [ … ] }`) in which a
 * recipe had no identifier of its own — it was identified by its position in
 * its skill's pool. P2 saves a station's chosen recipe on the token instance as
 * `selectedRecipeId`, and a position renumbers the moment someone inserts a
 * recipe in the CMS, which would silently repoint every saved station. So the
 * skill moved onto the recipe as a field, the file flattened, and `id` became
 * required. `getSkillRecipePool` is now a filter over one list rather than a
 * lookup into many.
 *
 * ## A recipe belongs to a skill
 * `skill` is a real skill id from `skillRegistry.js`. Subskills are retired
 * (R-2): Smelting, Weaponsmithing, Toolsmithing and Jewelry are all `smithing`,
 * and Baking and Cooking are both `cooking`. A station that opts into a pool
 * with `recipePool: '<skillId>'` draws every recipe of that skill, so adding a
 * Cooking recipe makes it available to every Cooking station at once.
 *
 * ## Opt-in per station
 * A Token without `recipePool` keeps its own `recipes[]` array (or has none).
 * No shipped Token currently uses that path — `data/tokens.json` contains no
 * `recipes` key — but the branch is still here, and `ContentRules.test.js`
 * still asserts no Token declares both.
 *
 * ## Recipe shape
 * ```jsonc
 * [
 *   {
 *     "id": "recipe_blueberry_pie",
 *     "name": "Blueberry Pie",
 *     "skill": "cooking",
 *     "levelRequirement": 3,
 *     "durationMs": 2900,
 *     "xp": 12,
 *     "inputs":  [{ "itemId": "item_blueberry", "quantity": 2 }],
 *     "requiresContext": [{ "tag": "ctx_pie_tin", "minTier": 1, "chargeCost": 0 }],
 *     "stationChargeCost": 1,
 *     "outputs": [{ "itemId": "item_blueberry_pie", "chance": 100, "minQty": 1, "maxQty": 1 }]
 *   }
 * ]
 * ```
 *
 * `requiresContext` entries are objects, not bare tag strings, so a recipe can
 * state a minimum tool tier and a per-cycle charge cost against the adjacent
 * Token. The entry is deliberately shaped like an `acceptedTokens` entry plus
 * `chargeCost`, so `checkAcceptedTokens` in `RecipeResolver.js` compares both
 * with the same code. `minTier` and `chargeCost` are authored data at P0;
 * nothing deducts a context charge until P4.
 *
 * `stationChargeCost` is the charges the station itself spends per cycle,
 * a separate axis from context charge costs (R-8). `BoardRunner.js` still
 * hardcodes a decrement of 1 per cycle; P1 makes it read this field.
 *
 * Nine EV fields (`targetEV`, `calculatedEV`, `autoBalance`, `fieldLocks`,
 * `profitSplit`, `liquidityEV`, `progressionEV`, `goldPerMinute`,
 * `xpPerMinute`) also sit flat on a recipe. Nothing in `src/` reads them; they
 * belong to the CMS balance engine and to the economic simulator rework (R-6).
 *
 * ⚠️ **Never hand-edit `data/tokenRecipes.json` once the CMS is live** (CMS-53).
 */

import { DatabaseManager } from '../DatabaseManager.js';

/** Concatenate every recipe JSON source into one flat list. */
function loadJsonRecipes() {
    const all = [];

    for (const source of [DatabaseManager.recipePoolFilesSingle, DatabaseManager.recipePoolFilesGlob]) {
        for (const [path, module] of Object.entries(source || {})) {
            try {
                const data = module.default || module;
                // Concatenate rather than replace, so recipes can be split
                // across files by topic without one file shadowing another.
                if (Array.isArray(data)) all.push(...data);
            } catch (error) {
                console.warn(`[RecipeRegistry] Error loading recipes from ${path}:`, error);
            }
        }
    }

    return all;
}

/** @type {object[]} */
const RECIPES = loadJsonRecipes();

/** One recipe by its stable id, or null. This is what P2's `selectedRecipeId` resolves through. */
export function getRecipe(recipeId) {
    return RECIPES.find(r => r.id === recipeId) || null;
}

/** Every recipe, in load order. */
export function listRecipes() {
    return RECIPES;
}

/**
 * Every recipe belonging to a skill. Always an array — an unknown skill is an
 * empty pool, not an error, so a station that opts into a pool nobody has
 * authored yet behaves like a station with no valid context: it makes nothing.
 */
export function getSkillRecipePool(skillId) {
    const pool = RECIPES.filter(r => r.skill === skillId);
    if (!FIXTURE_SKILLS.has(skillId)) return pool;
    return pool.filter(r => FIXTURE_RECIPE_IDS.has(r.id));
}

/** Every skill that has at least one recipe. */
export function listPooledSkillIds() {
    return [...new Set(RECIPES.map(r => r.skill))];
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

/**
 * The context tags a recipe needs beside it, as plain strings.
 *
 * `requiresContext` entries carry a tier and a charge cost as well as a tag;
 * callers that only ask "is this tag present?" go through here rather than
 * reaching for `.tag` in six places.
 */
export function contextTagsOf(recipe) {
    return (recipe?.requiresContext || []).map(c => c.tag);
}

/**
 * Skills a fixture has registered recipes for, and the ids of those recipes.
 *
 * A fixture registration **takes over** its skill: `getSkillRecipePool` then
 * returns the fixture's recipes alone and hides the shipped ones. This mirrors
 * the `fixture_*` filter the Token fixtures already rely on. Without it, a
 * fixture Kitchen pooling from `cooking` would draw all 17 shipped cooking
 * recipes as well, every one of them matching (they declare no context), and
 * the engine suites would resolve CONFLICT instead of the recipe under test.
 */
const FIXTURE_SKILLS = new Set();
const FIXTURE_RECIPE_IDS = new Set();

/**
 * Add recipes at runtime, keyed by skill. **Test fixtures only** — mirrors
 * `registerTokenTypes`. The skill-keyed argument is kept because that is how
 * fixtures read; each recipe gets the key stamped onto it as its `skill`.
 */
export function registerRecipePools(pools) {
    for (const [skillId, recipes] of Object.entries(pools || {})) {
        FIXTURE_SKILLS.add(skillId);
        for (const r of recipes) FIXTURE_RECIPE_IDS.add(r.id);
        RECIPES.push(...recipes.map(r => ({ skill: skillId, ...r })));
    }
}

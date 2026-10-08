// Fantasy Guild — Recipe registry

/**
 * Every recipe in the game, loaded from `data/tokenRecipes.json`.
 *
 * ## The file is a flat array and every recipe has an id
 * A station's chosen recipe is saved on the token instance as `selectedRecipeId`, and a position
 * would renumber the moment someone inserts a recipe in the CMS, silently repointing every saved
 * station. So `skill` is a field on the recipe and `id` is required; `getSkillRecipePool` is a
 * filter over one list.
 *
 * ## A recipe belongs to a skill
 * `skill` is a real skill id from `skillRegistry.js`. There are no subskills:
 * Smelting, Weaponsmithing, Toolsmithing and Jewelry are all `smithing`,
 * and Baking and Cooking are both `cooking`. A station draws every recipe of
 * its skill, so adding a Cooking recipe makes it available to every Cooking
 * station at once.
 *
 * ## A station's pool comes from its `Works as` statement
 * The skill named in the Token's Station statement is
 * the pool, and it is the same statement `deriveTokenType` reads — so a Token
 * cannot be typed a station while pooling nothing, or pool a skill while being
 * typed something else.
 *
 * ## Recipe shape
 * ```jsonc
 * [
 *   {
 *     "id": "recipe_copper_sword",
 *     "name": "Copper Sword",
 *     "skill": "smithing",
 *     "levelRequirement": 3,
 *     "durationMs": 10000,
 *     "xp": 12,
 *     "inputs":  [{ "itemId": "item_copper_ingot", "quantity": 2 }],
 *     "requiresContext": [{ "tag": "anvil", "minTier": 1, "chargeCost": 0 }],
 *     "stationChargeCost": 1,
 *     "outputs": [{ "itemId": "item_copper_sword", "chance": 100, "minQty": 1, "maxQty": 1 }]
 *   }
 * ]
 * ```
 *
 * ## An input names an item; only context keeps a tag
 * `inputs` entries are always `{ itemId, quantity }`. `requiresContext` **keeps** tag +
 * `minTier`, because that hierarchy is what lets a tier-2 tool satisfy a tier-1
 * requirement without relisting every qualifying Token.
 *
 * `requiresContext` entries are objects, not bare tag strings, so a recipe can
 * state a minimum tool tier and a per-cycle charge cost against the nearby
 * Token. The entry is deliberately shaped like an `acceptedTokens` entry plus
 * `chargeCost`, so `checkAcceptedTokens` in `RecipeResolver.js` compares both
 * with the same code.
 *
 * `stationChargeCost` is the charges the station itself spends per cycle,
 * a separate axis from context charge costs; `Charges.js` reads it.
 *
 * Nine EV fields (`targetEV`, `calculatedEV`, `autoBalance`, `fieldLocks`,
 * `profitSplit`, `liquidityEV`, `progressionEV`, `goldPerMinute`,
 * `xpPerMinute`) also sit flat on a recipe. Nothing in `src/` reads them; they
 * belong to the CMS balance engine and to the economic simulator.
 *
 * ⚠️ **Never hand-edit `data/tokenRecipes.json`.** The CMS writes it wholesale.
 */

import { DatabaseManager } from '../DatabaseManager.js';
import { stationSkillOf } from '../../systems/effects/statements.js';
import { foundationTierMeets } from './tokenConstants.js';

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

/** One recipe by its stable id, or null. This is what a station's `selectedRecipeId` resolves through. */
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
    return skillRecipes(skillId).filter(r => !buildsOnFoundation(r));
}

/**
 * Every recipe of a skill, ordinary and building alike, honouring the fixture
 * takeover below. The two public pools are filters over this.
 */
function skillRecipes(skillId) {
    const pool = RECIPES.filter(r => r.skill === skillId);
    if (!FIXTURE_SKILLS.has(skillId)) return pool;
    return pool.filter(r => FIXTURE_RECIPE_IDS.has(r.id));
}

/**
 * Whether a recipe builds on a Foundation: it carries a non-empty `foundationKinds`. Such a recipe belongs to the
 * Foundation pool only and never appears on an ordinary station.
 */
export function buildsOnFoundation(recipe) {
    return Array.isArray(recipe?.foundationKinds) && recipe.foundationKinds.length > 0;
}

/**
 * A Foundation's recipe pool: the recipes of its `foundation.skill` whose `foundationKinds` include
 * its `foundation.kind` and whose `foundationMinTier` its tier reaches. A Token without a
 * `foundation` block has none.
 *
 * The tier is gated here, in the pool, so the picker never offers a recipe above the Foundation's
 * tier and `StationRecipe` refuses or drops one (an old save's choice) the same way it does a
 * recipe from another skill.
 */
export function recipesForFoundation(def) {
    const { kind, skill } = def?.foundation || {};
    if (!kind || !skill) return [];
    return skillRecipes(skill).filter(r =>
        buildsOnFoundation(r) && r.foundationKinds.includes(kind) && foundationTierMeets(def, r));
}

/** Every skill that has at least one recipe. */
export function listPooledSkillIds() {
    return [...new Set(RECIPES.map(r => r.skill))];
}

/**
 * The recipes a Token can actually attempt: its `Works as` skill's pool, or,
 * for a Token with a `foundation` block, its Foundation pool. The
 * Foundation block wins: a Foundation's pool is the building recipes of its
 * skill, never that skill's ordinary ones.
 *
 * A Token with neither has no recipes — a Forest is not a station.
 */
export function recipesForToken(def) {
    if (def?.foundation) return recipesForFoundation(def);
    const skill = stationSkillOf(def);
    return skill ? getSkillRecipePool(skill) : [];
}

/**
 * A recipe's `requiresContext`, every entry as `{ tag, minTier, chargeCost }`.
 *
 * ⚠️ **The one reader of `requiresContext`.** The CMS writes a bare tag string
 * (`["anvil"]`) until the author picks a tier, and a reader that reached for
 * `.tag` / `.tag.split` on that crashed the whole game screen. A
 * bare string is read as that tag at tier 1 costing no charges; an entry with
 * no tag at all (null, `{}`, `""`) is dropped. Every engine and UI reader goes
 * through here rather than touching the raw list.
 */
export function contextRequirementsOf(recipe) {
    const raw = recipe?.requiresContext;
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const entry of raw) {
        if (typeof entry === 'string') {
            if (entry) out.push({ tag: entry, minTier: 1, chargeCost: 0 });
        } else if (entry && typeof entry === 'object' && typeof entry.tag === 'string' && entry.tag) {
            out.push({ ...entry, minTier: entry.minTier || 1, chargeCost: entry.chargeCost || 0 });
        }
    }
    return out;
}

/**
 * The context tags a recipe needs beside it, as plain strings.
 *
 * Callers that only ask "is this tag present?" go through here rather than
 * reaching for `.tag` in six places.
 */
export function contextTagsOf(recipe) {
    return contextRequirementsOf(recipe).map(c => c.tag);
}

/**
 * Skills a fixture has registered recipes for, and the ids of those recipes.
 *
 * A fixture registration **takes over** its skill: `getSkillRecipePool` then
 * returns the fixture's recipes alone and hides the shipped ones. This mirrors
 * the `fixture_*` filter the Token fixtures already rely on. Without it, a
 * fixture Kitchen pooling from `cooking` would draw every shipped cooking
 * recipes as well, every one of them matching (they declare no context), and
 * the engine suites would run a shipped recipe instead of the one under test.
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

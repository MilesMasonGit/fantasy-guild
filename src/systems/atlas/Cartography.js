// writing a Region from recipes: the preview, reroll, and a Region's board

import { GameState } from '../../state/GameState.js';
import { tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import * as BoardState from '../board/BoardState.js';
import { matCap } from '../board/MatCap.js';
import { budget } from './Budget.js';
import { layout } from './Layout.js';
import { layoutOptions } from './layoutInputs.js';
import { nextSeed, seedFromText } from './seededRandom.js';

/**
 * Writing a Region from recipes (`Budget.js`'s shape), up to the moment `Atlas.settle` makes it real:
 * - {@link recipeOf}: an ingredient checked to be a recipe;
 * - {@link preview} and {@link reroll}: the Node Summary and the layout a seed gives;
 * - {@link regionBoard} and {@link rulesOf}: what a settled Region is made of.
 *
 * The world map's settling writes its Regions through here, and so do the dev tools. Nothing here
 * draws from `Math.random`: the seed comes from the caller or the guild's own ({@link previewSeed}).
 */

const RECIPE_KINDS = Object.freeze(['base', 'modifier']);

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Whether `value` is a recipe in `Budget.js`'s shape: an id and a kind it knows. */
export function isRecipe(value) {
    return isPlainObject(value) && typeof value.id === 'string' && value.id !== ''
        && RECIPE_KINDS.includes(value.kind);
}

function described(item) {
    if (typeof item === 'string') return `"${item}"`;
    if (isPlainObject(item)) return `an object with id ${JSON.stringify(item.id)} and kind ${JSON.stringify(item.kind)}`;
    return String(item);
}

/**
 * The ingredient as a recipe: a recipe comes back as it is. Map items are retired: the world map
 * settles places instead, so an item id is refused like anything else.
 *
 * @throws {TypeError} for anything that is not a recipe
 */
export function recipeOf(item) {
    if (isRecipe(item)) return item;
    throw new TypeError(`Atlas.recipeOf: ${described(item)} is not a map recipe `
        + '(a recipe is { id, kind: "base" | "modifier", ... }, see Budget.js)');
}

// ---------------------------------------------------------------------------
// The preview
// ---------------------------------------------------------------------------

/** Where the guild seed starts when the game has no creation stamp (a hand-built state). */
const FIRST_SEED_TEXT = 'guild';

const isSeed = (n) => Number.isInteger(n) && n >= 0 && n <= 0xFFFFFFFF;

/**
 * A fresh preview seed: the guild seed (`state.atlas.seed`) stepped by `nextSeed`, and kept. It
 * starts from the game's creation stamp, so two guilds see different layouts while a run of
 * previews replays exactly.
 */
export function previewSeed() {
    const state = GameState.state;
    const atlas = isPlainObject(state?.atlas) ? state.atlas : null;
    if (!atlas) return nextSeed(seedFromText(FIRST_SEED_TEXT));
    if (!isSeed(atlas.seed)) atlas.seed = seedFromText(String(state.meta?.createdAt ?? FIRST_SEED_TEXT));
    atlas.seed = nextSeed(atlas.seed);
    return atlas.seed;
}

function planOf(recipes, summary, seed) {
    const result = layout(summary, layoutOptions(summary, seed));
    return {
        seed: result.seed,
        recipes,
        ingredients: recipes.map(r => r.id),
        summary,
        layout: result,
        fits: result.unplaced.length === 0
    };
}

/**
 * What these ingredients would write: the Node Summary (`Budget.budget` under today's Token cap,
 * `MatCap.matCap()`) and its layout. Changes nothing but the guild seed, and that only when no
 * `seed` is given.
 *
 * @param {object[]} ingredients  the slots' ingredients, through {@link recipeOf}
 * @param {{seed?: number}} [options]  a seed to lay out with; else a fresh {@link previewSeed}
 * @returns {{seed: number, recipes: object[], ingredients: string[], summary: object,
 *   layout: object, fits: boolean}} `fits` is false when a Token found no legal spot
 *   (`layout.unplaced`): Settle refuses that layout, and a reroll may find room.
 */
export function preview(ingredients, { seed } = {}) {
    const recipes = (Array.isArray(ingredients) ? ingredients : []).map(recipeOf);
    const summary = budget(recipes, { cap: matCap() });
    return planOf(recipes, summary, Number.isFinite(seed) ? seed >>> 0 : previewSeed());
}

/**
 * The next layout of a preview: the seed after its seed, and the same Node Summary (the very
 * object; a reroll never re-reads the cap or the ingredients). Changes nothing but the guild seed,
 * which moves on to the seed shown: the next preview then starts past every layout already shown,
 * so a Region settled after a reroll never shares its seed (or its flavour name) with the next.
 *
 * @param {object} plan  a {@link preview} or an earlier reroll
 */
export function reroll(plan) {
    if (!isPlainObject(plan) || !isPlainObject(plan.summary) || !Array.isArray(plan.recipes) || !isSeed(plan.seed)) {
        throw new TypeError('Atlas.reroll takes a preview: the result of Atlas.preview or of an earlier reroll');
    }
    const seed = nextSeed(plan.seed);
    const atlas = GameState.state?.atlas;
    if (isPlainObject(atlas)) atlas.seed = seed;
    return planOf(plan.recipes, plan.summary, seed);
}

// ---------------------------------------------------------------------------
// What a settled Region is made of
// ---------------------------------------------------------------------------

/** A settled node's instance id: named after its Region, so no two Regions share one. */
export function fixtureId(regionId, index) {
    return `tok_${regionId}_${index}`;
}

/**
 * A settled layout as its Region's board, built off the mat: each node a `placed` instance with
 * the map's mark (`fixture`), its biome and its starting charges, in layout order. The Hall is not
 * on it: it travels with the guild and lands in the clearing at the mat's centre.
 */
export function regionBoard(result, regionId) {
    return BoardState.detachedBoard((result?.nodes || []).map((node, i) => {
        const instance = BoardState.createTokenInstance(
            node.typeId, tokenStartingUses(node.typeId), null, BoardState.ORIGIN.PLACED, fixtureId(regionId, i)
        );
        instance.fixture = true;
        if (node.biome) instance.biome = node.biome;
        return { instance, x: node.x, y: node.y };
    }));
}

/** Every Region-wide rule the recipes carry, copied, in slot order. */
export function rulesOf(recipes) {
    const rules = [];
    for (const recipe of recipes || []) {
        for (const rule of Array.isArray(recipe?.rules) ? recipe.rules : []) {
            if (isPlainObject(rule)) rules.push(JSON.parse(JSON.stringify(rule)));
        }
    }
    return rules;
}

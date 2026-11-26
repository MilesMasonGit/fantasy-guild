// a station's second recipe (Many Hands): who opens it, and whether it runs now

import { EFFECT_TYPES } from '../effects/constants.js';
import * as TileModifiers from './TileModifiers.js';
import * as BoardState from './BoardState.js';
import { takesSecondRecipe, workConfigOf } from './StationRecipe.js';

/**
 * Many Hands (Crafting 99) is the Second Recipe effect, on or off: a making station worked by a hero
 * holding it runs a second recipe beside the first (`StationRecipe.setSecondRecipe`), each with its
 * own cycle and materials (`BoardRunner`'s second lane). Owner rulings, 2026-11-25:
 *
 * - It runs only while the hero working that station holds it: their gear, perks, what lingers on
 *   them, a Summoned worker's trait, or a Guild Hall star (`TileModifiers.resolveHeroAxis`). Another
 *   hero in the guild holding it, or a Token in reach carrying it, opens nothing.
 * - Only a station that takes a second recipe (`StationRecipe.takesSecondRecipe`), and only where
 *   the effect's narrowing reaches the station's skill (the perk's is Crafting).
 * - The second recipe is always a different recipe from the first. The hero claims the station for
 *   the first; the second rides along.
 *
 * Read only: nothing here draws or writes.
 */

/**
 * Whether `heroId`, working Token `instanceId` (whose work skill is `skill`), holds Second Recipe
 * there. With no `heroId`, whoever works it.
 */
export function holdsSecondRecipe(instanceId, skill, heroId = undefined) {
    return TileModifiers.resolveHeroAxis(instanceId, EFFECT_TYPES.SECOND_RECIPE, 0, skill, heroId) > 0;
}

/**
 * Whether station `instance` of type `def` has its second lane open with `heroId` working it: it
 * takes a second recipe and the hero holds the effect for its skill. Asked whether or not a second
 * recipe is set (the card's picker shows on it).
 */
export function isOpen(instance, def, heroId) {
    if (!heroId || !takesSecondRecipe(def)) return false;
    return holdsSecondRecipe(instance.id, workConfigOf(def, instance)?.skill, heroId);
}

/**
 * Whether station `instance`'s second recipe runs this tick with `heroId` working it: one is set, it
 * differs from the first, and the lane is open ({@link isOpen}).
 */
export function runsSecond(instance, def, heroId) {
    const id = instance?.secondRecipeId;
    if (!id || id === instance.selectedRecipeId) return false;
    return isOpen(instance, def, heroId);
}

/** {@link isOpen} for the hero working the station now: the card's question. */
export function isOpenNow(instance, def) {
    return !!instance && isOpen(instance, def, BoardState.workerOf(instance.id));
}

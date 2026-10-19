/**
 * Which recipes a level-up unlocks for the guild: those of the skill whose level requirement the
 * hero has just reached, and that nobody else in the guild could run already. Every recipe of the
 * skill counts, a station the player does not own yet included.
 *
 * Derived, never stored: a recipe is "new" exactly when the guild's best level in its skill
 * crosses its requirement.
 */

/** A recipe's level requirement (a recipe with none needs level 0). */
const levelOf = (recipe) => (typeof recipe?.levelRequirement === 'number' ? recipe.levelRequirement : 0);

/**
 * @param {object[]} recipes every recipe in the game
 * @param {{skillId: string, oldLevel: number, newLevel: number, othersBest?: number}} levelUp
 *   `othersBest` is the highest level anyone else in the guild holds in the skill
 * @returns {object[]} the recipes unlocked, lowest level first, ties in list order
 */
export function recipesUnlockedBy(recipes, { skillId, oldLevel, newLevel, othersBest = 0 }) {
    if (!skillId || !(newLevel > oldLevel)) return [];
    const floor = Math.max(oldLevel, othersBest);
    if (newLevel <= floor) return [];
    return (recipes || [])
        .map((recipe, order) => ({ recipe, order, level: levelOf(recipe) }))
        .filter(({ recipe, level }) => recipe?.skill === skillId && level > floor && level <= newLevel)
        .sort((a, b) => (a.level - b.level) || (a.order - b.order))
        .map(({ recipe }) => recipe);
}

/** The best level anyone but `heroId` holds in a skill. */
export function othersBestLevel(heroes, heroId, skillId) {
    let best = 0;
    for (const hero of heroes || []) {
        if (!hero || hero.id === heroId) continue;
        const level = hero.skills?.[skillId]?.level ?? 0;
        if (level > best) best = level;
    }
    return best;
}

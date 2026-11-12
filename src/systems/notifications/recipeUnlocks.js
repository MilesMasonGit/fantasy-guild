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

/**
 * The recipes a Guild Hall gift (`XP_FOR_EVERYONE_GIVEN`) unlocked for the guild, a row a hero:
 * `[{ heroId, recipes }]`, heroes it unlocked nothing for left out. Every hero rose at once and
 * `heroes` are read after it, so the guild's best before the gift is each hero's old level where the
 * gift raised it and their level now where it did not.
 *
 * @param {object[]} recipes every recipe in the game
 * @param {object[]} heroes the guild's heroes, after the gift
 * @param {Array<{heroId: string, levelUps: Array<{skillId: string, oldLevel: number, newLevel: number}>}>} rows
 */
export function recipesUnlockedByGift(recipes, heroes, rows) {
    const oldLevel = new Map();
    for (const row of rows || []) {
        for (const l of row?.levelUps || []) oldLevel.set(`${row.heroId}|${l.skillId}`, Number(l.oldLevel) || 0);
    }
    const bestBefore = (skillId) => {
        let best = 0;
        for (const hero of heroes || []) {
            const level = oldLevel.get(`${hero?.id}|${skillId}`) ?? hero?.skills?.[skillId]?.level ?? 0;
            if (level > best) best = level;
        }
        return best;
    };
    const out = [];
    for (const row of rows || []) {
        const found = [];
        for (const l of row?.levelUps || []) {
            const unlocked = recipesUnlockedBy(recipes, {
                skillId: l.skillId, oldLevel: Number(l.oldLevel) || 0, newLevel: Number(l.newLevel) || 0, othersBest: bestBefore(l.skillId)
            });
            for (const recipe of unlocked) if (!found.includes(recipe)) found.push(recipe);
        }
        if (found.length) out.push({ heroId: row.heroId, recipes: found });
    }
    return out;
}

/**
 * The recipes a `HERO_LEVELED` event unlocks for the guild: the one reading the live banner and
 * the catch-up news both make. `heroes` are the guild's, for the others' best level.
 */
export function recipesUnlockedByLevelUp(recipes, heroes, { heroId, skillId, oldLevel, newLevel } = {}) {
    return recipesUnlockedBy(recipes, {
        skillId,
        oldLevel: Number(oldLevel) || 0,
        newLevel: Number(newLevel) || 0,
        othersBest: othersBestLevel(heroes, heroId, skillId)
    });
}

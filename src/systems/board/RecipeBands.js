// recipe modal banding

import { poolFor, recipeLevel } from './StationRecipe.js';
import { stationSkillOf } from '../effects/statements.js';
import * as SkillSystem from '../hero/SkillSystem.js';

/**
 * Which of the recipe modal's three bands a recipe falls into.
 *
 * Bands key on skill level and nothing else: whether the station holds the inputs or has the
 * context Token is not computed here, since that already reaches the player as an alert on the
 * tile. A band answers one question: who in the guild is skilled enough to run it.
 *
 * Only `LOCKED` is disabled in the modal. A `GUILD` recipe names a level no one at the station has
 * but someone in the roster does, so it gets a hint, not a lock. A station with no worker has
 * worker level 0, so its pool sits in `GUILD` or `LOCKED` rather than being unreachable.
 */
export const BAND = {
    /** At or below the assigned worker's level in the station's skill. */
    WORKER: 'worker',
    /** Above the worker, but within the best level anyone in the roster holds. */
    GUILD: 'guild',
    /** Above the entire roster. */
    LOCKED: 'locked'
};

/** The assigned worker's level in a skill; 0 for no worker, or one lacking it. */
export function workerLevelFor(heroId, skillId) {
    if (!heroId || !skillId) return 0;
    return SkillSystem.getSkillLevel(heroId, skillId) ?? 0;
}

/** The highest level any hero in the roster holds in a skill; 0 if none do. */
export function guildLevelFor(heroes, skillId) {
    if (!skillId) return 0;
    let best = 0;
    for (const hero of heroes || []) {
        const level = SkillSystem.getSkillLevel(hero?.id, skillId) ?? 0;
        if (level > best) best = level;
    }
    return best;
}

/** Band a single level against the two thresholds. */
export function bandForLevel(level, workerLevel, guildLevel) {
    if (level <= workerLevel) return BAND.WORKER;
    if (level <= guildLevel) return BAND.GUILD;
    return BAND.LOCKED;
}

/**
 * The banded, level-ordered rows the modal renders for one station instance. Ties on
 * `levelRequirement` keep pool order, so the list is stable between openings.
 *
 * @returns {{skill: string|null, workerLevel: number, guildLevel: number, rows: object[]}}
 */
export function bandStationRecipes(def, heroId, heroes) {
    // A Foundation's pool is its `foundation.skill`: Construction, or Farming for farmland. It has
    // no `Works as` statement.
    const skill = def?.foundation?.skill || stationSkillOf(def);
    const workerLevel = workerLevelFor(heroId, skill);
    const guildLevel = Math.max(workerLevel, guildLevelFor(heroes, skill));

    const rows = poolFor(def)
        .map((recipe, order) => ({ recipe, order, level: recipeLevel(recipe) }))
        .sort((a, b) => (a.level - b.level) || (a.order - b.order))
        .map(({ recipe, level }) => ({
            recipe,
            level,
            band: bandForLevel(level, workerLevel, guildLevel),
            selectable: bandForLevel(level, workerLevel, guildLevel) !== BAND.LOCKED
        }));

    return { skill, workerLevel, guildLevel, rows };
}

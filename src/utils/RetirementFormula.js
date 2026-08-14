// Fantasy Guild - Retirement Formula
// Calculates Influence reward for retiring a hero

/**
 * Exponential curve for retirement Influence reward
 * 
 * The formula rewards investing time into heroes:
 * - Level 6 → 12 Influence
 * - Level 10 → 16 Influence
 * - Level 25 → 129 Influence
 * - Level 50 → 466 Influence
 * 
 * @param {number} heroLevel - The hero's current level
 * @returns {number} Influence reward (floored)
 */
export function calculateRetirementInfluence(heroLevel) {
    if (heroLevel <= 0) return 0;
    return Math.floor(heroLevel * (1 + heroLevel / 6));
}

/**
 * Preview what a hero would return on retirement
 *
 * ⚠️ **This used to divide by a hardcoded 11** — the number of non-combat
 * skills in the old 15-skill system. A hero now holds 6 skills, so that
 * constant quietly cut every payout by nearly half and made retirement
 * impossible: 6 skills at level 5 scored `30 / 11 = 2`, under the recruit cost,
 * so the game refused to retire anyone.
 *
 * It now averages the skills the hero **actually holds**, which is the same
 * definition `calculateHeroLevel` uses and survives any future change to how
 * many skills a hero carries.
 *
 * @param {Object} hero - Hero object with skills
 * @returns {number} Influence amount
 */
export function previewRetirementInfluence(hero) {
    if (!hero || !hero.skills) return 0;

    const held = Object.values(hero.skills);
    if (held.length === 0) return 0;

    const totalSkillLevels = held.reduce((sum, skill) => sum + (skill.level || 1), 0);
    const heroLevel = Math.floor(totalSkillLevels / held.length);

    return calculateRetirementInfluence(heroLevel);
}

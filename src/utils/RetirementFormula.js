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
 * @param {Object} hero - Hero object with skills
 * @returns {number} Influence amount
 */
export function previewRetirementInfluence(hero) {
    if (!hero || !hero.skills) return 0;

    // Calculate hero level (total skill levels / 11)
    const totalSkillLevels = Object.values(hero.skills).reduce(
        (sum, skill) => sum + (skill.level || 1),
        0
    );
    const heroLevel = Math.floor(totalSkillLevels / 11);

    return calculateRetirementInfluence(heroLevel);
}

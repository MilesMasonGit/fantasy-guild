/**
 * EnemyTraitRegistry - Definitions for unique enemy characteristics
 */

export const ENEMY_TRAITS = {
    thorns: {
        id: 'thorns',
        name: 'Thorns',
        icon: '🌵',
        type: 'negative', // Relative to player
        getDescription: (level) => `Reflects ${level} damage back to the attacker on every hit.`
    }
};

/**
 * Get trait definition by ID
 * @param {string} id 
 * @returns {Object|null}
 */
export function getEnemyTrait(id) {
    return ENEMY_TRAITS[id] || null;
}

/**
 * Convert number to Roman Numeral for level display
 * @param {number} num 
 * @returns {string}
 */
export function toRoman(num) {
    const map = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
    let result = '';
    for (const key in map) {
        const repeat = Math.floor(num / map[key]);
        if (repeat <= 0) continue;
        result += key.repeat(repeat);
        num %= map[key];
    }
    return result;
}

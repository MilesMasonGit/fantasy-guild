// Fantasy Guild - Class Registry
// Phase 6: Hero Registries

/**
 * ClassRegistry - Defines all 9 hero classes
 * 
 * Each class grants:
 * - +10 Starting Levels to 3 skills
 * - +10% XP Gain to those same skills
 */

export const CLASSES = {
    fighter: {
        id: 'fighter',
        name: 'Fighter',
        description: 'A master of close combat and physical endurance.',
        combatStyle: 'melee',
        bonusSkills: ['melee', 'industry', 'nature'],
        icon: '⚔️',
        color: '#e53e3e'  // Red
    },
    ranger: {
        id: 'ranger',
        name: 'Ranger',
        description: 'A skilled hunter and tracker at home in the wild.',
        combatStyle: 'ranged',
        bonusSkills: ['ranged', 'nature', 'nautical'],
        icon: '🏹',
        color: '#38a169'  // Green
    },
    wizard: {
        id: 'wizard',
        name: 'Wizard',
        description: 'A scholar of arcane arts and mystical knowledge.',
        combatStyle: 'magic',
        bonusSkills: ['magic', 'occult', 'science'],
        icon: '🧙',
        color: '#805ad5'  // Purple
    },
    rogue: {
        id: 'rogue',
        name: 'Rogue',
        description: 'A cunning opportunist skilled in stealth and deception.',
        combatStyle: 'ranged',
        bonusSkills: ['ranged', 'crime', 'social'],
        icon: '🗡️',
        color: '#4a5568'  // Gray
    },
    paladin: {
        id: 'paladin',
        name: 'Paladin',
        description: 'A holy warrior devoted to justice and protection.',
        combatStyle: 'melee',
        bonusSkills: ['melee', 'occult', 'social'],
        icon: '🛡️',
        color: '#d69e2e'  // Gold
    },
    cleric: {
        id: 'cleric',
        name: 'Cleric',
        description: 'A divine servant with healing and protective powers.',
        combatStyle: 'magic',
        bonusSkills: ['magic', 'nature', 'culinary'],
        icon: '✝️',
        color: '#ecc94b'  // Yellow
    },
    bard: {
        id: 'bard',
        name: 'Bard',
        description: 'A charismatic performer with varied talents.',
        combatStyle: 'magic',
        bonusSkills: ['magic', 'social', 'crime'],
        icon: '🎵',
        color: '#ed64a6'  // Pink
    },
    alchemist: {
        id: 'alchemist',
        name: 'Alchemist',
        description: 'A master of potions, elixirs, and transmutation.',
        combatStyle: 'magic',
        bonusSkills: ['magic', 'science', 'culinary'],
        icon: '⚗️',
        color: '#48bb78'  // Teal
    },
    engineer: {
        id: 'engineer',
        name: 'Engineer',
        description: 'A brilliant inventor and mechanical genius.',
        combatStyle: 'ranged',
        bonusSkills: ['ranged', 'science', 'industry'],
        icon: '⚙️',
        color: '#4299e1'  // Blue
    }
};

/**
 * Starting level bonus from class
 */
export const CLASS_SKILL_BONUS = 10;

/**
 * XP gain bonus percentage from class
 */
export const CLASS_XP_BONUS = 0.10;  // 10%

/**
 * Get all class IDs as an array
 * @returns {string[]}
 */
export function getAllClassIds() {
    return Object.keys(CLASSES);
}

/**
 * Get class by ID
 * @param {string} classId 
 * @returns {Object|null}
 */
export function getClass(classId) {
    return CLASSES[classId] || null;
}

/**
 * Check if a class grants bonus to a skill
 * @param {string} classId 
 * @param {string} skillId 
 * @returns {boolean}
 */
export function classHasSkill(classId, skillId) {
    const cls = CLASSES[classId];
    return cls ? cls.bonusSkills.includes(skillId) : false;
}

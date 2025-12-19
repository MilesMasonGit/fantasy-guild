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
        bonusSkills: ['melee', 'defence', 'industry'],
        icon: '⚔️',
        color: '#e53e3e'  // Red
    },
    ranger: {
        id: 'ranger',
        name: 'Ranger',
        description: 'A skilled hunter and tracker at home in the wild.',
        bonusSkills: ['ranged', 'nature', 'crime'],
        icon: '🏹',
        color: '#38a169'  // Green
    },
    wizard: {
        id: 'wizard',
        name: 'Wizard',
        description: 'A scholar of arcane arts and mystical knowledge.',
        bonusSkills: ['magic', 'occult', 'science'],
        icon: '🧙',
        color: '#805ad5'  // Purple
    },
    rogue: {
        id: 'rogue',
        name: 'Rogue',
        description: 'A cunning opportunist skilled in stealth and deception.',
        bonusSkills: ['crime', 'ranged', 'crafting'],
        icon: '🗡️',
        color: '#4a5568'  // Gray
    },
    paladin: {
        id: 'paladin',
        name: 'Paladin',
        description: 'A holy warrior devoted to justice and protection.',
        bonusSkills: ['melee', 'defence', 'occult'],
        icon: '🛡️',
        color: '#d69e2e'  // Gold
    },
    cleric: {
        id: 'cleric',
        name: 'Cleric',
        description: 'A divine servant with healing and protective powers.',
        bonusSkills: ['magic', 'culinary', 'nature'],
        icon: '✝️',
        color: '#ecc94b'  // Yellow
    },
    bard: {
        id: 'bard',
        name: 'Bard',
        description: 'A charismatic performer with varied talents.',
        bonusSkills: ['magic', 'crime', 'culinary'],
        icon: '🎵',
        color: '#ed64a6'  // Pink
    },
    alchemist: {
        id: 'alchemist',
        name: 'Alchemist',
        description: 'A master of potions, elixirs, and transmutation.',
        bonusSkills: ['science', 'culinary', 'nature'],
        icon: '⚗️',
        color: '#48bb78'  // Teal
    },
    engineer: {
        id: 'engineer',
        name: 'Engineer',
        description: 'A brilliant inventor and mechanical genius.',
        bonusSkills: ['science', 'crafting', 'industry'],
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

// Fantasy Guild - Skill Registry
// Phase 6: Hero Registries

/**
 * SkillRegistry - Defines all 11 skills
 * 
 * Skills are divided into 4 categories:
 * - Combat: Melee, Ranged, Magic, Defence
 * - Gathering: Industry, Nature, Nautical
 * - Production: Crafting, Culinary
 * - Special: Crime, Occult, Science
 */

export const SKILLS = {
    // === Combat Skills ===
    melee: {
        id: 'melee',
        name: 'Melee',
        category: 'combat',
        description: 'Close-range combat with swords, axes, and hammers.',
        icon: '⚔️'
    },
    ranged: {
        id: 'ranged',
        name: 'Ranged',
        category: 'combat',
        description: 'Long-range combat with bows, crossbows, and thrown weapons.',
        icon: '🏹'
    },
    magic: {
        id: 'magic',
        name: 'Magic',
        category: 'combat',
        description: 'Arcane combat with spells and enchantments.',
        icon: '✨'
    },
    defence: {
        id: 'defence',
        name: 'Defence',
        category: 'combat',
        description: 'Blocking, dodging, and damage reduction.',
        icon: '🛡️'
    },

    // === Gathering Skills ===
    industry: {
        id: 'industry',
        name: 'Industry',
        category: 'gathering',
        description: 'Mining, woodcutting, and resource extraction.',
        icon: '⛏️'
    },
    nature: {
        id: 'nature',
        name: 'Nature',
        category: 'gathering',
        description: 'Herbalism, foraging, and animal husbandry.',
        icon: '🌿'
    },
    nautical: {
        id: 'nautical',
        name: 'Nautical',
        category: 'gathering',
        description: 'Fishing, sailing, and water-related tasks.',
        icon: '🎣'
    },

    // === Production Skills ===
    crafting: {
        id: 'crafting',
        name: 'Crafting',
        category: 'production',
        description: 'Smithing, tailoring, and item creation.',
        icon: '🔨'
    },
    culinary: {
        id: 'culinary',
        name: 'Culinary',
        category: 'production',
        description: 'Cooking, brewing, and food preparation.',
        icon: '🍳'
    },

    // === Special Skills ===
    crime: {
        id: 'crime',
        name: 'Crime',
        category: 'special',
        description: 'Thievery, lockpicking, and stealth.',
        icon: '🗝️'
    },
    occult: {
        id: 'occult',
        name: 'Occult',
        category: 'special',
        description: 'Dark magic, rituals, and forbidden knowledge.',
        icon: '🔮'
    },
    science: {
        id: 'science',
        name: 'Science',
        category: 'special',
        description: 'Alchemy, engineering, and invention.',
        icon: '⚗️'
    }
};

/**
 * Skill categories for grouping in UI
 */
export const SKILL_CATEGORIES = {
    combat: {
        id: 'combat',
        name: 'Combat',
        skills: ['melee', 'ranged', 'magic', 'defence']
    },
    gathering: {
        id: 'gathering',
        name: 'Gathering',
        skills: ['industry', 'nature', 'nautical']
    },
    production: {
        id: 'production',
        name: 'Production',
        skills: ['crafting', 'culinary']
    },
    special: {
        id: 'special',
        name: 'Special',
        skills: ['crime', 'occult', 'science']
    }
};

/**
 * Total number of skills (for Hero Level calculation)
 */
export const SKILL_COUNT = Object.keys(SKILLS).length; // 11

/**
 * Get all skill IDs as an array
 * @returns {string[]}
 */
export function getAllSkillIds() {
    return Object.keys(SKILLS);
}

/**
 * Get skill by ID
 * @param {string} skillId 
 * @returns {Object|null}
 */
export function getSkill(skillId) {
    return SKILLS[skillId] || null;
}

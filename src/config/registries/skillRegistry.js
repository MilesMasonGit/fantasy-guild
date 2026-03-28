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
    // === Combat Skills (Unified Specialization) ===
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

    // === Non-Combat Parent Skills (8 Total) ===
    industry: {
        id: 'industry',
        name: 'Industry',
        category: 'gathering',
        description: 'Mining, crafting, and resource processing.',
        icon: '⛏️'
    },
    nature: {
        id: 'nature',
        name: 'Nature',
        category: 'gathering',
        description: 'Herbalism, foraging, and animal handling.',
        icon: '🌿'
    },
    nautical: {
        id: 'nautical',
        name: 'Nautical',
        category: 'gathering',
        description: 'Fishing, sailing, and aquatic expertise.',
        icon: '🎣'
    },
    culinary: {
        id: 'culinary',
        name: 'Culinary',
        category: 'production',
        description: 'Cooking, brewing, and food preparation.',
        icon: '🍳'
    },
    social: {
        id: 'social',
        name: 'Social',
        category: 'production',
        description: 'Negotiation, leadership, and propaganda.',
        icon: '🗣️'
    },
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
        description: 'Rituals, summoning, and forbidden knowledge.',
        icon: '🔮'
    },
    science: {
        id: 'science',
        name: 'Science',
        category: 'special',
        description: 'Alchemy, engineering, and medicine.',
        icon: '⚗️'
    }
};

/**
 * SUB_SKILL_TO_PARENT - Mapping for resolving XP flow.
 * Sub-skills are strictly tags used for targeting modifiers, 
 * but their progress funnels 100% into the parent skill.
 */
export const SUB_SKILL_TO_PARENT = {
    // Industry
    mining: 'industry',
    logging: 'industry',
    smelting: 'industry',
    smithing: 'industry',
    crafting: 'industry',
    
    // Nature
    foraging: 'nature',
    herbalism: 'nature',
    hunting: 'nature',
    harvesting: 'nature',

    // Nautical
    fishing: 'nautical',
    sailing: 'nautical',
    swimming: 'nautical',

    // Culinary
    cooking: 'culinary',
    brewing: 'culinary',
    butchery: 'culinary',

    // Social
    bartering: 'social',
    recruitment: 'social',
    propaganda: 'social',
    diplomacy: 'social',

    // Crime
    pickpocketing: 'crime',
    lockpicking: 'crime',
    stealth: 'crime',

    // Occult
    rituals: 'occult',
    summoning: 'occult',
    enchanting: 'occult',

    // Science
    engineering: 'science',
    alchemy: 'science',
    medicine: 'science'
};

/**
 * Skill categories for grouping in UI
 */
export const SKILL_CATEGORIES = {
    combat: {
        id: 'combat',
        name: 'Combat',
        skills: ['melee', 'ranged', 'magic']
    },
    gathering: {
        id: 'gathering',
        name: 'Gathering',
        skills: ['industry', 'nature', 'nautical']
    },
    production: {
        id: 'production',
        name: 'Production',
        skills: ['culinary', 'social']
    },
    special: {
        id: 'special',
        name: 'Special',
        skills: ['crime', 'occult', 'science']
    }
};

/**
 * Total number of parent skills (for Hero Level calculation)
 */
export const SKILL_COUNT = Object.keys(SKILLS).length; // 11 -> 11? Wait.
// 3 combat + 8 non-combat = 11. 
// BUT a hero ONLY has ONE combat specialization. 
// So for a specific hero, they have 1 + 8 = 9 skills.
// The user said: "Sum of 9 Parent skills / 9".
// So SKILL_COUNT should probably be 9 for the Hero Level formula, 
// even though the registry contains 3 combat options.
export const HERO_TOTAL_SKILLS = 9; 

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
    if (SKILLS[skillId]) return SKILLS[skillId];

    // RESOLVE SUB-SKILL: Return parent definition but with sub-skill name
    const parentId = SUB_SKILL_TO_PARENT[skillId];
    if (parentId && SKILLS[parentId]) {
        return {
            ...SKILLS[parentId],
            id: skillId,
            name: skillId.charAt(0).toUpperCase() + skillId.slice(1),
            parentSkillId: parentId,
            isSubSkill: true
        };
    }

    return null;
}

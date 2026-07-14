// Fantasy Guild - Skill Registry
// 15-Skill System (see skill_mapping_concept.md — the authoritative skill list)

/**
 * SkillRegistry - Defines all 15 skills
 *
 * Skills are divided into 4 categories:
 * - Combat: Melee, Ranged, Magic, Defense (every hero has all 4;
 *   the equipped weapon decides which one a fight uses)
 * - Gathering: Labor, Aquatic, Nature
 * - Processing: Forge, Cooking, Alchemy, Science
 * - Special: Occult, Crime, Explore, Social
 *
 * Every hero has all 15 skills; each levels independently.
 */

export const SKILLS = {
    // === Combat Skills (4) ===
    melee: {
        id: 'melee',
        name: 'Melee',
        category: 'combat',
        description: 'Close-quarters combat with swords, axes, and hammers.',
        icon: '⚔️'
    },
    ranged: {
        id: 'ranged',
        name: 'Ranged',
        category: 'combat',
        description: 'Combat from a distance with bows, crossbows, and thrown weapons.',
        icon: '🏹'
    },
    magic: {
        id: 'magic',
        name: 'Magic',
        category: 'combat',
        description: 'Spellcasting and elemental attacks with staves, wands, and tomes.',
        icon: '✨'
    },
    defense: {
        id: 'defense',
        name: 'Defense',
        category: 'combat',
        description: 'Physical fortitude and mastery of armor and blocking.',
        icon: '🛡️'
    },

    // === Gathering Skills (3) ===
    labor: {
        id: 'labor',
        name: 'Labor',
        category: 'gathering',
        description: 'Mining, quarrying, and unearthing geological treasures.',
        icon: '⛏️'
    },
    aquatic: {
        id: 'aquatic',
        name: 'Aquatic',
        category: 'gathering',
        description: 'Fishing, sailing, and hauling up rare sunken cargo.',
        icon: '🎣'
    },
    nature: {
        id: 'nature',
        name: 'Nature',
        category: 'gathering',
        description: 'Agriculture, foraging, woodcutting, and animal husbandry.',
        icon: '🌿'
    },

    // === Processing Skills (4) ===
    forge: {
        id: 'forge',
        name: 'Forge',
        category: 'processing',
        description: 'Smithing weapons, armor, and mechanical tools at the furnace.',
        icon: '🔨'
    },
    cooking: {
        id: 'cooking',
        name: 'Cooking',
        category: 'processing',
        description: 'Preparing nourishing food and curative broths.',
        icon: '🍳'
    },
    alchemy: {
        id: 'alchemy',
        name: 'Alchemy',
        category: 'processing',
        description: 'Compounding herbs and reagents into potions and elixirs.',
        icon: '🧪'
    },
    science: {
        id: 'science',
        name: 'Science',
        category: 'processing',
        description: 'Infrastructure, engineering, and layout optimization.',
        icon: '⚗️'
    },

    // === Special Skills (4) ===
    occult: {
        id: 'occult',
        name: 'Occult',
        category: 'special',
        description: 'Enchanting, rituals, and reality-bending magic.',
        icon: '🔮'
    },
    crime: {
        id: 'crime',
        name: 'Crime',
        category: 'special',
        description: 'Stealth, lockpicking, and illegal extraction.',
        icon: '🗝️'
    },
    explore: {
        id: 'explore',
        name: 'Explore',
        category: 'special',
        description: 'Navigation, pathfinding, camping, and survival.',
        icon: '🧭'
    },
    social: {
        id: 'social',
        name: 'Social',
        category: 'special',
        description: 'Guild management, trade relations, and leadership.',
        icon: '🗣️'
    }
};

/**
 * SUB_SKILL_TO_PARENT - Mapping for resolving XP flow.
 * Sub-skills are strictly tags used for targeting modifiers,
 * but their progress funnels 100% into the parent skill.
 */
export const SUB_SKILL_TO_PARENT = {
    // Labor
    mining: 'labor',
    quarrying: 'labor',
    digging: 'labor',

    // Forge
    smithing: 'forge',
    smelting: 'forge',
    crafting: 'forge',
    armoring: 'forge',

    // Aquatic
    fishing: 'aquatic',
    sailing: 'aquatic',
    swimming: 'aquatic',
    diving: 'aquatic',

    // Nature
    foraging: 'nature',
    herbalism: 'nature',
    harvesting: 'nature',
    farming: 'nature',
    hunting: 'nature',
    logging: 'nature',
    ranching: 'nature',

    // Cooking
    cooking: 'cooking',
    baking: 'cooking',
    brewing: 'cooking',
    butchery: 'cooking',

    // Alchemy
    alchemy: 'alchemy',
    distilling: 'alchemy',
    transmutation: 'alchemy',

    // Science
    engineering: 'science',
    medicine: 'science',
    research: 'science',

    // Occult
    rituals: 'occult',
    summoning: 'occult',
    enchanting: 'occult',

    // Crime
    pickpocketing: 'crime',
    lockpicking: 'crime',
    stealth: 'crime',

    // Explore
    scouting: 'explore',
    mapping: 'explore',
    camping: 'explore',
    navigation: 'explore',

    // Social
    bartering: 'social',
    recruitment: 'social',
    propaganda: 'social',
    diplomacy: 'social',

    // Legacy parent ids from the pre-15-skill system. Existing card content
    // still references these; they funnel into the closest new skill until
    // the content is regenerated. (Content is disposable — locked decision.)
    industry: 'labor',
    nautical: 'aquatic',
    culinary: 'cooking',
    defence: 'defense'
};

/**
 * Skill categories for grouping in UI
 */
export const SKILL_CATEGORIES = {
    combat: {
        id: 'combat',
        name: 'Combat',
        skills: ['melee', 'ranged', 'magic', 'defense']
    },
    gathering: {
        id: 'gathering',
        name: 'Gathering',
        skills: ['labor', 'aquatic', 'nature']
    },
    processing: {
        id: 'processing',
        name: 'Processing',
        skills: ['forge', 'cooking', 'alchemy', 'science']
    },
    special: {
        id: 'special',
        name: 'Special',
        skills: ['occult', 'crime', 'explore', 'social']
    }
};

/**
 * The 4 combat skills. Hero Level = average of these four
 * (see combat_formula_spec.md F1/F2).
 */
export const COMBAT_SKILL_IDS = ['melee', 'ranged', 'magic', 'defense'];

/**
 * Total number of parent skills. Every hero has all of them.
 */
export const SKILL_COUNT = Object.keys(SKILLS).length; // 15
export const HERO_TOTAL_SKILLS = SKILL_COUNT;

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
export function getAllSkills() {
    return SKILLS;
}

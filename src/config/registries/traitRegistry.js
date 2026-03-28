// Fantasy Guild - Trait Registry
// Phase 6: Hero Registries

/**
 * TraitRegistry - Defines all 9 hero traits
 * 
 * Each trait grants:
 * - +10 Starting Levels to 3 skills
 * - +10% XP Gain to those same skills
 * 
 * Traits can overlap with Class bonuses for +20 levels / +20% XP
 */

export const TRAITS = {
    strong: {
        id: 'strong',
        name: 'Strong',
        description: 'Exceptional physical power and endurance.',
        bonusSkills: ['melee', 'industry', 'crafting'],
        icon: '💪',
        modifiers: [
            { type: 'SPEED', value: 0.1, target: { category: 'INDUSTRY' } }
        ]
    },
    nimble: {
        id: 'nimble',
        name: 'Nimble',
        description: 'Quick reflexes and agile movements.',
        bonusSkills: ['ranged', 'crime', 'nautical'],
        icon: '🦶',
        modifiers: [
            { type: 'SPEED', value: 0.1, target: { category: 'NAUTICAL' } }
        ]
    },
    brilliant: {
        id: 'brilliant',
        name: 'Brilliant',
        description: 'Sharp intellect and quick learning.',
        bonusSkills: ['magic', 'science', 'occult'],
        icon: '🧠',
        modifiers: [
            { type: 'SPEED', value: 0.1, target: { category: 'SCIENCE' } }
        ]
    },
    tough: {
        id: 'tough',
        name: 'Tough',
        description: 'Resilient body that withstands punishment.',
        bonusSkills: ['industry', 'melee', 'crafting'],
        icon: '🪨',
        modifiers: [
            { type: 'SPEED', value: 0.1, target: { category: 'INDUSTRY' } }
        ]
    },
    zealous: {
        id: 'zealous',
        name: 'Zealous',
        description: 'Unwavering conviction and spiritual fervor.',
        bonusSkills: ['occult', 'magic', 'science'],
        icon: '🔥',
        modifiers: [
            { type: 'SPEED', value: 0.1, target: { category: 'OCCULT' } }
        ]
    },
    greedy: {
        id: 'greedy',
        name: 'Greedy',
        description: 'An eye for value and opportunity.',
        bonusSkills: ['crime', 'nautical', 'crafting'],
        icon: '💰',
        modifiers: [
            { type: 'SPEED', value: 0.1, target: { category: 'CRIME' } }
        ]
    },
    curious: {
        id: 'curious',
        name: 'Curious',
        description: 'Endless desire to explore and discover.',
        bonusSkills: ['science', 'nature', 'occult'],
        icon: '🔍',
        modifiers: [
            { type: 'SPEED', value: 0.1, target: { category: 'NATURE' } }
        ]
    },
    cruel: {
        id: 'cruel',
        name: 'Cruel',
        description: 'A dark nature with no mercy for enemies.',
        bonusSkills: ['melee', 'ranged', 'crime'],
        icon: '💀',
        modifiers: [
            { type: 'SPEED', value: 0.1, target: { category: 'COMBAT' } }
        ]
    },
    disciplined: {
        id: 'disciplined',
        name: 'Disciplined',
        description: 'Rigorous training and unwavering focus.',
        bonusSkills: ['occult', 'crafting', 'culinary'],
        icon: '📏',
        modifiers: [
            { type: 'SPEED', value: 0.1, target: { category: 'CULINARY' } }
        ]
    }
};

/**
 * Starting level bonus from trait
 */
export const TRAIT_SKILL_BONUS = 10;

/**
 * XP gain bonus percentage from trait
 */
export const TRAIT_XP_BONUS = 0.10;  // 10%

/**
 * Get all trait IDs as an array
 * @returns {string[]}
 */
export function getAllTraitIds() {
    return Object.keys(TRAITS);
}

/**
 * Get trait by ID
 * @param {string} traitId 
 * @returns {Object|null}
 */
export function getTrait(traitId) {
    return TRAITS[traitId] || null;
}

/**
 * Check if a trait grants bonus to a skill
 * @param {string} traitId 
 * @param {string} skillId 
 * @returns {boolean}
 */
export function traitHasSkill(traitId, skillId) {
    const trait = TRAITS[traitId];
    return trait ? trait.bonusSkills.includes(skillId) : false;
}

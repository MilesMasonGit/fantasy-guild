// Fantasy Guild - Hero Generator
// Phase 7: Hero Generation

import { nanoid } from 'nanoid';
import {
    getAllSkillIds, getSkill,
    getAllClassIds, getClass, classHasSkill, CLASS_SKILL_BONUS,
    getAllTraitIds, getTrait, traitHasSkill, TRAIT_SKILL_BONUS,
    getRandomName
} from '../../config/registries/index.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';

/**
 * HeroGenerator - Creates new heroes with procedural generation
 * 
 * Heroes are generated with:
 * - Random name
 * - Random class (or specified)
 * - Random trait (or specified)
 * - Random icon from pool
 * - Starting skills based on class/trait bonuses
 */

// Pool of hero portrait emojis (fallback source)
export const HERO_ICONS = [
    '🧑', '👨', '👩', '🧔', '🧔‍♂️', '🧔‍♀️',
    '🧓', '🧓‍♂️', '🧓‍♀️', '👦', '👧', '👴', '👵',
    '🧙', '🧙‍♂️', '🧙‍♀️', '🧝', '🧝‍♂️', '🧝‍♀️',
    '🧛', '🧛‍♂️', '🧛‍♀️', '🧜', '🧜‍♂️', '🧜‍♀️',
    '🧞', '🧞‍♂️', '🧞‍♀️', '🤴', '👸', '🤵', '🥳',
    '💂', '💂‍♂️', '💂‍♀️', '🧟', '🧟‍♂️', '🧟‍♀️',
    '🦐', '🐕'
];

// Pool of hero portrait sprites (future implementation)
export const HERO_SPRITES = [
    'hero_adventure',
    'hero_knight',
    'hero_rogue',
    'hero_warlock',
    'hero_wizard'
];

/**
 * Generate a complete hero object
 * @param {Object} options - Generation options
 * @param {string} options.classId - Specific class (optional, random if omitted)
 * @param {string} options.traitId - Specific trait (optional, random if omitted)
 * @param {string} options.name - Specific name (optional, random if omitted)
 * @returns {Object} Complete hero object
 */
export function generateHero(options = {}) {
    const classIds = getAllClassIds();
    const traitIds = getAllTraitIds();

    const classId = options.classId || classIds[Math.floor(Math.random() * classIds.length)];
    const traitId = options.traitId || traitIds[Math.floor(Math.random() * traitIds.length)];
    const name = options.name || getRandomName();

    const heroClass = getClass(classId);
    const heroTrait = getTrait(traitId);

    // Build skills object with starting levels (1 Combat specialization + 8 Non-Combat parents)
    const skills = {};
    const specialization = heroClass.combatStyle;
    
    // 1. Initialize 8 Non-Combat Parent Skills
    const allSkillIds = getAllSkillIds();
    for (const skillId of allSkillIds) {
        const skillDef = getSkill(skillId);
        
        // Skip combat skills that are NOT the chosen specialization
        if (skillDef.category === 'combat' && skillId !== specialization) continue;

        let startingLevel = 1;  // All heroes start at Level 1 in the 9 core skills

        // Add class bonus (Check if the parent skill is in bonus list)
        if (classHasSkill(classId, skillId)) {
            startingLevel += CLASS_SKILL_BONUS;
        }

        // Add trait bonus
        if (traitHasSkill(traitId, skillId)) {
            startingLevel += TRAIT_SKILL_BONUS;
        }

        skills[skillId] = {
            xp: xpForLevel(startingLevel),
            level: startingLevel
        };
    }

    // Picking a random icon (emojis)
    const icon = HERO_ICONS[Math.floor(Math.random() * HERO_ICONS.length)];

    const hero = {
        id: `hero_${nanoid(8)}`,
        name,
        classId,
        traitId,
        icon,
        // Default spriteId to classId to ensure professional visuals by default
        spriteId: classId, 

        // NEW: Centralized modifier pool
        aggregator: new ModifierAggregator(null), // ID will be set to hero.id in a moment

        // Display info (REMOVED: Rehydrated from registry)

        // Current stats
        hp: { current: 100, max: 100 },
        energy: { current: 100, max: 100 },
        status: 'idle',  // 'idle', 'working', 'combat', 'wounded'
        woundedUntil: null,
        lastEatenAt: 0,
        lastDrunkAt: 0,

        // Skills
        skills,

        // Perks (choices made at milestones)
        perks: {},

        // Equipment slots
        equipment: {
            weapon: null,
            armor: null,
            food: null,
            drink: null
        },

        // Assignment
        assignedCardId: null,

        // Timestamps
        createdAt: Date.now()
    };

    // Set aggregator ID and apply trait/class modifiers
    hero.aggregator.id = hero.id;
    
    // 1. Apply Class Modifiers (Standardized XP bonuses)
    if (heroClass.skillIds && Array.isArray(heroClass.skillIds)) {
        heroClass.skillIds.forEach(skillId => {
            hero.aggregator.addModifier({
                type: 'xp_gain',  // EFFECT_TYPES.XP_GAIN
                category: skillId,
                value: 0.10,     // CLASS_XP_BONUS
                source: `class:${heroClass.id}`,
                persistent: true
            });
        });
    }

    // 2. Apply Trait Modifiers
    if (heroTrait.modifiers && Array.isArray(heroTrait.modifiers)) {
        heroTrait.modifiers.forEach(mod => {
            hero.aggregator.addModifier({
                ...mod,
                source: `trait:${heroTrait.id}`,
                persistent: true
            });
        });
    }

    return hero;
}

/**
 * Generate a complete Villager object
 * Villagers have 2 random non-combat skills and 'isVillager' flag
 * @returns {Object} Complete villager object
 */
export function generateVillager() {
    const name = getRandomName();
    const icon = HERO_ICONS[Math.floor(Math.random() * HERO_ICONS.length)];
    const sprite = HERO_SPRITES.length > 0
        ? HERO_SPRITES[Math.floor(Math.random() * HERO_SPRITES.length)]
        : null;

    // Filter to non-combat skills
    const allSkills = getAllSkillIds().map(id => getSkill(id));
    const nonCombatSkillsPool = allSkills.filter(s => s.category !== 'combat').map(s => s.id);

    // Initialize all 8 non-combat skills at 0
    const skills = {};
    for (const skillId of nonCombatSkillsPool) {
        skills[skillId] = { xp: 0, level: 0 };
    }

    // Pick 2 random unique skills to be specialties (Level 1 to 3)
    const skill1 = nonCombatSkillsPool.splice(Math.floor(Math.random() * nonCombatSkillsPool.length), 1)[0];
    const skill2 = nonCombatSkillsPool.splice(Math.floor(Math.random() * nonCombatSkillsPool.length), 1)[0];

    const level1 = Math.floor(Math.random() * 3) + 1;
    const level2 = Math.floor(Math.random() * 3) + 1;

    skills[skill1] = { xp: xpForLevel(level1), level: level1 };
    skills[skill2] = { xp: xpForLevel(level2), level: level2 };

    const villager = {
        id: `villager_${nanoid(8)}`,
        isVillager: true,
        name,
        classId: null,
        traitId: null,
        icon,
        sprite,

        // NEW: Centralized modifier pool
        aggregator: new ModifierAggregator(null),

        className: 'Villager',
        traitName: '',

        hp: { current: 100, max: 100 },
        energy: { current: 100, max: 100 },
        status: 'idle',
        woundedUntil: null,
        lastEatenAt: 0,
        lastDrunkAt: 0,

        skills,
        perks: {},

        equipment: { weapon: null, armor: null, food: null, drink: null },
        assignedCardId: null,
        createdAt: Date.now()
    };

    villager.aggregator.id = villager.id;
    return villager;
}

/**
 * Generate multiple hero candidates for recruitment
 * Used by Recruit cards to offer player choices
 * @param {number} count - Number of candidates to generate
 * @param {string} revealType - 'class', 'trait', or 'random'
 * @returns {Array} Array of partial hero info for display
 */
export function generateCandidates(count = 3, revealType = 'random') {
    const candidates = [];

    for (let i = 0; i < count; i++) {
        const hero = generateHero();

        // Determine what to reveal
        let revealed;
        if (revealType === 'random') {
            revealed = Math.random() < 0.5 ? 'class' : 'trait';
        } else {
            revealed = revealType;
        }

        candidates.push({
            id: hero.id,
            name: hero.name,
            classId: hero.classId,
            traitId: hero.traitId,
            className: hero.className,
            traitName: hero.traitName,
            revealed,  // 'class' or 'trait' - UI shows only this info
            _fullHero: hero  // Hidden data, used when player selects
        });
    }

    return candidates;
}

/**
 * Finalize a candidate into a full hero
 * Called when player selects a candidate from Recruit card
 * @param {Object} candidate - Candidate from generateCandidates
 * @returns {Object} Full hero object
 */
export function finalizeCandidate(candidate) {
    return candidate._fullHero;
}

export function calculateHeroLevel(skills) {
    const totalLevels = Object.values(skills).reduce((sum, skill) => sum + skill.level, 0);
    return totalLevels / 9;
}

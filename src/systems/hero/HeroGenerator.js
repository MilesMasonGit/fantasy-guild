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
    // 'assets/portraits/heroes/scout_v1.png',
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

    // Build skills object with starting levels
    const skills = {};
    for (const skillId of getAllSkillIds()) {
        let startingLevel = 1;  // Base level

        // Add class bonus
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

    // Pick a random icon and optional sprite
    const icon = HERO_ICONS[Math.floor(Math.random() * HERO_ICONS.length)];
    const sprite = HERO_SPRITES.length > 0
        ? HERO_SPRITES[Math.floor(Math.random() * HERO_SPRITES.length)]
        : null;

    return {
        id: `hero_${nanoid(8)}`,
        name,
        classId,
        traitId,
        icon,
        sprite,

        // Display info
        className: heroClass.name,
        traitName: heroTrait.name,

        // Current stats
        hp: { current: 100, max: 100 },
        energy: { current: 100, max: 100 },
        status: 'idle',  // 'idle', 'working', 'combat', 'wounded'
        woundedUntil: null,

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
    const nonCombatSkills = allSkills.filter(s => s.category !== 'combat').map(s => s.id);

    // Pick 2 random unique skills
    const skill1 = nonCombatSkills.splice(Math.floor(Math.random() * nonCombatSkills.length), 1)[0];
    const skill2 = nonCombatSkills.splice(Math.floor(Math.random() * nonCombatSkills.length), 1)[0];

    const skills = {};
    // Give them a small random starting boost (Level 1 to 3)
    const level1 = Math.floor(Math.random() * 3) + 1;
    const level2 = Math.floor(Math.random() * 3) + 1;

    skills[skill1] = { xp: xpForLevel(level1), level: level1 };
    skills[skill2] = { xp: xpForLevel(level2), level: level2 };

    return {
        id: `villager_${nanoid(8)}`,
        isVillager: true,
        name,
        classId: null,
        traitId: null,
        icon,
        sprite,

        className: 'Villager',
        traitName: '',

        hp: { current: 100, max: 100 },
        energy: { current: 100, max: 100 },
        status: 'idle',
        woundedUntil: null,

        skills,
        perks: {},

        equipment: { weapon: null, armor: null, food: null, drink: null },
        assignedCardId: null,
        createdAt: Date.now()
    };
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

/**
 * Calculate hero level from total skill levels
 * Hero Level = floor(Total Skill Levels / 11)
 * @param {Object} skills - Skills object from hero
 * @returns {number} Hero level
 */
export function calculateHeroLevel(skills) {
    const totalLevels = Object.values(skills).reduce((sum, skill) => sum + skill.level, 0);
    return Math.floor(totalLevels / 11);
}

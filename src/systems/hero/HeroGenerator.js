// Fantasy Guild - Hero Generator
// Phase 7: Hero Generation

import { nanoid } from 'nanoid';
import {
    getAllSkillIds,
    COMBAT_SKILL_IDS,
    getAllClassIds,
    getAllTraitIds,
    getRandomName
} from '../../config/registries/index.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';
import { heroMaxHpFromSkills } from '../../utils/CombatFormulas.js';

/**
 * HeroGenerator - Creates new heroes with procedural generation
 * 
 * Heroes are generated with:
 * - Random name
 * - Random class (or specified) — cosmetic flavor only
 * - Random trait (or specified) — cosmetic flavor only
 * - Random icon from pool
 * - All 15 skills starting at level 1
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

    // Every hero has all 15 skills, all starting at level 1.
    // Classes and traits are cosmetic and grant no skill bonuses.
    const skills = {};
    for (const skillId of getAllSkillIds()) {
        skills[skillId] = {
            xp: xpForLevel(1),
            level: 1
        };
    }

    // Picking a random icon (emojis)
    const icon = HERO_ICONS[Math.floor(Math.random() * HERO_ICONS.length)];

    // Max HP derives from combat skills: 30·G(CL) + 20·G(Defense) — 50 at level 1
    const maxHp = heroMaxHpFromSkills(skills);

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
        hp: { current: maxHp, max: maxHp },
        energy: { current: 100, max: 100 },
        status: 'idle',  // 'idle', 'working', 'combat', 'wounded'
        woundedUntil: null,

        // Skills
        skills,

        // Active status effects (StatusEffectSystem) — persisted with the save
        statuses: [],

        // Perks (choices made at milestones)
        perks: {},

        // Equipment slots (food/drink retired — CR-029)
        equipment: {
            weapon: null,
            armor: null
        },

        // Assignment
        assignedCardId: null,

        // Timestamps
        createdAt: Date.now()
    };

    // Set aggregator ID. Classes/traits are cosmetic — no modifiers applied.
    hero.aggregator.id = hero.id;

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

    // Filter to non-combat (loop) skills
    const nonCombatSkillsPool = getAllSkillIds().filter(id => !COMBAT_SKILL_IDS.includes(id));

    // Initialize all loop skills at 0
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

        skills,
        perks: {},

        equipment: { weapon: null, armor: null },
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

/**
 * Hero Level = average of the 4 combat skill levels (Melee, Ranged, Magic, Defense).
 * Loop skills level independently but do not feed hero level.
 * See combat_formula_spec.md (F1/F2).
 */
export function calculateHeroLevel(skills) {
    if (!skills) return 0;
    const totalLevels = COMBAT_SKILL_IDS.reduce((sum, skillId) => {
        const skill = skills[skillId];
        const level = typeof skill === 'number' ? skill : (skill?.level || 0);
        return sum + level;
    }, 0);
    return totalLevels / COMBAT_SKILL_IDS.length;
}

import { nanoid } from 'nanoid';
import { FOUNDATION_SKILL_IDS } from '../../config/registries/skillRegistry.js';
import { STARTING_JOB_ID, getJobSheet } from '../../config/registries/jobRegistry.js';
// ⚠️ `nameRegistry` is imported only here. It looks like an orphan; it names every hero.
import { getRandomName } from '../../config/registries/nameRegistry.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';
import { createEmptyEquipment } from '../../config/registries/equipmentConstants.js';
import { heroMaxHpFromSkills } from '../../utils/CombatFormulas.js';

/**
 * HeroGenerator - creates new heroes.
 *
 * Every hero starts as a Recruit: the Foundation skills at level 1 and nothing
 * else, so an unpromoted hero holds no combat skill and cannot fight. The way to
 * gain one is promotion.
 *
 * `classId` and `traitId` are still written as `null` only to keep the saved
 * hero shape unchanged.
 */

export const HERO_ICONS = [
    '🧑', '👨', '👩', '🧔', '🧔‍♂️', '🧔‍♀️',
    '🧓', '🧓‍♂️', '🧓‍♀️', '👦', '👧', '👴', '👵',
    '🧙', '🧙‍♂️', '🧙‍♀️', '🧝', '🧝‍♂️', '🧝‍♀️',
    '🧛', '🧛‍♂️', '🧛‍♀️', '🧜', '🧜‍♂️', '🧜‍♀️',
    '🧞', '🧞‍♂️', '🧞‍♀️', '🤴', '👸', '🤵', '🥳',
    '💂', '💂‍♂️', '💂‍♀️', '🧟', '🧟‍♂️', '🧟‍♀️',
    '🦐', '🐕'
];

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
 * @param {string} options.name - Specific name (optional, random if omitted)
 * @returns {Object} Complete hero object
 */
export function generateHero(options = {}) {
    const name = options.name || getRandomName();

    // The job's sheet decides what a Recruit holds, so changing that is a
    // `jobRegistry.js` edit and nothing else.
    const jobId = options.jobId || STARTING_JOB_ID;
    const skills = {};
    for (const skillId of getJobSheet(jobId)) {
        skills[skillId] = {
            xp: xpForLevel(1),
            level: 1
        };
    }

    const icon = options.icon || 'icon_recruit_0';
    const spriteId = options.spriteId || 'hero_recruit_0';

    // Max HP derives from the combat skill, floored at level 1 for a Recruit.
    const maxHp = heroMaxHpFromSkills(skills);

    const hero = {
        id: `hero_${nanoid(8)}`,
        name,
        jobId,
        // Retired concepts, kept as null so the saved hero shape is unchanged.
        classId: null,
        traitId: null,
        icon,
        spriteId, 

        aggregator: new ModifierAggregator(null),

        hp: { current: maxHp, max: maxHp },
        energy: { current: 100, max: 100 },
        status: 'idle',
        woundedUntil: null,

        skills,

        // Per skill (and Fight): allowed, priority 1–5. Sparse; a missing entry
        // is the default.
        flagRules: {},

        statuses: [],

        perks: {},

        equipment: createEmptyEquipment(),

        assignedCardId: null,

        createdAt: Date.now()
    };

    hero.aggregator.id = hero.id;

    return hero;
}

/**
 * Generate a complete Villager object: two Foundation skills and nothing else.
 * Not called outside tests.
 *
 * @returns {Object} Complete villager object
 */
export function generateVillager() {
    const name = getRandomName();
    const icon = HERO_ICONS[Math.floor(Math.random() * HERO_ICONS.length)];
    const sprite = HERO_SPRITES.length > 0
        ? HERO_SPRITES[Math.floor(Math.random() * HERO_SPRITES.length)]
        : null;

    const pool = [...FOUNDATION_SKILL_IDS];

    const skills = {};
    const skill1 = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const skill2 = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];

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

        aggregator: new ModifierAggregator(null),

        className: 'Villager',
        traitName: '',

        hp: { current: 100, max: 100 },
        energy: { current: 100, max: 100 },
        status: 'idle',
        woundedUntil: null,

        skills,
        perks: {},

        equipment: createEmptyEquipment(),
        assignedCardId: null,
        createdAt: Date.now()
    };

    villager.aggregator.id = villager.id;
    return villager;
}

/**
 * Generate hero candidates for recruitment. Every candidate is an interchangeable
 * Recruit: differences between heroes are earned through promotion, never rolled.
 * Not called outside tests.
 *
 * @param {number} count - Number of candidates to generate
 * @returns {Array} Array of partial hero info for display
 */
export function generateCandidates(count = 3) {
    const candidates = [];

    for (let i = 0; i < count; i++) {
        const hero = generateHero();

        candidates.push({
            id: hero.id,
            name: hero.name,
            jobId: hero.jobId,
            skills: hero.skills,
            _fullHero: hero  // Hidden data, used when player selects
        });
    }

    return candidates;
}

/**
 * Unwrap a candidate from generateCandidates into its full hero.
 * Not called outside tests.
 * @param {Object} candidate
 * @returns {Object} Full hero object
 */
export function finalizeCandidate(candidate) {
    return candidate._fullHero;
}

/**
 * Hero Level: the average of the skills the hero actually holds. A summary for
 * sorting and comparing the roster; there is no hero XP independent of skill XP.
 *
 * ⚠️ This is NOT the combat number. The engine reads the hero's single combat
 * skill for HP, block and hit rolls; reading this would let a hero gain max HP
 * by mining.
 */
export function calculateHeroLevel(skills) {
    if (!skills) return 0;
    const held = Object.values(skills);
    if (held.length === 0) return 0;

    const totalLevels = held.reduce((sum, skill) => {
        const level = typeof skill === 'number' ? skill : (skill?.level || 0);
        return sum + level;
    }, 0);
    return totalLevels / held.length;
}

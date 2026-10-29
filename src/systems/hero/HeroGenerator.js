import { nanoid } from 'nanoid';
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
 * else, so an unpromoted hero holds no combat skill (they still fight, barehanded,
 * but earn no combat XP). The way to gain one is promotion.
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
    'hn_adventure_por',
    'hm_fighter_por',
    'hn_sneak_por',
    'hm_wizard_por'
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

    const icon = options.icon || 'hn_recruit_icon_por';
    const spriteId = options.spriteId || 'hn_recruit_por';

    // Max HP is 10 + the combat level; a Recruit holds no combat skill, so 10.
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
        status: 'idle',
        woundedUntil: null,

        skills,

        // Always empty: statuses ride on `effects` (see `HeroRehydration`).
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

import { nanoid } from 'nanoid';
import { HERO_SKILL_IDS } from '../../config/registries/skillRegistry.js';
// ⚠️ `nameRegistry` is imported only here. It looks like an orphan; it names every hero.
import { getRandomName } from '../../config/registries/nameRegistry.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';
import { createEmptyEquipment } from '../../config/registries/equipmentConstants.js';
import { heroMaxHpFromSkills } from '../../utils/CombatFormulas.js';

/**
 * HeroGenerator - creates new heroes.
 *
 * Every hero starts holding every skill at level 1 (`skillRegistry.HERO_SKILL_IDS`): what they
 * become is what they are sent to do.
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

    const skills = {};
    for (const skillId of HERO_SKILL_IDS) {
        skills[skillId] = {
            xp: xpForLevel(1),
            level: 1
        };
    }

    const icon = options.icon || 'hn_recruit_icon_por';
    const spriteId = options.spriteId || 'hn_recruit_por';

    // Max HP is 10 + the best combat skill: 11 at level 1.
    const maxHp = heroMaxHpFromSkills(skills);

    const hero = {
        id: `hero_${nanoid(8)}`,
        name,
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
 * ⚠️ This is NOT the combat number. The engine reads the style in the hero's hands
 * for hits and the best combat skill for HP; reading this would let a hero gain
 * max HP by mining.
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

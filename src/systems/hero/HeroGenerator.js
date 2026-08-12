// Fantasy Guild - Hero Generator
// Phase 7: Hero Generation

import { nanoid } from 'nanoid';
import {
    getAllSkillIds,
    FOUNDATION_SKILL_IDS,
    COMBAT_SKILL_IDS,
    STARTING_JOB_ID,
    getJobSkills,
    getAllClassIds,
    getAllTraitIds,
    getRandomName
} from '../../config/registries/index.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';
import { createEmptyEquipment } from '../../config/registries/equipmentConstants.js';
import { heroMaxHpFromSkills } from '../../utils/CombatFormulas.js';

/**
 * HeroGenerator - Creates new heroes with procedural generation
 * 
 * Heroes are generated with:
 * - Random name
 * - Random class (or specified) — cosmetic flavor only
 * - Random trait (or specified) — cosmetic flavor only
 * - Random icon from pool
 * - **The six Foundation skills, at level 1. Nothing else.**
 *
 * ## Every hero starts as a Recruit
 * A hero no longer holds every skill in the world — they hold the Foundation
 * six, which is the complete skill vocabulary of the opening game. The other 21
 * are work this person **cannot do**, and the only way to gain one is a
 * promotion.
 *
 * ⚠️ **A Recruit therefore holds no combat skill**, which is the intended end
 * state: an unpromoted hero cannot fight. Until the job tree and promotion land
 * (Phases 4–5) there is no in-game way to grant one, so the QA dashboard has a
 * temporary **"Grant combat skill"** action to keep combat exercisable. That
 * button is scaffolding and goes when promotion arrives.
 *
 * ⚠️ **`classId` and `traitId` are untouched by this phase** and remain the
 * inert cosmetic rolls they have always been. Replacing them with the job tree
 * is Phase 4 — doing it here would take hero sprites and the Dock with it for
 * no gain, since neither field has ever affected a skill.
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

    // A new hero is a Recruit, and **the job tree decides what that means** —
    // this reads the job's sheet rather than the Foundation list directly, so
    // changing what a Recruit holds is a `jobRegistry.js` edit and nothing else.
    // Classes and traits are cosmetic and grant no skill bonuses.
    const jobId = options.jobId || STARTING_JOB_ID;
    const skills = {};
    for (const skillId of getJobSkills(jobId)) {
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
        // **The hero's job — now the source of truth for what they can do.**
        // `classId` below is cosmetic leftover that only the sprite reads;
        // Phase 7/9 retires it.
        jobId,
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

        // Six equipment slots: hand1, hand2, hat, chest, trinket1, trinket2
        equipment: createEmptyEquipment(),

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
 *
 * A villager holds **two Foundation skills** and nothing else — they are a
 * narrower Recruit, never promoted and never gaining XP.
 *
 * *Changed this phase:* they used to be seeded with every non-combat skill at
 * level 0 plus two specialities. Level 0 no longer means "has it but is bad at
 * it" — an absent skill is now the way to say *cannot do this* — so seeding
 * eleven zeroes would have handed every villager the whole production world.
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

    // Two Foundation skills, at level 1–3. Nothing else is held at all.
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

        equipment: createEmptyEquipment(),
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
 * **Hero Level = the average of the skills the hero actually holds.**
 *
 * A summary for sorting and comparing the roster, not a separate grind — there
 * is no hero XP independent of skill XP.
 *
 * *Changed this phase.* It used to average the four combat skills, including
 * `defense`. Both halves of that broke at once: `defense` no longer exists, and
 * a Recruit holds **no** combat skill, so the old formula returned 0 for every
 * new hero. Averaging held skills also makes the number mean something for a
 * production hero — a master smith now reads as a high-level hero, which the
 * combat-only version could never say.
 *
 * ⚠️ **This is NOT the combat number.** The engine reads the hero's single
 * combat skill for HP, block and hit rolls; if it read this, a hero would gain
 * max HP by mining. Repointing those reads is Phase 2 — until it lands they
 * still look for `defense` and fall back to 1.
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

// Fantasy Guild - Hero Generator
// Phase 7: Hero Generation

import { nanoid } from 'nanoid';
import { FOUNDATION_SKILL_IDS } from '../../config/registries/skillRegistry.js';
import { STARTING_JOB_ID, getJobSkills } from '../../config/registries/jobRegistry.js';
// ⚠️ `nameRegistry` reaches the game only through this import and the one in
// `getRandomName`'s other call site below. It looks like an orphan and has been
// misjudged as dead before — it names every hero and villager in the game.
import { getRandomName } from '../../config/registries/nameRegistry.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';
import { createEmptyEquipment } from '../../config/registries/equipmentConstants.js';
import { heroMaxHpFromSkills } from '../../utils/CombatFormulas.js';

/**
 * HeroGenerator - Creates new heroes with procedural generation
 * 
 * Heroes are generated with:
 * - Random name
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
 * ## Classes and traits are retired (owner decision 2026-08-18)
 * Both registries are deleted. Heroes are no longer rolled a class or a trait —
 * their job is their identity. `classId` and `traitId` are still written, as
 * `null`, purely to keep the saved hero shape unchanged; nothing reads them.
 * Villagers have set them to `null` this way all along.
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
 * @param {string} options.name - Specific name (optional, random if omitted)
 * @returns {Object} Complete hero object
 */
export function generateHero(options = {}) {
    const name = options.name || getRandomName();

    // A new hero is a Recruit, and **the job tree decides what that means** —
    // this reads the job's sheet rather than the Foundation list directly, so
    // changing what a Recruit holds is a `jobRegistry.js` edit and nothing else.
    const jobId = options.jobId || STARTING_JOB_ID;
    const skills = {};
    for (const skillId of getJobSkills(jobId)) {
        skills[skillId] = {
            xp: xpForLevel(1),
            level: 1
        };
    }

    // Default icon and sprite for new recruits
    const icon = options.icon || 'icon_recruit_0';
    const spriteId = options.spriteId || 'hero_recruit_0';

    // Max HP derives from combat skills: 30·G(CL) + 20·G(Defense) — 50 at level 1
    const maxHp = heroMaxHpFromSkills(skills);

    const hero = {
        id: `hero_${nanoid(8)}`,
        name,
        // **The hero's job — now the source of truth for what they can do.**
        jobId,
        // Retired concepts, kept as null so the saved hero shape is unchanged.
        classId: null,
        traitId: null,
        icon,
        spriteId, 

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

    // Set aggregator ID. A fresh hero carries no modifiers at all.
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
 * Generate hero candidates for recruitment.
 *
 * ⚠️ **The class/trait reveal is gone**, and so now are classes and traits
 * themselves. It used to show one rolled attribute per candidate and hide the
 * other, which made hiring a small gamble. There is nothing left to gamble on:
 * every recruit is a Recruit, holding the same six Foundation skills at level 1.
 *
 * **Candidates are therefore interchangeable, and that is the design** (D-73):
 * every difference between two heroes is *earned*, never rolled. Recruitment is
 * a question of **how many**, never **which** — what a hero becomes is entirely
 * the player's doing, through promotion.
 *
 * The choice-of-three is kept because the flow and its cost machinery are built
 * around it, but it is now a formality. If that reads as a pointless click, the
 * honest fix is to hire directly rather than to re-roll differences back in.
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

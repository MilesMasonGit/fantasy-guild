// Fantasy Guild - Modifier Aggregator
// Phase 8: Skill System + ModifierAggregator

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { getHero } from '../hero/HeroManager.js';
import {
    classHasSkill, CLASS_XP_BONUS,
    traitHasSkill, TRAIT_XP_BONUS
} from '../../config/registries/index.js';

/**
 * ModifierAggregator - Calculates and caches all bonuses
 * 
 * Collects bonuses from:
 * - Class (XP bonus to 3 skills)
 * - Trait (XP bonus to 3 skills)
 * - Equipment (future: Phase 34)
 * - Perks (future: Phase 36)
 * - Projects (future: Phase 26)
 * - Invasion debuffs (future: Phase 33)
 */

// Cache for computed modifiers per hero
const heroModifierCache = new Map();

/**
 * Get all modifiers for a hero (uses cache)
 * @param {string} heroId 
 * @returns {Object} Modifier object
 */
export function getModifiers(heroId) {
    // Check cache
    if (heroModifierCache.has(heroId)) {
        return heroModifierCache.get(heroId);
    }

    // Calculate and cache
    const modifiers = calculateModifiers(heroId);
    heroModifierCache.set(heroId, modifiers);
    return modifiers;
}

/**
 * Calculate all modifiers for a hero (no cache)
 * @param {string} heroId 
 * @returns {Object}
 */
function calculateModifiers(heroId) {
    const hero = getHero(heroId);
    if (!hero) {
        return createEmptyModifiers();
    }

    const modifiers = createEmptyModifiers();

    // === Class XP Bonuses ===
    if (hero.classId) {
        for (const skillId in hero.skills) {
            if (classHasSkill(hero.classId, skillId)) {
                modifiers.xpMultipliers[skillId] =
                    (modifiers.xpMultipliers[skillId] || 0) + CLASS_XP_BONUS;
            }
        }
    }

    // === Trait XP Bonuses ===
    if (hero.traitId) {
        for (const skillId in hero.skills) {
            if (traitHasSkill(hero.traitId, skillId)) {
                modifiers.xpMultipliers[skillId] =
                    (modifiers.xpMultipliers[skillId] || 0) + TRAIT_XP_BONUS;
            }
        }
    }

    // === Equipment Bonuses (future) ===
    // Will be added in Phase 34

    // === Perk Bonuses (future) ===
    // Will be added in Phase 36

    // === Project Bonuses (future) ===
    // Will be added in Phase 26

    return modifiers;
}

/**
 * Create empty modifier structure
 * @returns {Object}
 */
function createEmptyModifiers() {
    return {
        // XP gain multipliers per skill
        xpMultipliers: {},

        // Tick time multipliers per skill (lower = faster)
        tickTimeMultipliers: {},

        // Output chance bonuses per skill
        outputChanceBonus: {},

        // Flat stat bonuses
        stats: {
            maxHp: 0,
            maxEnergy: 0,
            hpRegen: 0,
            energyRegen: 0
        },

        // Combat bonuses
        combat: {
            hitChance: 0,
            damage: 0,
            damageReduction: 0
        }
    };
}

/**
 * Get XP multiplier for a skill (1.0 = no bonus)
 * @param {string} heroId 
 * @param {string} skillId 
 * @returns {number}
 */
export function getXpMultiplier(heroId, skillId) {
    const modifiers = getModifiers(heroId);
    return 1.0 + (modifiers.xpMultipliers[skillId] || 0);
}

/**
 * Get tick time multiplier for a skill (1.0 = normal, <1 = faster)
 * @param {string} heroId 
 * @param {string} skillId 
 * @returns {number}
 */
export function getTickTimeMultiplier(heroId, skillId) {
    const modifiers = getModifiers(heroId);
    return 1.0 + (modifiers.tickTimeMultipliers[skillId] || 0);
}

/**
 * Invalidate cache for a specific hero
 * Call when hero's modifiers change (equip, perk, etc.)
 * @param {string} heroId 
 */
export function invalidateHeroCache(heroId) {
    heroModifierCache.delete(heroId);
}

/**
 * Invalidate all caches
 * Call when global modifiers change (projects, invasions)
 */
export function invalidateAllCaches() {
    heroModifierCache.clear();
}

/**
 * Recalculate and store modifiers in GameState
 * Called on game load and after major state changes
 */
export function recalculateGlobalModifiers() {
    const globalModifiers = {
        // Global tick time from projects/invasions
        tickTimeMultipliers: {},

        // Global XP bonuses from projects
        xpMultipliers: {},

        // Inventory bonuses from projects
        inventorySlots: 0,
        maxStack: 0,

        // Card limit bonuses from projects
        cardLimit: 0
    };

    // TODO: Aggregate from completed projects (Phase 26)
    // TODO: Aggregate from invasion debuffs (Phase 33)

    GameState.setModifiers(globalModifiers);
}

// === Event Subscriptions ===
// Invalidate caches when relevant events occur

EventBus.subscribe('hero_equipped', ({ heroId }) => {
    invalidateHeroCache(heroId);
});

EventBus.subscribe('perk_selected', ({ heroId }) => {
    invalidateHeroCache(heroId);
});

EventBus.subscribe('project_completed', () => {
    invalidateAllCaches();
    recalculateGlobalModifiers();
});

EventBus.subscribe('invasion_escalated', () => {
    invalidateAllCaches();
    recalculateGlobalModifiers();
});

EventBus.subscribe('invasion_completed', () => {
    invalidateAllCaches();
    recalculateGlobalModifiers();
});

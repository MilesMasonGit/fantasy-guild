// Fantasy Guild - Modifier Aggregator
// Phase 8: Skill System + ModifierAggregator

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { getHero } from '../hero/HeroManager.js';
import {
    classHasSkill, CLASS_XP_BONUS,
    traitHasSkill, TRAIT_XP_BONUS,
    getAllSkillIds, getSkill
} from '../../config/registries/index.js';
import { getThreat } from '../../config/registries/threatRegistry.js';

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

    // === Invasion Debuffs ===
    const globalThreats = GameState.invasions?.globalThreats || {};
    for (const [threatId, stacks] of Object.entries(globalThreats)) {
        const threat = getThreat(threatId);
        if (!threat || !threat.effect) continue;

        const { type, category, skill, value, isFlat } = threat.effect;

        // Apply skill-specific debuffs
        if (type === 'tick_time') {
            if (skill) {
                modifiers.tickTimeMultipliers[skill] = (modifiers.tickTimeMultipliers[skill] || 0) + (value * stacks);
            } else if (category) {
                // Apply to all skills in this category or the skill itself if it matches the name
                for (const sId in modifiers.tickTimeMultipliers) {
                    if (sId === category) modifiers.tickTimeMultipliers[sId] += (value * stacks);
                }
                // Also handle the case where category is 'industry' and skill is 'industry'
                if (modifiers.tickTimeMultipliers[category] !== undefined) {
                    modifiers.tickTimeMultipliers[category] += (value * stacks);
                }
            }
        } else if (type === 'energy_cost' && isFlat) {
            modifiers.energyCostFlat += (value * stacks);
        } else if (type === 'regen_rate') {
            modifiers.stats.hpRegen += (value * stacks);
            modifiers.stats.energyRegen += (value * stacks);
        } else if (type === 'xp_gain') {
            if (skill) {
                modifiers.xpMultipliers[skill] = (modifiers.xpMultipliers[skill] || 0) + (value * stacks);
            } else if (category) {
                // Mapping categories to skills is handled better by checking the skill's category property
                // But for now we can just assume the category name matches a skill id if that's how it's used
                if (modifiers.xpMultipliers[category] !== undefined) {
                    modifiers.xpMultipliers[category] += (value * stacks);
                }
            }
        }
    }

    return modifiers;
}

/**
 * Create empty modifier structure
 * @returns {Object}
 */
function createEmptyModifiers() {
    const mods = {
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
        },

        // Flat offsets
        energyCostFlat: 0
    };

    // Initialize per-skill objects
    for (const skillId of getAllSkillIds()) {
        mods.xpMultipliers[skillId] = 0;
        mods.tickTimeMultipliers[skillId] = 0;
        mods.outputChanceBonus[skillId] = 0;
    }

    return mods;
}

/**
 * Get XP multiplier for a skill (1.0 = no bonus)
 * @param {string} heroId 
 * @param {string} skillId 
 * @returns {number}
 */
export function getXpMultiplier(heroId, skillId) {
    const modifiers = getModifiers(heroId);
    const globalMods = GameState.modifiers || {};

    let total = 1.0 + (modifiers.xpMultipliers[skillId] || 0);

    // Add global bonuses (Phase 33)
    if (globalMods.xpMultipliers?.[skillId]) total += globalMods.xpMultipliers[skillId];

    return total;
}

/**
 * Get tick time multiplier for a skill (1.0 = normal, <1 = faster, >1 = slower)
 * @param {string} heroId 
 * @param {string} skillId 
 * @returns {number}
 */
export function getTickTimeMultiplier(heroId, skillId) {
    const modifiers = getModifiers(heroId);
    const globalMods = GameState.modifiers || {};

    let total = 1.0 + (modifiers.tickTimeMultipliers[skillId] || 0);

    // Add global modifiers (debuffs from invasion are usually positive values like 0.1 for +10% time)
    if (globalMods.tickTimeMultipliers?.[skillId]) {
        total += globalMods.tickTimeMultipliers[skillId];
    }

    // Check category-based global modifiers
    const skillObj = getSkill(skillId);
    if (skillObj && globalMods.tickTimeMultipliers?.[skillObj.category]) {
        total += globalMods.tickTimeMultipliers[skillObj.category];
    }

    return total;
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

    // === Aggregate from invasion debuffs ===
    const globalThreats = GameState.invasions?.globalThreats || {};
    for (const [threatId, stacks] of Object.entries(globalThreats)) {
        const threat = getThreat(threatId);
        if (!threat || !threat.effect) continue;

        const { type, category, skill, value, isFlat } = threat.effect;

        if (type === 'tick_time') {
            if (category) {
                globalModifiers.tickTimeMultipliers[category] = (globalModifiers.tickTimeMultipliers[category] || 0) + (value * stacks);
            } else if (skill) {
                globalModifiers.tickTimeMultipliers[skill] = (globalModifiers.tickTimeMultipliers[skill] || 0) + (value * stacks);
            }
        } else if (type === 'inventory_slots' && isFlat) {
            globalModifiers.inventorySlots += (value * stacks);
        } else if (type === 'inventory_stack') {
            globalModifiers.maxStackMultipler = (globalModifiers.maxStackMultipler || 0) + (value * stacks);
        } else if (type === 'xp_gain') {
            if (skill) {
                globalModifiers.xpMultipliers[skill] = (globalModifiers.xpMultipliers[skill] || 0) + (value * stacks);
            }
        }
    }

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

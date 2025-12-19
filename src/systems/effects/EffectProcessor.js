// Fantasy Guild - Effect Processor
// Phase 26: Biome/Modifier Effects

import * as SkillSystem from '../hero/SkillSystem.js';
import { logger } from '../../utils/Logger.js';

/**
 * EffectProcessor - Centralized effect application logic
 * 
 * Effects are stored on task cards when spawned from Area Quests.
 * They are applied when the task completes.
 * 
 * Effect Types:
 * - xp_skill: Bonus XP for specific skills
 * - output_double: Chance to double outputs
 * - damage: Combat damage bonus (stub)
 * - dodge: Dodge chance (stub)
 * - drink_effect: Drink effectiveness bonus (stub)
 */

/**
 * Apply all stored effects when a task completes
 * @param {Array} effects - Array of effect objects from cardInstance.sourceEffects
 * @param {Object} cardInstance - The completed card instance
 * @param {Object} hero - The hero who completed the task
 * @param {Object} template - The card template
 * @param {Object} context - Context object for collecting effect results
 * @returns {Object} Results of effect application
 */
export function applyTaskEffects(effects, cardInstance, hero, template, context = {}) {
    if (!effects || effects.length === 0) {
        return { applied: [] };
    }

    const results = { applied: [] };
    const taskSkill = template.skill;

    for (const effect of effects) {
        const result = applyEffect(effect, taskSkill, hero, context);
        if (result.applied) {
            results.applied.push(result);
        }
    }

    if (results.applied.length > 0) {
        logger.debug('EffectProcessor', `Applied ${results.applied.length} effects to task completion`);
    }

    return results;
}

/**
 * Apply a single effect
 * @param {Object} effect - The effect object
 * @param {string} taskSkill - The skill used by the task
 * @param {Object} hero - The hero
 * @param {Object} context - Context for collecting results
 * @returns {Object} Result of effect application
 */
function applyEffect(effect, taskSkill, hero, context) {
    // Check if effect applies to this task's skill
    // 'all' means it applies to every skill
    if (effect.skills && !effect.skills.includes('all') && !effect.skills.includes(taskSkill)) {
        return { applied: false, reason: 'skill_mismatch' };
    }

    switch (effect.type) {
        case 'xp_skill':
            return applyXpBonus(effect, taskSkill, hero, context);

        case 'output_double':
            return applyOutputDouble(effect, context);

        case 'output_fail_chance':
            return applyOutputFailChance(effect, context);

        case 'damage':
        case 'dodge':
        case 'drink_effect':
            // Stubs for future implementation
            logger.debug('EffectProcessor', `Stub effect: ${effect.type} (+${(effect.bonus * 100).toFixed(0)}%)`);
            return { applied: true, type: effect.type, stub: true };

        default:
            console.warn(`[EffectProcessor] Unknown effect type: ${effect.type}`);
            return { applied: false, reason: 'unknown_type' };
    }
}

/**
 * Apply XP bonus effect
 * Accumulates bonus percentage in context.xpBonus
 * @param {Object} effect - Effect with bonus percentage
 * @param {string} taskSkill - The skill to grant XP for
 * @param {Object} hero - The hero
 * @param {Object} context - Context to accumulate XP bonus
 * @returns {Object} Result
 */
function applyXpBonus(effect, taskSkill, hero, context) {
    // Accumulate XP bonus in context (additive stacking)
    context.xpBonus = (context.xpBonus || 0) + effect.bonus;

    logger.debug('EffectProcessor', `XP Bonus: +${(effect.bonus * 100).toFixed(0)}% for ${taskSkill} (total: +${(context.xpBonus * 100).toFixed(0)}%)`);

    return {
        applied: true,
        type: 'xp_skill',
        skill: taskSkill,
        bonus: effect.bonus
    };
}

/**
 * Apply output double chance effect
 * @param {Object} effect - Effect with bonus percentage (chance to double)
 * @param {Object} context - Context to store double output flag
 * @returns {Object} Result
 */
function applyOutputDouble(effect, context) {
    // Roll for double output
    const roll = Math.random();
    const doubled = roll < effect.bonus;

    if (doubled) {
        context.doubleOutput = true;
        logger.debug('EffectProcessor', `Output Double triggered! (rolled ${roll.toFixed(3)} < ${effect.bonus})`);
    } else {
        logger.debug('EffectProcessor', `Output Double missed (rolled ${roll.toFixed(3)} >= ${effect.bonus})`);
    }

    return {
        applied: true,
        type: 'output_double',
        chance: effect.bonus,
        triggered: doubled
    };
}

/**
 * Apply output fail chance effect (Guild Hall debuff)
 * When triggered, task completes but produces no outputs
 * @param {Object} effect - Effect with bonus percentage (chance to fail)
 * @param {Object} context - Context to store output failed flag
 * @returns {Object} Result
 */
function applyOutputFailChance(effect, context) {
    // Roll for output failure
    const roll = Math.random();
    const failed = roll < effect.bonus;

    if (failed) {
        context.outputFailed = true;
        logger.debug('EffectProcessor', `Output FAILED! (rolled ${roll.toFixed(3)} < ${effect.bonus})`);
    } else {
        logger.debug('EffectProcessor', `Output success (rolled ${roll.toFixed(3)} >= ${effect.bonus})`);
    }

    return {
        applied: true,
        type: 'output_fail_chance',
        chance: effect.bonus,
        triggered: failed
    };
}

/**
 * Calculate effective tick time modifier from speed effects
 * Called during task spawning (not completion)
 * @param {Array} effects - Array of effect objects
 * @param {string} taskSkill - The skill used by the task
 * @returns {number} Multiplier for baseTickTime (e.g., 0.95 for -5%)
 */
export function calculateSpeedModifier(effects, taskSkill) {
    if (!effects || effects.length === 0) {
        return 1.0;
    }

    let multiplier = 1.0;

    for (const effect of effects) {
        if (effect.type === 'speed_skill') {
            // Check if effect applies: 'all' matches every skill
            const applies = effect.skills?.includes('all') || effect.skills?.includes(taskSkill);
            if (applies) {
                multiplier -= effect.bonus; // Positive bonus = faster, negative = slower
            }
        }
    }

    return Math.max(0.1, multiplier); // Minimum 10% of original time (cap at 10x slower)
}

export default {
    applyTaskEffects,
    calculateSpeedModifier
};

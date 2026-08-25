// Fantasy Guild - Skill System
// Phase 8: Skill System + ModifierAggregator

import { EventBus } from '../core/EventBus.js';
import * as HeroManager from './HeroManager.js';
import { levelFromXp, getXpProgress } from '../../utils/XPCurve.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { logger } from '../../utils/Logger.js';
import { XpRateTracker } from './XpRateTracker.js';

/**
 * SkillSystem - Manages skill XP, levels, and requirements
 *
 * Responsibilities:
 * - Add XP to hero skills
 * - Calculate effective skill levels (with modifiers)
 * - Check **possession** and level requirements
 * - Handle level-up events
 *
 * ## Possession is now a real state
 * A hero holds 6 of the world's 27 skills. `hero.skills[id]` being **absent**
 * is no longer a bug or an edge case — it is the ordinary way of saying *this
 * hero cannot do that work, at any level*. Every read here distinguishes it
 * from "holds it, at level 0", and callers must too.
 *
 * Sub-skill funnelling is gone with the 15-skill system: an id is a skill or
 * it is nothing.
 */

/**
 * Whether a hero holds a skill at all — the possession half of the gate.
 *
 * This is deliberately separate from `getSkillLevel`: a level of `null` and a
 * level of 0 mean different things, and collapsing them is what produced the
 * `skillRequired: 0` hole the Phase 0 baseline pinned.
 *
 * @param {string} heroId
 * @param {string} skillId
 * @returns {boolean}
 */
export function heroHasSkill(heroId, skillId) {
    const hero = HeroManager.getHero(heroId);
    return !!hero?.skills?.[skillId];
}

/**
 * Every skill id a hero currently holds.
 * @param {string} heroId
 * @returns {string[]}
 */
export function getHeldSkillIds(heroId) {
    const hero = HeroManager.getHero(heroId);
    return hero?.skills ? Object.keys(hero.skills) : [];
}

/**
 * Get a hero's base skill level (no modifiers).
 * @returns {number|null} `null` when the hero does not hold the skill.
 */
export function getSkillLevel(heroId, skillId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return null;

    const skill = hero.skills[skillId];
    if (!skill) return null;

    return skill.level;
}

/**
 * Get a hero's skill XP.
 * @returns {number|null} `null` when the hero does not hold the skill.
 */
export function getSkillXp(heroId, skillId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return null;

    const skill = hero.skills[skillId];
    if (!skill) return null;

    return skill.xp;
}

/**
 * Get XP multiplier for a skill based on Unified Modifiers
 * @param {string} heroId 
 * @param {string} skillId 
 * @returns {number} Multiplier (1.0 = base, 1.1 = +10%, etc.)
 */
export function getXpMultiplier(heroId, skillId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero || !hero.aggregator) return 1.0;

    const targetSkillId = skillId;

    // Use unified aggregator for all bonuses (Class, Trait, Equipment, etc.).
    // Three-Bucket (§15.3): resolve the multiplier and percentage buckets in
    // sequence. XP bonuses are authored as percentages (a class bonus of 0.10
    // means +10%), so in practice the percentage bucket does the work here and
    // several of them SUM — +10% and +10% give +20%, not ×1.21.
    return hero.aggregator.getMultiplierBucket(EFFECT_TYPES.XP_GAIN, targetSkillId)
         * hero.aggregator.getPercentageBucket(EFFECT_TYPES.XP_GAIN, targetSkillId);
}

/**
 * Get a hero's effective skill level (base + modifiers)
 * @param {string} heroId 
 * @param {string} skillId 
 * @returns {number|null}
 */
export function getEffectiveLevel(heroId, skillId) {
    const baseLevel = getSkillLevel(heroId, skillId);
    if (baseLevel === null) return null;

    // For now, just return base level
    // ModifierAggregator will add bonuses from equipment, perks, etc.
    // TODO: Integrate with ModifierAggregator when those systems exist
    return baseLevel;
}

/**
 * Add XP to a hero's skill.
 *
 * A hero only gains XP in a skill they **hold**. Awarding XP to a skill a hero
 * does not have is not an error to swallow silently — it means something tried
 * to make them do work they cannot do, and the caller should have checked.
 *
 * @param {string} heroId
 * @param {string} skillId
 * @param {number} amount - XP to add
 * @returns {{ success: boolean, levelsGained?: number, newLevel?: number, error?: string }}
 */
export function addXP(heroId, skillId, amount) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) {
        return { success: false, error: 'HERO_NOT_FOUND' };
    }

    if (hero.isVillager) {
        return { success: false, error: 'VILLAGERS_CANNOT_GAIN_XP' };
    }

    const targetSkillId = skillId;

    const skill = hero.skills[targetSkillId];
    if (!skill) {
        // The hero does not hold this skill (or the id does not exist).
        return { success: false, error: 'SKILL_NOT_HELD' };
    }

    const oldLevel = skill.level;
    skill.xp += amount;

    // Track rolling XP throughput
    XpRateTracker.recordGain(heroId, targetSkillId, amount);

    // Calculate new level from total XP
    const newLevel = levelFromXp(skill.xp);
    const levelsGained = newLevel - oldLevel;

    if (levelsGained > 0) {
        skill.level = newLevel;

        // NEW: Update hero's aggregator with new skill modifiers
        HeroManager.updateHeroSkillModifiers(hero);

        // Publish level-up event for each level gained
        for (let i = oldLevel + 1; i <= newLevel; i++) {
            EventBus.publish('hero_leveled', {
                heroId,
                heroName: hero.name,
                skillId: targetSkillId,
                subSkillId: skillId !== targetSkillId ? skillId : null,
                newLevel: i,
                oldLevel: i - 1,
                startLevel: oldLevel,
                skillName: getSkill(targetSkillId)?.name || targetSkillId
            });
            logger.debug('SkillSystem', `Hero ${hero.name} LEVELED UP to ${i} in ${targetSkillId}!`);
        }
    }

    // Fires on EVERY XP grant, so every work cycle of every staffed tile. As a
    // raw console.log this shipped to production and ran a template literal per
    // grant; logger.debug no-ops when import.meta.env.DEV is false.
    logger.debug('SkillSystem', `Hero ${hero.name} gained ${amount} XP in ${targetSkillId} (Sub: ${skillId}). New XP: ${skill.xp}`);

    // Always publish heroes_updated so UI refreshes with new XP
    EventBus.publish('heroes_updated', { source: 'addXP', heroId, skillId: targetSkillId });

    return {
        success: true,
        levelsGained,
        newLevel: skill.level,
        totalXp: skill.xp,
        targetSkillId
    };
}

/**
 * Why a hero cannot satisfy a skill requirement — or `null` if they can.
 *
 * Two failures, deliberately distinguished. They are different problems and
 * the player fixes them in completely different ways:
 *
 * * `POSSESSION` — *this hero can never do this work.* The fix is a different
 *   hero, or promoting this one into a job that grants the skill.
 * * `LEVEL` — *this hero isn't good enough yet.* The fix is time.
 *
 * @param {string} heroId
 * @param {{ skill: string, level: number }} requirement
 * @returns {'POSSESSION'|'LEVEL'|null}
 */
export function requirementFailure(heroId, requirement) {
    if (!requirement || !requirement.skill) return null;

    if (!heroHasSkill(heroId, requirement.skill)) return 'POSSESSION';

    const effectiveLevel = getEffectiveLevel(heroId, requirement.skill);
    if (effectiveLevel === null) return 'POSSESSION';

    return effectiveLevel >= (requirement.level || 0) ? null : 'LEVEL';
}

/**
 * Check if a hero meets a skill requirement — possession first, then level.
 * @param {string} heroId
 * @param {{ skill: string, level: number }} requirement
 * @returns {boolean}
 */
export function meetsRequirement(heroId, requirement) {
    return requirementFailure(heroId, requirement) === null;
}

/**
 * Get XP progress for a skill (percentage to next level)
 * @param {string} heroId 
 * @param {string} skillId 
 * @returns {{ level: number, currentXp: number, xpForNext: number, progress: number }|null}
 */
export function getSkillProgress(heroId, skillId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return null;

    const skill = hero.skills[skillId];
    if (!skill) return null;

    return getXpProgress(skill.xp);
}

/**
 * Get all skills for a hero with their levels
 * @param {string} heroId 
 * @returns {Object|null} { skillId: { level, xp, name, icon } }
 */
export function getAllSkills(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return null;

    const result = {};
    for (const [skillId, skillData] of Object.entries(hero.skills)) {
        const skillInfo = getSkill(skillId);
        result[skillId] = {
            ...skillData,
            name: skillInfo?.name || skillId,
            icon: skillInfo?.icon || '?',
            category: skillInfo?.category || 'unknown'
        };
    }

    return result;
}

/**
 * Get total skill levels for hero level calculation
 * @param {string} heroId 
 * @returns {number}
 */
export function getTotalSkillLevels(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return 0;

    return Object.values(hero.skills).reduce((sum, skill) => sum + skill.level, 0);
}

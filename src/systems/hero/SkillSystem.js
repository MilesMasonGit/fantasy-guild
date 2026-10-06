import { EventBus } from '../core/EventBus.js';
import * as HeroManager from './HeroManager.js';
import { levelFromXp, getXpProgress } from '../../utils/XPCurve.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { logger } from '../../utils/Logger.js';
import { XpRateTracker } from './XpRateTracker.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * SkillSystem - skill XP, levels and requirements.
 *
 * Possession is a real state: `hero.skills[id]` being absent means this hero
 * cannot do that work at any level, which is different from "holds it at level
 * 0". Every read here distinguishes them, and callers must too. An id that is
 * not a skill id resolves to nothing.
 */

/**
 * Whether a hero holds a skill at all — the possession half of the gate.
 *
 * Separate from `getSkillLevel` on purpose: a level of `null` and a level of 0
 * mean different things, and collapsing them produced the `skillRequired: 0` hole.
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
 * Get XP multiplier for a skill from the HERO's own scope (gear, statuses and
 * guild perks attached to the person). Applied in `addXP`.
 *
 * @param {string} heroId
 * @param {string} skillId
 * @returns {number} Multiplier (1.0 = base, 1.1 = +10%, etc.)
 */
export function getXpMultiplier(heroId, skillId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero || !hero.aggregator) return 1.0;

    const targetSkillId = skillId;

    // XP bonuses are authored as percentages, which SUM (+10% and +10% give
    // +20%, not ×1.21).
    return hero.aggregator.getMultiplierBucket(EFFECT_TYPES.XP_BONUS, targetSkillId)
         * hero.aggregator.getPercentageBucket(EFFECT_TYPES.XP_BONUS, targetSkillId);
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

    // Effective level is currently just the base level; no modifiers are applied.
    return baseLevel;
}

/**
 * Add XP to a hero's skill.
 *
 * A hero only gains XP in a skill they **hold**; awarding XP for one they lack
 * means the caller should have checked.
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
        return { success: false, error: 'SKILL_NOT_HELD' };
    }

    // The hero's own XP bonuses land here, and ONLY here, so +10% Cooking XP is
    // worth the same however the XP was earned. Never rounded to 0: a bonus must
    // not turn a 1 XP award into 0.
    const scaled = Math.round(amount * getXpMultiplier(heroId, targetSkillId));
    const granted = amount > 0 ? Math.max(1, scaled) : scaled;

    const oldLevel = skill.level;
    skill.xp += granted;

    // Record what the hero actually banked, not the pre-bonus figure, so the
    // rate readout matches the bar it describes.
    XpRateTracker.recordGain(heroId, targetSkillId, granted);

    const newLevel = levelFromXp(skill.xp);
    const levelsGained = newLevel - oldLevel;

    if (levelsGained > 0) {
        skill.level = newLevel;

        HeroManager.updateHeroSkillModifiers(hero);

        for (let i = oldLevel + 1; i <= newLevel; i++) {
            EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, {
                heroId,
                heroName: hero.name,
                skillId: targetSkillId,
                newLevel: i,
                oldLevel: i - 1,
                startLevel: oldLevel,
                skillName: getSkill(targetSkillId)?.name || targetSkillId
            });
            logger.debug('SkillSystem', `Hero ${hero.name} LEVELED UP to ${i} in ${targetSkillId}!`);
        }
    }

    // ⚠️ Fires on every XP grant; logger.debug no-ops outside DEV, where a raw
    // console.log would run a template literal per grant in production.
    logger.debug('SkillSystem', `Hero ${hero.name} gained ${granted} XP in ${targetSkillId} (base ${amount}). New XP: ${skill.xp}`);

    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'addXP', heroId, skillId: targetSkillId });

    return {
        success: true,
        levelsGained,
        newLevel: skill.level,
        totalXp: skill.xp,
        granted,
        targetSkillId
    };
}

/**
 * Why a hero cannot satisfy a skill requirement, or `null` if they can.
 *
 * `POSSESSION`: this hero can never do this work (fix: a different hero, or a
 * promotion into a job that grants the skill).
 * `LEVEL`: not good enough yet (fix: time).
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

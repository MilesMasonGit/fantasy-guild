// Fantasy Guild - Skill System
// Phase 8: Skill System + ModifierAggregator

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { getHero } from './HeroManager.js';
import { xpForLevel, levelFromXp, getXpProgress } from '../../utils/XPCurve.js';
import { getSkill, SKILLS, classHasSkill, traitHasSkill } from '../../config/registries/index.js';

/**
 * SkillSystem - Manages skill XP, levels, and requirements
 * 
 * Responsibilities:
 * - Add XP to hero skills
 * - Calculate effective skill levels (with modifiers)
 * - Check skill requirements
 * - Handle level-up events
 */

/**
 * Get a hero's base skill level (no modifiers)
 * @param {string} heroId 
 * @param {string} skillId 
 * @returns {number|null}
 */
export function getSkillLevel(heroId, skillId) {
    const hero = getHero(heroId);
    if (!hero) return null;

    const skill = hero.skills[skillId];
    if (!skill) return null;

    return skill.level;
}

/**
 * Get a hero's skill XP
 * @param {string} heroId 
 * @param {string} skillId 
 * @returns {number|null}
 */
export function getSkillXp(heroId, skillId) {
    const hero = getHero(heroId);
    if (!hero) return null;

    const skill = hero.skills[skillId];
    if (!skill) return null;

    return skill.xp;
}

/**
 * Get XP multiplier for a skill based on Class/Trait bonuses
 * @param {string} heroId 
 * @param {string} skillId 
 * @returns {number} Multiplier (1.0 = base, 1.1 = +10%, 1.2 = +20%)
 */
export function getXpMultiplier(heroId, skillId) {
    const hero = getHero(heroId);
    if (!hero) return 1.0;

    let multiplier = 1.0;

    // +10% if skill is in Class bonus list
    if (classHasSkill(hero.classId, skillId)) {
        multiplier += 0.10;
    }

    // +10% if skill is in Trait bonus list
    if (traitHasSkill(hero.traitId, skillId)) {
        multiplier += 0.10;
    }

    return multiplier;
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
 * Add XP to a hero's skill
 * @param {string} heroId 
 * @param {string} skillId 
 * @param {number} amount - XP to add
 * @returns {{ success: boolean, levelsGained?: number, newLevel?: number, error?: string }}
 */
export function addXP(heroId, skillId, amount) {
    const hero = getHero(heroId);
    if (!hero) {
        return { success: false, error: 'HERO_NOT_FOUND' };
    }

    const skill = hero.skills[skillId];
    if (!skill) {
        return { success: false, error: 'SKILL_NOT_FOUND' };
    }

    const oldLevel = skill.level;
    skill.xp += amount;

    // Calculate new level from total XP
    const newLevel = levelFromXp(skill.xp);
    const levelsGained = newLevel - oldLevel;

    if (levelsGained > 0) {
        skill.level = newLevel;

        // Publish level-up event for each level gained
        for (let i = oldLevel + 1; i <= newLevel; i++) {
            EventBus.publish('hero_leveled', {
                heroId,
                skillId,
                newLevel: i,
                skillName: getSkill(skillId)?.name || skillId
            });
        }
    }

    // Always publish heroes_updated so UI refreshes with new XP
    EventBus.publish('heroes_updated', { source: 'addXP' });

    return {
        success: true,
        levelsGained,
        newLevel: skill.level,
        totalXp: skill.xp
    };
}

/**
 * Check if a hero meets a skill requirement
 * @param {string} heroId 
 * @param {{ skill: string, level: number }} requirement 
 * @returns {boolean}
 */
export function meetsRequirement(heroId, requirement) {
    if (!requirement) return true;

    const effectiveLevel = getEffectiveLevel(heroId, requirement.skill);
    if (effectiveLevel === null) return false;

    return effectiveLevel >= requirement.level;
}

/**
 * Get XP progress for a skill (percentage to next level)
 * @param {string} heroId 
 * @param {string} skillId 
 * @returns {{ level: number, currentXp: number, xpForNext: number, progress: number }|null}
 */
export function getSkillProgress(heroId, skillId) {
    const hero = getHero(heroId);
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
    const hero = getHero(heroId);
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
    const hero = getHero(heroId);
    if (!hero) return 0;

    return Object.values(hero.skills).reduce((sum, skill) => sum + skill.level, 0);
}

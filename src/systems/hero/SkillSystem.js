// Fantasy Guild - Skill System
// Phase 8: Skill System + ModifierAggregator

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import * as HeroManager from './HeroManager.js';
import { xpForLevel, levelFromXp, getXpProgress } from '../../utils/XPCurve.js';
import { getSkill, SKILLS, SUB_SKILL_TO_PARENT } from '../../config/registries/index.js';
import { EFFECT_TYPES } from '../effects/constants.js';

/**
 * SkillSystem - Manages skill XP, levels, and requirements
 * 
 * Responsibilities:
 * - Add XP to hero skills (with Sub-skill funneling)
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
    const hero = HeroManager.getHero(heroId);
    if (!hero) return null;

    // Resolve sub-skill to parent for searching
    const targetSkillId = SUB_SKILL_TO_PARENT[skillId] || skillId;
    const skill = hero.skills[targetSkillId];
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
    const hero = HeroManager.getHero(heroId);
    if (!hero) return null;

    const targetSkillId = SUB_SKILL_TO_PARENT[skillId] || skillId;
    const skill = hero.skills[targetSkillId];
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

    const targetSkillId = SUB_SKILL_TO_PARENT[skillId] || skillId;
    
    // Use unified aggregator for all bonuses (Class, Trait, Equipment, etc.)
    return hero.aggregator.getMultiplier(EFFECT_TYPES.XP_GAIN, targetSkillId);
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
 * Add XP to a hero's skill (resolved to parent)
 * @param {string} heroId 
 * @param {string} skillId - Can be a parent skill (industry) or sub-skill tag (mining)
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

    // NEW: Resolve Sub-skill to Parent for XP funneling
    const targetSkillId = SUB_SKILL_TO_PARENT[skillId] || skillId;
    
    // SAFETY: Explicitly block XP for the deprecated 'defence' skill
    if (targetSkillId === 'defence') {
        return { success: false, error: 'SKILL_DEPRECATED' };
    }

    const skill = hero.skills[targetSkillId];
    if (!skill) {
        // If the hero doesn't have the skill (e.g. non-specialized combat skill), they gain 0 XP
        return { success: false, error: 'SKILL_NOT_AVAILABLE' };
    }

    const oldLevel = skill.level;
    skill.xp += amount;

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
                skillName: getSkill(targetSkillId)?.name || targetSkillId
            });
            console.log(`[SkillSystem] Hero ${hero.name} LEVELED UP to ${i} in ${targetSkillId}!`);
        }
    }

    console.log(`[SkillSystem] Hero ${hero.name} gained ${amount} XP in ${targetSkillId} (Sub: ${skillId}). New XP: ${skill.xp}`);

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

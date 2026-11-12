import { EventBus } from '../core/EventBus.js';
import * as HeroManager from './HeroManager.js';
import * as EquipmentManager from '../equipment/EquipmentManager.js';
import { levelFromXp } from '../../utils/XPCurve.js';
import { applyXpBonus } from './xpBonus.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { logger } from '../../utils/Logger.js';
import { XpRateTracker } from './XpRateTracker.js';
import { addXpToEverySkill } from './everySkillXp.js';
import { ENGINE_EVENTS, XP_FOR_EVERYONE_SOURCE } from '../core/engineEvents.js';

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

export { applyXpBonus };

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

    // ⚠️ No XP bonus is applied here: the caller passes the award already resolved, because a
    // bonus belongs to the skill the XP was earned in and is resolved where it is earned (a work
    // cycle in `BoardRunner`, a kill in `CombatResolutionProcessor`), through the Token's, the
    // guild's and the hero's scopes at once. Applying one here as well would count it twice.
    const rounded = Math.round(amount);
    const granted = amount > 0 ? Math.max(1, rounded) : rounded;

    const oldLevel = skill.level;
    skill.xp += granted;

    // Record what the hero actually banked, not the pre-bonus figure, so the
    // rate readout matches the bar it describes.
    XpRateTracker.recordGain(heroId, targetSkillId, granted);

    const newLevel = levelFromXp(skill.xp);
    const levelsGained = newLevel - oldLevel;

    if (levelsGained > 0) {
        skill.level = newLevel;

        HeroManager.updateHeroFromSkills(hero);
        // A level can change what the hero's carried rules lend in a fight: a perk reached, or gear
        // whose level they now meet. Work and fight rules are read live; the combat numbers are
        // registered, so they are registered again.
        EquipmentManager.recalculateEquipmentModifiers(hero);

        announceLevelUps(hero, targetSkillId, oldLevel, newLevel);
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
 * Say a skill's rise as the level events every level-up is said in: one `HERO_LEVELED` a level, each
 * carrying the level the rise began at (`startLevel`), so the float rolls and the recipe banner is one.
 * `extra` joins each payload.
 */
function announceLevelUps(hero, skillId, oldLevel, newLevel, extra = null) {
    const skillName = getSkill(skillId)?.name || skillId;
    for (let i = oldLevel + 1; i <= newLevel; i++) {
        EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, {
            heroId: hero.id,
            heroName: hero.name,
            skillId,
            newLevel: i,
            oldLevel: i - 1,
            startLevel: oldLevel,
            skillName,
            ...extra
        });
        logger.debug('SkillSystem', `Hero ${hero.name} LEVELED UP to ${i} in ${skillId}!`);
    }
}

/**
 * Give a hero `amount` XP in every skill they hold at once: the Guild Hall's XP for Everyone. Each
 * skill that rises is said as any level-up is (`HERO_LEVELED`, marked `source: XP_FOR_EVERYONE_SOURCE`),
 * once the hero's derived stats are in step. Not counted towards XP an hour: it was not earned working.
 *
 * ⚠️ Says this hero's level-ups before the caller gives the next hero theirs: the recipe banner
 * reads the rest of the guild's best level as it hears each one.
 *
 * @param {string} heroId
 * @param {number} amount whole XP
 * @returns {Array<{ skillId: string, skillName: string, oldLevel: number, newLevel: number }>|null}
 *   the skills that gained a level, or null when the hero gained nothing (no such hero, a villager)
 */
export function giveXpInEverySkill(heroId, amount) {
    const hero = HeroManager.getHero(heroId);
    if (!hero || hero.isVillager || !(Math.round(amount) >= 1)) return null;
    const levelUps = addXpToEverySkill(hero, amount);
    if (levelUps.length) {
        HeroManager.updateHeroFromSkills(hero);
        EquipmentManager.recalculateEquipmentModifiers(hero);
        for (const l of levelUps) announceLevelUps(hero, l.skillId, l.oldLevel, l.newLevel, { source: XP_FOR_EVERYONE_SOURCE });
    }
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: XP_FOR_EVERYONE_SOURCE, heroId });
    return levelUps;
}

/**
 * Why a hero cannot satisfy a skill requirement, or `null` if they can.
 *
 * `POSSESSION`: this hero can never do this work (fix: a different hero, or a
 * a skill the game no longer has).
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

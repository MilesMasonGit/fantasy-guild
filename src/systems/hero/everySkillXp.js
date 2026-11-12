import { levelFromXp } from '../../utils/XPCurve.js';
import { getSkill } from '../../config/registries/skillRegistry.js';

/**
 * Add `amount` XP to every skill a hero holds, each skill's level kept in step with its XP: the
 * Guild Hall's XP for Everyone, given at a purchase (`SkillSystem.giveXpInEverySkill`) or brought by
 * a hero who joins (`HeroLifecycle`). Touches only the hero's sheet: no event, no XP-an-hour reading
 * (the gift was not earned working), no derived stat. A villager gains nothing.
 *
 * ⚠️ Imports nothing that reaches `HeroManager`: `HeroLifecycle` calls it, and `HeroManager` imports
 * `HeroLifecycle`.
 *
 * @param {object} hero
 * @param {number} amount whole XP; nothing below 1
 * @returns {Array<{ skillId: string, skillName: string, oldLevel: number, newLevel: number }>} the
 *   skills that gained a level, in the sheet's order
 */
export function addXpToEverySkill(hero, amount) {
    const xp = Math.round(Number(amount) || 0);
    if (!hero || hero.isVillager || xp < 1 || !hero.skills) return [];
    const levelUps = [];
    for (const [skillId, skill] of Object.entries(hero.skills)) {
        if (!skill) continue;
        const oldLevel = skill.level;
        skill.xp = (Number(skill.xp) || 0) + xp;
        const newLevel = levelFromXp(skill.xp);
        if (newLevel > oldLevel) {
            skill.level = newLevel;
            levelUps.push({ skillId, skillName: getSkill(skillId)?.name || skillId, oldLevel, newLevel });
        }
    }
    return levelUps;
}

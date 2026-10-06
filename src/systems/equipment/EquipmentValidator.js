import { getItem } from '../../config/registries/itemRegistry.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { isEquipCategory } from '../../config/registries/equipmentConstants.js';

/**
 * Whether an item can go in a grid slot at all: every slot accepts every item, so
 * the only question is whether the item declares a real category. The
 * per-category cap is enforced by EquipmentManager, which can see the whole grid.
 */
export function canEquipToSlot(itemId) {
    const template = getItem(itemId);
    if (!template) return false;
    return isEquipCategory(template.equipSlot);
}

/**
 * Check if a hero meets the skill requirements to equip an item
 * @returns {{ canEquip: boolean, reason?: string }}
 */
export function canHeroEquip(heroId, itemId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return { canEquip: false, reason: 'Hero not found' };

    if (hero.isVillager) {
        return { canEquip: false, reason: 'Villagers cannot equip items.' };
    }

    const template = getItem(itemId);
    if (!template) return { canEquip: false, reason: 'Item not found' };

    // ⚠️ A hero who does not HOLD the skill is refused outright with its own reason:
    // `getSkillLevel` returns null for an unheld skill, and `null < 1` is true only
    // by coercion, which would read as "level too low" for something no amount of
    // levelling can fix.
    const checkSkill = (skillId, level) => {
        if (!SkillSystem.heroHasSkill(heroId, skillId)) {
            return { canEquip: false, reason: `Needs the ${skillId} skill` };
        }
        if ((SkillSystem.getSkillLevel(heroId, skillId) ?? 0) < level) {
            return { canEquip: false, reason: `Requires ${skillId} level ${level}` };
        }
        return null;
    };

    if (Array.isArray(template.requirements)) {
        for (const req of template.requirements) {
            if (req.skill && req.level) {
                const failure = checkSkill(req.skill, req.level);
                if (failure) return failure;
            }
        }
    }

    // Legacy single skill/level pair.
    if (template.skillRequired && template.levelRequired) {
        const failure = checkSkill(template.skillRequired, template.levelRequired);
        if (failure) return failure;
    }

    return { canEquip: true };
}

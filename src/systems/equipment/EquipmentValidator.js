// Fantasy Guild - Equipment Validator
// Phase 40: Equipment Architecture Evolution

import { getItem } from '../../config/registries/itemRegistry.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { isEquipCategory } from '../../config/registries/equipmentConstants.js';

/**
 * Whether an item can go in a grid slot at all.
 *
 * Every slot accepts every item (D-7), so position is irrelevant — the only
 * question is whether the item declares a real category. The per-category cap
 * is enforced by EquipmentManager, which can see the whole grid.
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

    // Food, drink and consumables live on the hero again (D-4/D-7), sharing
    // the one flexible grid with gear. This reverses CR-029, which had moved
    // drinks to a station slot and food to deck cards.

    // Skill requirements, possession first.
    //
    // ⚠️ A hero who does not HOLD the skill is refused outright, and the reason
    // has to say so — `getSkillLevel` returns null for an unheld skill, and
    // `null < 1` is true only by coercion, which would have read as "level too
    // low" for something no amount of levelling can fix. This is why a Recruit
    // cannot pick up a sword: wielding one needs Melee, and they have none.
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

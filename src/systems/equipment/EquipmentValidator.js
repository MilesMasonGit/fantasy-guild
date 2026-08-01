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

    // Check Multiple Requirements
    if (Array.isArray(template.requirements)) {
        for (const req of template.requirements) {
            if (req.skill && req.level) {
                const skillLevel = SkillSystem.getSkillLevel(heroId, req.skill);
                if (skillLevel < req.level) {
                    return {
                        canEquip: false,
                        reason: `Requires ${req.skill} level ${req.level}`
                    };
                }
            }
        }
    }

    // Check Legacy Skill & Level Requirement
    if (template.skillRequired && template.levelRequired) {
        const skillLevel = SkillSystem.getSkillLevel(heroId, template.skillRequired);
        if (skillLevel < template.levelRequired) {
            return {
                canEquip: false,
                reason: `Requires ${template.skillRequired} level ${template.levelRequired}`
            };
        }
    }

    return { canEquip: true };
}

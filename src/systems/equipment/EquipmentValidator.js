// Fantasy Guild - Equipment Validator
// Phase 40: Equipment Architecture Evolution

import { getItem } from '../../config/registries/itemRegistry.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';

/**
 * Check if an item can be equipped to a specific slot
 */
export function canEquipToSlot(itemId, slotType) {
    const template = getItem(itemId);
    if (!template) return false;
    return template.equipSlot === slotType;
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

    // Consumables (Food/Drink) have no requirements
    if (template.equipSlot === 'food' || template.equipSlot === 'drink') {
        return { canEquip: true };
    }

    // Check Skill & Level Requirement
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

import { getItem } from '../../config/registries/itemRegistry.js';
import * as HeroManager from '../hero/HeroManager.js';
import { isEquipCategory } from '../../config/registries/equipmentConstants.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { unmetGearRequirement } from '../../config/registries/weaponStyles.js';
import { t } from '../../i18n/index.js';

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
 * Whether a hero meets an item's level requirements: a weapon's in its own style, armour's in the
 * style it names, and any `requirements` line. The refusal names the first one missing, "Needs
 * Melee 15".
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

    const unmet = unmetGearRequirement(template, hero);
    if (unmet) {
        // A skill the game no longer has keeps its raw id, so the content audit's name for it matches.
        const skill = getSkill(unmet.skill)?.name || unmet.skill;
        return { canEquip: false, reason: t('equipment.needsLevel', { skill, level: unmet.level }) };
    }

    return { canEquip: true };
}

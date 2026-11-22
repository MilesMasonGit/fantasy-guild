import { getItem } from '../../config/registries/itemRegistry.js';
import * as HeroManager from '../hero/HeroManager.js';
import { unmetGearRequirement } from '../../config/registries/weaponStyles.js';
import { t } from '../../i18n/index.js';
import { levelNeed } from '../core/levelNeed.js';

/**
 * Whether a hero meets an item's level requirements: a weapon's in its own style, armour's in the
 * style it names, and any `requirements` line. The refusal names the first one missing, "Needs
 * Melee 15 (Ana: 12)" (`levelNeed`), and `need.icons` places the skill icon in it for the hero bar.
 * @returns {{ canEquip: boolean, reason?: string,
 *   need?: { skill: string, level: number, have: number, icons: { skill: string, at: number }[] } }}
 */
export function canHeroEquip(heroId, itemId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return { canEquip: false, reason: t('equipment.notFound') };

    if (hero.isVillager) {
        return { canEquip: false, reason: t('equipment.villager') };
    }

    const template = getItem(itemId);
    if (!template) return { canEquip: false, reason: t('equipment.notFound') };

    const unmet = unmetGearRequirement(template, hero);
    if (unmet) {
        const need = levelNeed(unmet.skill, unmet.level, { hero: hero.name, have: unmet.have });
        return {
            canEquip: false,
            reason: need.text,
            need: { skill: unmet.skill, level: unmet.level, have: unmet.have, icons: need.icons }
        };
    }

    return { canEquip: true };
}

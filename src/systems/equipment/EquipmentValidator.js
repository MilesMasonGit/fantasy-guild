import { getItem } from '../../config/registries/itemRegistry.js';
import * as HeroManager from '../hero/HeroManager.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { unmetGearRequirement } from '../../config/registries/weaponStyles.js';
import { t } from '../../i18n/index.js';

/**
 * Whether a hero meets an item's level requirements: a weapon's in its own style, armour's in the
 * style it names, and any `requirements` line. The refusal names the first one missing, "Needs
 * Melee 15 (Ana: 12)", and `need` carries its skill so the hero bar can draw its icon.
 * @returns {{ canEquip: boolean, reason?: string, need?: { skill: string, level: number, have: number } }}
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
        // A skill the game no longer has keeps its raw id, so the content audit's name for it matches.
        const skill = getSkill(unmet.skill)?.name || unmet.skill;
        return {
            canEquip: false,
            reason: t('equipment.needsLevel', { skill, level: unmet.level, hero: hero.name, have: unmet.have }),
            need: { skill: unmet.skill, level: unmet.level, have: unmet.have }
        };
    }

    return { canEquip: true };
}

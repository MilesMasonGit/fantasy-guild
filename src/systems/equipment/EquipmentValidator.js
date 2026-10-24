import { getItem } from '../../config/registries/itemRegistry.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { isEquipCategory } from '../../config/registries/equipmentConstants.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { weaponRefusal, weaponStylesOf, WEAPON_REFUSAL } from '../../config/registries/weaponStyles.js';
import { getHeroCombatSkillEntry } from '../../utils/CombatFormulas.js';
import { t } from '../../i18n/index.js';

const styleName = (id) => getSkill(id)?.name || id;

/**
 * A weapon of another style, or any weapon for a Recruit, in the player's words; null when the hero
 * may hold it.
 */
function weaponStyleFailure(hero, template) {
    const style = getHeroCombatSkillEntry(hero).id;
    const refusal = weaponRefusal(template, style);
    if (refusal === WEAPON_REFUSAL.RECRUIT) {
        return { canEquip: false, reason: t('equipment.recruitWeapon', { hero: hero.name, item: template.name }) };
    }
    if (refusal === WEAPON_REFUSAL.STYLE) {
        return {
            canEquip: false,
            reason: t('equipment.wrongStyle', {
                hero: hero.name,
                style: styleName(style),
                item: template.name,
                styles: weaponStylesOf(template).map(styleName).join(' or ')
            })
        };
    }
    return null;
}

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

    const styleFailure = weaponStyleFailure(hero, template);
    if (styleFailure) return styleFailure;

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

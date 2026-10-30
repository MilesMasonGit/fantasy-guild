// Fantasy Guild — weapons: the one style a weapon fights in, and the level gear asks of its wearer
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`): the item
// editor's Weapon block and the audit read the styles from here. Keep it free of data loading.

import { COMBAT_SKILL_IDS, BAREHANDED_STYLE_ID, isSkillId } from './skillRegistry.js';
import { toolOf, HAND_CATEGORY } from './toolKinds.js';

/**
 * A weapon is anything held in the hands that is not a gathering tool. **The weapon decides the
 * style**: any hero may hold any weapon whose level requirement they meet, and fights in its style
 * (kills train that style's skill). `styles: ['melee']` on the item, one entry; an older list of
 * two (a Dagger was Melee and Stealth) reads its first and the audit lists it. Older content named
 * the style as `skillRequired`.
 */

/** Whether an item is a weapon: held in the hands, and not a gathering tool. */
export function isWeapon(item) {
    return item?.equipSlot === HAND_CATEGORY && !toolOf(item);
}

/**
 * The combat styles a weapon's content names, in the order written, combat skills only: `styles`
 * when it lists any, else an older item's `skillRequired` when that names a combat skill. More
 * than one is content to fix (the audit says so); the weapon fights in the first.
 *
 * @returns {string[]} combat skill ids
 */
export function authoredWeaponStyles(item) {
    if (!isWeapon(item)) return [];
    const authored = Array.isArray(item.styles) && item.styles.length
        ? item.styles
        : (item.skillRequired ? [item.skillRequired] : []);
    return authored.filter((id, i) => COMBAT_SKILL_IDS.includes(id) && authored.indexOf(id) === i);
}

/**
 * The one style a weapon fights in: the first it names, or {@link BAREHANDED_STYLE_ID} (Melee) when
 * it names none. Null for anything that is not a weapon.
 * @returns {string|null} a combat skill id
 */
export function weaponStyleOf(item) {
    if (!isWeapon(item)) return null;
    return authoredWeaponStyles(item)[0] || BAREHANDED_STYLE_ID;
}

const wholeLevel = (value) => {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n >= 1 ? n : null;
};

/**
 * The level a piece of gear asks of whoever wears it, or null: `levelRequired` on the item, in the
 * weapon's own style for a weapon ("Iron Sword: Melee 15"), in `skillRequired` for anything else
 * (armour names the style it is for).
 * @returns {{ skill: string, level: number }|null}
 */
export function gearLevelRequirement(item) {
    const level = wholeLevel(item?.levelRequired);
    if (!level) return null;
    if (isWeapon(item)) return { skill: weaponStyleOf(item), level };
    return isSkillId(item.skillRequired) ? { skill: item.skillRequired, level } : null;
}

/**
 * Every level an item asks for: its `requirements` list (any skill), then its
 * {@link gearLevelRequirement}. A skill named here that does not exist can never be met.
 * @returns {Array<{ skill: string, level: number }>}
 */
export function gearRequirements(item) {
    const out = [];
    for (const req of Array.isArray(item?.requirements) ? item.requirements : []) {
        const level = wholeLevel(req?.level);
        if (req?.skill && level) out.push({ skill: req.skill, level });
    }
    const own = gearLevelRequirement(item);
    if (own) out.push(own);
    return out;
}

/** A hero's level in a skill, 0 when they hold none of it. */
function levelOf(hero, skillId) {
    const s = hero?.skills?.[skillId];
    if (!s) return 0;
    return typeof s === 'number' ? s : (s.level || 0);
}

/**
 * The first level this item asks for that the hero does not have, or null when they meet them
 * all (or the item asks none).
 * @returns {{ skill: string, level: number, have: number }|null}
 */
export function unmetGearRequirement(item, hero) {
    for (const req of gearRequirements(item)) {
        const have = levelOf(hero, req.skill);
        if (have < req.level) return { ...req, have };
    }
    return null;
}

/**
 * Whether the hero meets every level this item asks. ⚠️ Gear they do not (worn before a
 * requirement was authored) stays in its slot and lends nothing; a weapon is not swung.
 */
export function meetsGearRequirements(item, hero) {
    return unmetGearRequirement(item, hero) === null;
}

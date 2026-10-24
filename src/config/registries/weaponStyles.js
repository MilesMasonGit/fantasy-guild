// Fantasy Guild — weapons: the styles a weapon belongs to, and who may hold one
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`): the item
// editor's Weapon block and the audit read the styles from here. Keep it free of data loading.

import { COMBAT_SKILL_IDS } from './skillRegistry.js';
import { toolOf, HAND_CATEGORY } from './toolKinds.js';

/**
 * A weapon is anything held in the hands that is not a gathering tool. Its style is one of the four
 * combat skills, or several (a Dagger is Melee and Stealth): `styles: ['melee', 'stealth']` on the
 * item. A hero equips only weapons of their own style, and a Recruit, who holds no combat skill,
 * none at all (they fight barehanded until promoted).
 *
 * Older content named one style as `skillRequired`; it is read as a one-style list.
 */

/** Whether an item is a weapon: held in the hands, and not a gathering tool. */
export function isWeapon(item) {
    return item?.equipSlot === HAND_CATEGORY && !toolOf(item);
}

/**
 * The combat styles a weapon belongs to, in the skill registry's order. `styles` when it lists any,
 * else an older item's `skillRequired` when that names a combat skill. Ids that are not combat
 * skills are dropped. Empty means the weapon names no style, and any promoted hero may hold it.
 *
 * @returns {string[]} combat skill ids
 */
export function weaponStylesOf(item) {
    if (!isWeapon(item)) return [];
    const authored = Array.isArray(item.styles) && item.styles.length
        ? item.styles
        : (item.skillRequired ? [item.skillRequired] : []);
    return COMBAT_SKILL_IDS.filter(id => authored.includes(id));
}

/** Why a weapon may not be held, as a word the equip refusal turns into a sentence. */
export const WEAPON_REFUSAL = Object.freeze({
    /** The hero holds no combat skill: a Recruit punches, whatever is in their hands. */
    RECRUIT: 'recruit',
    /** The weapon names styles and the hero's is not one of them. */
    STYLE: 'style'
});

/**
 * Why a hero fighting with combat skill `styleId` (null for a Recruit) may not hold this weapon,
 * or null when they may. Anything that is not a weapon is never refused here.
 *
 * @returns {string|null} a {@link WEAPON_REFUSAL} value, or null
 */
export function weaponRefusal(item, styleId) {
    if (!isWeapon(item)) return null;
    if (!styleId) return WEAPON_REFUSAL.RECRUIT;
    const styles = weaponStylesOf(item);
    if (styles.length && !styles.includes(styleId)) return WEAPON_REFUSAL.STYLE;
    return null;
}

/** Whether a hero fighting with combat skill `styleId` may hold and use this item. */
export function weaponUsableBy(item, styleId) {
    return weaponRefusal(item, styleId) === null;
}

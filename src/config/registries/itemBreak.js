// Fantasy Guild — tools and weapons that break: an item's chance per cycle
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`): the item
// editor's Break chance field and the audit read it. Pure: its imports are pure too.

import { toolOf } from './toolKinds.js';
import { isWeapon } from './weaponStyles.js';

/**
 * `breakChance` on an item: the percent chance, above 0 and up to 100, that it breaks when a cycle
 * it was used for completes (`systems/equipment/Breakage.js`). Only a gathering tool (at the end of
 * a work cycle on a Token that needs it) and a weapon (at each kill) are used that way; on anything
 * else the field means nothing. Absent, the item never breaks and nothing is drawn.
 */
export const BREAK_CHANCE_MAX = 100;

/** Whether an item is the kind of thing that can break: a gathering tool or a weapon. */
export function canBreak(item) {
    return !!toolOf(item) || isWeapon(item);
}

/** A written `breakChance` as a number above 0 and up to 100, or null when it is not one. */
function chanceValue(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 && n <= BREAK_CHANCE_MAX ? n : null;
}

/**
 * The percent chance this item breaks per cycle: its `breakChance` when it is a tool or a weapon
 * and the value is above 0 and up to 100, else 0 (never breaks).
 */
export function breakChanceOf(item) {
    if (!item || item.breakChance == null || !canBreak(item)) return 0;
    return chanceValue(item.breakChance) ?? 0;
}

/**
 * Why an item's `breakChance` does nothing, or null when it works (or is absent): a value that is
 * not a number above 0 and up to 100, or an item that is neither a tool nor a weapon. For the boot
 * audit and the CMS Economy Audit (`toolRule.js`).
 */
export function breakChanceProblem(item) {
    if (!item || item.breakChance == null) return null;
    if (chanceValue(item.breakChance) == null) {
        return `its Break chance "${item.breakChance}" is not a percent above 0 and up to ${BREAK_CHANCE_MAX}, so it never breaks`;
    }
    if (!canBreak(item)) return 'has a Break chance, but only a tool or a weapon breaks, so it never will';
    return null;
}

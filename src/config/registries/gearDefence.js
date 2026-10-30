// Fantasy Guild — gear's defence: the resistances a worn piece lends, and the damage it costs named styles
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`): the item
// editor's Defence block and the audits read the shapes from here. Keep it free of data loading.

import { isTypeOrGroupId } from './damageTypes.js';
import { COMBAT_SKILL_IDS } from './skillRegistry.js';
import { getCategoryDef, CATEGORY_KINDS } from './equipmentCategories.js';

/**
 * There is no flat Armour: a piece of gear lends **resistances** in percent, by damage type or
 * group, and every piece is a trade-off, listing a **damage cut** to named styles (owner, brief
 * 280: "Iron Chestplate: Physical resist 20 %; Magic damage −30 %, Stealth damage −15 %").
 *
 *   `resistances: { physical: 20, ice: -10 }` — percent off hits of that type or group the wearer
 *     takes; negative is a weakness. Lines add: a group's line counts on each of its types beside a
 *     type's own (the Type Resistance % rows do the same), unlike an enemy's, where a type's line
 *     replaces its group's.
 *   `damageCut: { magic: 30, stealth: 15 }` — percent off the wearer's hits while they fight in that
 *     style (the weapon's; Melee barehanded). Cuts from several pieces add, and 100 or more leaves
 *     nothing.
 *
 * Only worn gear lends them (a hand item, a hat, a chest, a trinket), and only while it lends at all:
 * held at its level, and for a weapon, the one swung (`HeroEffects`). No piece may take a hero to
 * 100 % in any type: the audit adds up the best stack the content allows (`gearDefenceRule.js`).
 */

/** The most a single line may say, either way; the audit names anything outside it. */
export const GEAR_RESIST_LINE_MAX = 99;

/** No hero's best stack may reach this in any type (owner: no cap, small numbers instead). */
export const GEAR_RESIST_STACK_LIMIT = 100;

/** Whether an item is worn gear: anything whose category is gear (hand, hat, chest, trinket). */
export function isWornGear(item) {
    return getCategoryDef(item?.equipSlot)?.kind === CATEGORY_KINDS.GEAR;
}

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * A worn piece's resistances as the engine reads them: known types and groups only, each a number
 * other than 0, held within ±100. Anything else is dropped (the audits name it). Empty for anything
 * that is not worn gear.
 * @returns {Object<string, number>}
 */
export function gearResistancesOf(item) {
    const out = {};
    if (!isWornGear(item) || !isPlainObject(item.resistances)) return out;
    for (const [id, value] of Object.entries(item.resistances)) {
        const n = Number(value);
        if (!isTypeOrGroupId(id) || !Number.isFinite(n) || n === 0) continue;
        out[id] = Math.max(-100, Math.min(100, n));
    }
    return out;
}

/**
 * A worn piece's damage cuts as the engine reads them: combat styles only, each a cut above 0 and at
 * most 100. Empty for anything that is not worn gear.
 * @returns {Object<string, number>}
 */
export function gearDamageCutOf(item) {
    const out = {};
    if (!isWornGear(item) || !isPlainObject(item.damageCut)) return out;
    for (const [style, value] of Object.entries(item.damageCut)) {
        const n = Number(value);
        if (!COMBAT_SKILL_IDS.includes(style) || !Number.isFinite(n) || n <= 0) continue;
        out[style] = Math.min(100, n);
    }
    return out;
}

/** Whether a resistance line is one the audit accepts: a whole number from −99 to 99, not 0. */
export function isGearResistLine(value) {
    const n = Number(value);
    return Number.isInteger(n) && n !== 0 && Math.abs(n) <= GEAR_RESIST_LINE_MAX;
}

/** Whether a damage cut is one the audit accepts: a whole number from 1 to 100. */
export function isDamageCut(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= 100;
}

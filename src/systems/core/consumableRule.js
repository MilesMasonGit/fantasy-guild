// Food, drinks and potions act only through their moment and their dose.

import { getCategoryDef, CATEGORY_KINDS } from '../../config/registries/equipmentCategories.js';
import { ELIXIR_FIGHTS, DRINK_CYCLES } from '../../config/loopConstants.js';

/**
 * The one rule behind how a carried food, drink or potion works, shared by the engine
 * (`HeroEffects`, `ConsumptionSystem`, `LoadoutMoments`), the CMS Item editor and the statement
 * editor, so all of them say the same thing.
 *
 * Owner rulings (2026-10-24, brief 230 S6b):
 * * **An elixir** (a Consumable with a rule on the fight-start moment) is drunk as a fight starts and
 *   lasts `ELIXIR_FIGHTS` fights.
 * * **A drink** (the Drink category, with a rule on a work moment) is drunk as a work cycle starts and
 *   lasts `DRINK_CYCLES` work cycles.
 * * **A work potion** (a Consumable with a rule on a work moment) is spent only when a cycle of its
 *   own skill starts, for that cycle: one potion, one cycle.
 * * **Nothing acts by sitting in the Bank**: an always-on rule (no moment) on a food, drink or
 *   potion does nothing. A shared item acts only through its moment and its dose.
 *
 * ⚠️ Kept free of the item and effect registries: the CMS imports it, and hands in the statements.
 */

/** The moment a carried rule waits on for its own hero starting a work cycle: "On Work Start". */
export const WORK_START = 'WORK_START';

/** The moment an elixir's rules wait on: a fight starting (each enemy engaged is one). */
export const FIGHT_START = 'COMBAT_ENGAGED';

/**
 * The moments a carried rule may wait on for its hero starting a work cycle: On Work Start, and the
 * older `CYCLE_START`, which a carried rule has always heard as its own hero's cycle starting.
 */
const WORK_MOMENTS = new Set([WORK_START, 'CYCLE_START']);

/** Whether a moment is a carried rule's work start. */
export function isWorkMoment(eventId) {
    return WORK_MOMENTS.has(eventId);
}

/**
 * Whether items of a category are spent from a shared Bank stack: food, drinks and potions. Gear,
 * weapons and tools are worn, and their always-on rules work while they are held.
 */
export function isSpentCategory(categoryId) {
    const kind = getCategoryDef(categoryId)?.kind;
    return kind === CATEGORY_KINDS.SUSTENANCE || kind === CATEGORY_KINDS.CONSUMABLE;
}

/** Whether a statement is always on: it names no moment. */
export function isAlwaysOn(statement) {
    return !!statement && !statement.when?.event;
}

/** The skill a carried work rule narrows to, or '' for any. */
export function workSkillOf(when) {
    return typeof when?.skill === 'string' ? when.skill : '';
}

/** Whether a carried rule on a work moment fires for a cycle of `skill`. No skill named is any. */
export function workSkillMatches(when, skill) {
    const named = workSkillOf(when);
    return !named || named === skill;
}

/** How a spent item is used. */
export const DOSE = Object.freeze({ ELIXIR: 'elixir', DRINK: 'drink', POTION: 'potion' });

/** How many of its moments one dose lasts. */
export const DOSE_LENGTH = Object.freeze({
    [DOSE.ELIXIR]: ELIXIR_FIGHTS,
    [DOSE.DRINK]: DRINK_CYCLES,
    [DOSE.POTION]: 1
});

/**
 * How an item of `categoryId` carrying `statements` is used: an elixir, a drink, a work potion.
 * Several when a Consumable waits on both a fight and a work cycle; none for food, gear, or a
 * Consumable with no moment rule (bait).
 *
 * @param {string} categoryId the item's `equipSlot`
 * @param {object[]} statements the item's statements, expanded from its effect references
 * @returns {string[]} `DOSE` values
 */
export function doseKindsOf(categoryId, statements) {
    const list = Array.isArray(statements) ? statements : [];
    const kind = getCategoryDef(categoryId)?.kind;
    const onFight = list.some(s => s?.when?.event === FIGHT_START);
    const onWork = list.some(s => isWorkMoment(s?.when?.event));
    const kinds = [];
    if (kind === CATEGORY_KINDS.CONSUMABLE && onFight) kinds.push(DOSE.ELIXIR);
    if (categoryId === 'drink' && onWork) kinds.push(DOSE.DRINK);
    if (kind === CATEGORY_KINDS.CONSUMABLE && onWork) kinds.push(DOSE.POTION);
    return kinds;
}

/** What the CMS says about each way of being used. */
export const DOSE_WHY = Object.freeze({
    [DOSE.ELIXIR]: `An elixir: one is drunk from the Bank as a fight starts and lasts ${ELIXIR_FIGHTS} fights (one number for every elixir). Its fight-start rules work from that dose.`,
    [DOSE.DRINK]: `A drink: one is drunk from the Bank as a work cycle starts and lasts ${DRINK_CYCLES} work cycles (one number for every drink). Its On Work Start rules work from that dose; a rule naming a skill counts only that skill's cycles.`,
    [DOSE.POTION]: 'A work potion: one is drunk from the Bank each time a work cycle of its skill starts, for that cycle. The hero keeps it while doing other work.'
});

/** What the CMS says about an always-on rule on a food, drink or potion. */
export const ALWAYS_ON_IDLE_WHY = 'Food, drinks and potions act only through a moment (On Work Start, or a fight starting): this always-on rule does nothing on one.';

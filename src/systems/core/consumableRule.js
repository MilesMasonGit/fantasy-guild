// Food, drinks and potions act only through their moment and their dose.

import { getCategoryDef, CATEGORY_KINDS } from '../../config/registries/equipmentCategories.js';
import { ELIXIR_FIGHTS, DRINK_CYCLES, WORK_POTION_CYCLES } from '../../config/loopConstants.js';
import { roundByChance, WHOLE_EPSILON } from '../../utils/RNG.js';

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
 * * **A work potion** (a Consumable with a rule on a work moment) is drunk only when a cycle of its
 *   own skill starts and lasts `WORK_POTION_CYCLES` cycles of that skill.
 * * **Nothing acts by sitting in the Bank**: an always-on rule (no moment) on a food, drink or
 *   potion does nothing. A shared item acts only through its moment and its dose.
 * * **A poison** (owner 2026-11-21, brief 750 S3: a Consumable whose fight-start rule applies its
 *   effect "for N attacks") is taken like an elixir as a fight starts, but only by a hero holding a
 *   Stealth weapon, and lasts N of its hero's attacks, hit or miss; what is left carries into later
 *   fights, and a fresh one is taken only as a fight starts.
 * * **One drink at a time** (owner 2026-11-26): drinks, work potions and elixirs are all drinks, and
 *   a hero carries one of them ({@link isDrinkLike}, checked as an item is equipped). Poisons, bait,
 *   arrows and Motes give no buff and are not limited.
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
export const DOSE = Object.freeze({ ELIXIR: 'elixir', DRINK: 'drink', POTION: 'potion', POISON: 'poison' });

/**
 * How many attacks a poison's dose lasts, from its fight-start rules: the most any of them names as
 * "for N attacks" (`payload.forAttacks`), or 0 when none does (not a poison).
 */
export function poisonAttacksOf(statements) {
    let most = 0;
    for (const s of Array.isArray(statements) ? statements : []) {
        if (s?.when?.event !== FIGHT_START) continue;
        const n = Math.floor(Number(s?.payload?.forAttacks));
        if (Number.isFinite(n) && n > most) most = n;
    }
    return most;
}

/** How many of its moments one dose lasts. */
export const DOSE_LENGTH = Object.freeze({
    [DOSE.ELIXIR]: ELIXIR_FIGHTS,
    [DOSE.DRINK]: DRINK_CYCLES,
    [DOSE.POTION]: WORK_POTION_CYCLES
});

/**
 * How many moments a dose lasts on average once Long-lasting Brews has moved its length from `base`
 * to `resolved`: unrounded, never below one. Not a number: `base` unmoved. Draws nothing; what the
 * game shows.
 */
export function exactDoseLength(base, resolved) {
    const n = Number(resolved);
    if (!Number.isFinite(n)) return base;
    return Math.max(1, n);
}

/**
 * How many moments a fresh dose lasts: the exact length ({@link exactDoseLength}) made whole by
 * chance as the dose starts (3.6 is 4 three times in five, 3 two times in five), never below one.
 *
 * ⚠️ Draws one `random()` only when the length has a fraction, so with no star moving it the
 * random stream stays as it was.
 */
export function lastingDoseLength(base, resolved, random = Math.random) {
    return Math.max(1, roundByChance(exactDoseLength(base, resolved), random));
}

/**
 * The whole numbers a dose of exact length `exact` can last: `[low, high]`, the same twice when it
 * is whole (float error aside). Draws nothing.
 */
export function doseLengthSpan(exact) {
    const low = Math.max(1, Math.floor(exact + WHOLE_EPSILON));
    return exact - low < WHOLE_EPSILON ? [low, low] : [low, low + 1];
}

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
    if (kind === CATEGORY_KINDS.CONSUMABLE && onFight) kinds.push(poisonAttacksOf(list) > 0 ? DOSE.POISON : DOSE.ELIXIR);
    if (categoryId === 'drink' && onWork) kinds.push(DOSE.DRINK);
    if (kind === CATEGORY_KINDS.CONSUMABLE && onWork) kinds.push(DOSE.POTION);
    return kinds;
}

/**
 * Whether an item counts as its hero's one drink (owner, 2026-11-26): anything in the Drink
 * category, and a Consumable drunk as a work potion or a fight elixir, whatever its category reads.
 * A poison, bait, an arrow or a Mote gives no buff and is not one.
 *
 * @param {string} categoryId the item's `equipSlot`
 * @param {object[]} statements the item's statements, expanded from its effect references
 */
export function isDrinkLike(categoryId, statements) {
    if (categoryId === 'drink') return true;
    return doseKindsOf(categoryId, statements).some(k => k === DOSE.DRINK || k === DOSE.POTION || k === DOSE.ELIXIR);
}

/** What the CMS says about an item that counts as the one drink a hero carries. */
export const ONE_DRINK_WHY = 'Counts as the hero\'s one drink: a hero carries one drink, work potion or elixir at a time, and a second is refused until the first comes off.';

/** What the CMS says about each way of being used. */
export const DOSE_WHY = Object.freeze({
    [DOSE.ELIXIR]: `An elixir: one is drunk from the Bank as a fight starts and lasts ${ELIXIR_FIGHTS} fights (one number for every elixir). Its fight-start rules work from that dose.`,
    [DOSE.DRINK]: `A drink: one is drunk from the Bank as a work cycle starts and lasts ${DRINK_CYCLES} work cycles (one number for every drink). Its On Work Start rules work from that dose; a rule naming a skill counts only that skill's cycles.`,
    [DOSE.POTION]: `A work potion: one is drunk from the Bank as a work cycle of its skill starts and lasts ${WORK_POTION_CYCLES} cycles of that skill (one number for every work potion). The hero keeps it while doing other work.`,
    [DOSE.POISON]: 'A poison: one is taken from the Bank as a fight starts, only by a hero holding a Stealth weapon, and lasts the attacks its rule names (for N attacks), hit or miss. What is left carries into later fights; a fresh one is taken only as a fight starts.'
});

/** What the CMS says about a food, drink or Consumable that no moment drinks. */
export function noDoseWhy(categoryId) {
    if (categoryId === 'food') return 'Food: eaten from the Bank when its hero drops below a quarter of their health. Its rules work only on a moment.';
    if (categoryId === 'drink') return 'A drink with no On Work Start rule does nothing: give it one ("On Work Start: applies Coffee to the hero for the cycle").';
    return 'A Consumable with no fight-start or On Work Start rule is never drunk: bait for fishing, an arrow for a bow, or not finished yet.';
}

/** What the CMS says about an always-on rule on a food, drink or potion. */
export const ALWAYS_ON_IDLE_WHY = 'Food, drinks and potions act only through a moment (On Work Start, or a fight starting): this always-on rule does nothing on one.';

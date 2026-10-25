import { EventBus } from '../core/EventBus.js';
import * as HeroManager from './HeroManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getEquippedEntries, categoryIdsOfKind, isConsumableCategory, CATEGORY_KINDS } from '../../config/registries/equipmentConstants.js';
import { CONSUME_THRESHOLD, ELIXIR_FIGHTS } from '../../config/loopConstants.js';
import * as HeroEffects from './HeroEffects.js';
import { logger } from '../../utils/Logger.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { roundHalfUp } from '../../config/FormulaRegistry.js';
import { doseKindsOf, DOSE, DOSE_LENGTH, isWorkMoment, workSkillMatches } from '../core/consumableRule.js';

/**
 * ConsumptionSystem — heroes feed themselves from their own loadout grid.
 *
 * Below the HP threshold a hero eats from the food slot. Drinks never heal, in a fight or out:
 * an equipped drink is left alone (`tryEat`); drinks are work buffs, drunk as a work cycle starts
 * and lasting `DRINK_CYCLES` cycles, and a work potion is drunk for each cycle of its skill
 * (`startWorkDoses`).
 * Elixirs are drunk as a fight starts and last `ELIXIR_FIGHTS` fights (`startFightElixirs`).
 *
 * Consuming draws one unit from the Guild Bank; an equipped item with no stock
 * is skipped and the hero goes without. Eating has no cooldown or per-fight limit.
 */

/** Fraction of max HP below which a hero reaches for food. */
export { CONSUME_THRESHOLD };

/** True when a vital has dropped below the threshold. */
function isLow(vital) {
    if (!vital || !vital.max) return false;
    return vital.current / vital.max < CONSUME_THRESHOLD;
}

/** The hero's equipped item of a given category, or null. */
function equippedOfCategory(hero, categoryId) {
    return getEquippedEntries(hero).find(e => e.category === categoryId) || null;
}

/**
 * What a meal heals in a fight: its restore moved by any Food Healing the hero carries (Burn's
 * -50 %), rounded halves up, never below 0.
 */
function fightMealHealing(hero, amount) {
    const factor = hero?.aggregator?.getPercentageBucket
        ? hero.aggregator.getPercentageBucket(EFFECT_TYPES.FOOD_HEALING)
        : 1;
    return factor === 1 ? amount : Math.max(0, roundHalfUp(amount * factor));
}

/**
 * Spend one unit of an equipped item from the bank and apply its restore.
 * Returns null when the item isn't equipped or the bank is out of stock — in
 * which case the hero simply goes without.
 */
function consumeEquipped(hero, categoryId, { inFight = false } = {}) {
    const entry = equippedOfCategory(hero, categoryId);
    if (!entry) return null;

    if (!InventoryManager.hasItem(entry.itemId, 1)) return null;

    const item = getItem(entry.itemId);
    const restore = item?.restoreAmount || 0;
    const amount = inFight ? fightMealHealing(hero, restore) : restore;
    InventoryManager.removeItem(entry.itemId, 1);

    if (amount > 0) HeroManager.modifyHeroHp(hero.id, amount);

    EventBus.publish(ENGINE_EVENTS.HERO_CONSUMED, {
        heroId: hero.id, itemId: entry.itemId, category: categoryId, amount
    });
    return { itemId: entry.itemId, amount };
}

/** Does this hero want food right now? */
export function needsFood(heroId) {
    const hero = HeroManager.getHero(heroId);
    return !!hero && isLow(hero.hp);
}

/**
 * Eat if HP is low: one unit from the food slot. Drinks do not heal, in a fight or out: the drink
 * stays equipped and unspent, and its restore amount is ignored. The combat cost (the swing) is
 * charged by the caller; `inFight` applies Food Healing (Burn) to the meal.
 * @param {{inFight?: boolean}} [options]
 * @returns {Array<{itemId: string, amount: number}>} what was eaten; empty if nothing.
 */
export function tryEat(heroId, { inFight = false } = {}) {
    const hero = HeroManager.getHero(heroId);
    if (!hero || !isLow(hero.hp)) return [];
    const meal = consumeEquipped(hero, 'food', { inFight });
    return meal ? [meal] : [];
}

/**
 * The moment an elixir's rules wait on: a fight starting (each enemy engaged is one fight). The
 * same moment id carried rules on any item use (`LoadoutMoments`).
 */
export const FIGHT_START = 'COMBAT_ENGAGED';

/**
 * Whether an item is a fight elixir: a Consumable carrying at least one rule on the fight-start
 * moment. A Consumable without one (a potion for work) is never drunk by a fight.
 */
export function isFightElixir(itemId) {
    const item = getItem(itemId);
    if (!item || !isConsumableCategory(item.equipSlot)) return false;
    return HeroEffects.itemStatements(itemId).some(s => s?.when?.event === FIGHT_START);
}

/**
 * A fight is starting: count it on every equipped elixir type and drink a fresh one of each type
 * whose last dose has run out. One elixir lasts `ELIXIR_FIGHTS` fights, so the count left is
 * stored on the hero (`hero.elixirFights`, saved with them). An elixir with no dose left and none
 * in the Bank sits out this fight.
 *
 * Draws no random number, so a catch-up counts exactly as live play does.
 *
 * @returns {string[]} the elixir item ids working in this fight, in grid order
 */
export function startFightElixirs(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return [];

    const active = [];
    const seen = new Set();
    for (const entry of getEquippedEntries(hero)) {
        if (!isConsumableCategory(entry.category) || seen.has(entry.itemId)) continue;
        seen.add(entry.itemId);
        if (!isFightElixir(entry.itemId)) continue;

        let left = Number(hero.elixirFights?.[entry.itemId]) || 0;
        if (left <= 0) {
            if (!InventoryManager.hasItem(entry.itemId, 1)) continue;
            InventoryManager.removeItem(entry.itemId, 1);
            left = ELIXIR_FIGHTS;
            EventBus.publish(ENGINE_EVENTS.HERO_CONSUMED, {
                heroId, itemId: entry.itemId, category: entry.category, amount: 0, elixir: true
            });
            logger.debug('ConsumptionSystem', `${hero.name} drank ${entry.itemId}`);
        }
        if (!hero.elixirFights) hero.elixirFights = {};
        hero.elixirFights[entry.itemId] = left - 1;
        active.push(entry.itemId);
    }
    return active;
}

/**
 * How many work cycles one of this item lasts when its hero starts work: `DRINK_CYCLES` for a drink,
 * 1 for a work potion, 0 for anything else (`consumableRule.doseKindsOf`).
 */
export function workDoseOf(itemId) {
    const item = getItem(itemId);
    if (!item) return 0;
    const kinds = doseKindsOf(item.equipSlot, HeroEffects.itemStatements(itemId));
    if (kinds.includes(DOSE.DRINK)) return DOSE_LENGTH[DOSE.DRINK];
    if (kinds.includes(DOSE.POTION)) return DOSE_LENGTH[DOSE.POTION];
    return 0;
}

/**
 * A work cycle of `skill` is starting: count it on every equipped drink and work potion whose work
 * rules fire on it, and drink a fresh one of each whose dose has run out. A drink lasts
 * `DRINK_CYCLES` cycles, its count left saved on the hero (`hero.drinkCycles`); a work potion lasts
 * the one cycle, so one is drunk every time. One with no dose left and none in the Bank sits this
 * cycle out. An item whose work rules all name another skill is kept for its own skill's work.
 *
 * Draws no random number, so a catch-up counts exactly as live play does.
 *
 * @returns {string[]} the item ids working in this cycle, in grid order
 */
export function startWorkDoses(heroId, skill) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return [];

    const active = [];
    const seen = new Set();
    for (const entry of getEquippedEntries(hero)) {
        if (seen.has(entry.itemId)) continue;
        seen.add(entry.itemId);
        const length = workDoseOf(entry.itemId);
        if (!length) continue;
        const fires = HeroEffects.itemStatements(entry.itemId)
            .some(s => isWorkMoment(s?.when?.event) && workSkillMatches(s.when, skill));
        if (!fires) continue;

        let left = length > 1 ? (Number(hero.drinkCycles?.[entry.itemId]) || 0) : 0;
        if (left <= 0) {
            if (!InventoryManager.hasItem(entry.itemId, 1)) continue;
            InventoryManager.removeItem(entry.itemId, 1);
            left = length;
            EventBus.publish(ENGINE_EVENTS.HERO_CONSUMED, {
                heroId, itemId: entry.itemId, category: entry.category, amount: 0,
                dose: length > 1 ? DOSE.DRINK : DOSE.POTION
            });
            logger.debug('ConsumptionSystem', `${hero.name} drank ${entry.itemId}`);
        }
        if (length > 1) {
            if (!hero.drinkCycles) hero.drinkCycles = {};
            hero.drinkCycles[entry.itemId] = left - 1;
        }
        active.push(entry.itemId);
    }
    return active;
}

/** Whether an item is drunk at a work cycle's start (a drink or a work potion). */
export function isWorkDose(itemId) {
    return workDoseOf(itemId) > 0;
}

/** Everything the hero could still consume, for UI and diagnostics. */
export function getConsumables(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return { food: null, drink: null, consumables: [] };

    const consumableCategories = new Set(categoryIdsOfKind(CATEGORY_KINDS.CONSUMABLE));
    return {
        food: equippedOfCategory(hero, 'food')?.itemId || null,
        drink: equippedOfCategory(hero, 'drink')?.itemId || null,
        consumables: getEquippedEntries(hero)
            .filter(e => consumableCategories.has(e.category))
            .map(e => e.itemId)
    };
}

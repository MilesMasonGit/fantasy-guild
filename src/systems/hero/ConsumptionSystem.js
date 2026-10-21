import { EventBus } from '../core/EventBus.js';
import * as HeroManager from './HeroManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getEquippedEntries, categoryIdsOfKind, CATEGORY_KINDS } from '../../config/registries/equipmentConstants.js';
import { CONSUME_THRESHOLD } from '../../config/loopConstants.js';
import { logger } from '../../utils/Logger.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * ConsumptionSystem — heroes feed themselves from their own loadout grid.
 *
 * Food and drink both heal, each from its own slot: whenever HP drops below the
 * threshold, in or out of combat, the hero eats and, if still low, drinks
 * (`tryEat`). `consumeLoopConsumables` is dormant: nothing outside tests calls it.
 *
 * Consuming draws one unit from the Guild Bank; an equipped item with no stock
 * is skipped and the hero goes without. Eating has no cooldown or per-fight limit.
 */

/** Fraction of max HP below which a hero reaches for food and drink. */
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
 * Spend one unit of an equipped item from the bank and apply its restore.
 * Returns null when the item isn't equipped or the bank is out of stock — in
 * which case the hero simply goes without.
 */
function consumeEquipped(hero, categoryId) {
    const entry = equippedOfCategory(hero, categoryId);
    if (!entry) return null;

    if (!InventoryManager.hasItem(entry.itemId, 1)) return null;

    const item = getItem(entry.itemId);
    const amount = item?.restoreAmount || 0;
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
 * Eat and drink if HP is low: one unit from the food slot, then, only if HP is
 * still below the threshold, one from the drink slot. Works anywhere; the
 * combat cost is charged by the caller.
 * @returns {Array<{itemId: string, amount: number}>} what was consumed, in order; empty if nothing.
 */
export function tryEat(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero || !isLow(hero.hp)) return [];
    const consumed = [];
    for (const categoryId of ['food', 'drink']) {
        if (!isLow(hero.hp)) break;
        const meal = consumeEquipped(hero, categoryId);
        if (meal) consumed.push(meal);
    }
    return consumed;
}

/**
 * Spend one of EACH equipped Consumable, uncapped. Returns every item spent in grid order.
 *
 * ⚠️ DORMANT ON PURPOSE: no caller, because nothing reads an item's `loopEffect`
 * and no authored item declares one, so firing this would destroy a potion per
 * cycle for no benefit. `DefeatPenalties` exempts the Consumable class from
 * defeat loss for the same reason. Not an oversight to "fix".
 *
 * @returns {Array<{itemId: string, item: object}>} in grid order.
 */
export function consumeLoopConsumables(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return [];

    const consumableCategories = new Set(categoryIdsOfKind(CATEGORY_KINDS.CONSUMABLE));
    const spent = [];

    for (const entry of getEquippedEntries(hero)) {
        if (!consumableCategories.has(entry.category)) continue;
        if (!InventoryManager.hasItem(entry.itemId, 1)) continue;

        InventoryManager.removeItem(entry.itemId, 1);
        const item = getItem(entry.itemId);
        spent.push({ itemId: entry.itemId, item });

        EventBus.publish(ENGINE_EVENTS.HERO_CONSUMED, {
            heroId, itemId: entry.itemId, category: entry.category, amount: 0
        });
    }

    if (spent.length) {
        logger.debug('ConsumptionSystem', `${hero.name} spent ${spent.length} consumable(s) at loop start`);
    }
    return spent;
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

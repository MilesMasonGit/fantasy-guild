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
 * Food fires whenever HP drops below the threshold, in or out of combat
 * (`tryEat`). `tryDrink` and `consumeLoopConsumables` are dormant: nothing
 * outside tests calls them.
 *
 * Consuming draws one unit from the Guild Bank; an equipped item with no stock
 * is skipped and the hero goes without. Eating has no cooldown or per-fight limit.
 */

/** Fraction of max HP/Energy below which a hero reaches for supplies. */
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
function consumeEquipped(hero, categoryId, vitalKey) {
    const entry = equippedOfCategory(hero, categoryId);
    if (!entry) return null;

    if (!InventoryManager.hasItem(entry.itemId, 1)) return null;

    const item = getItem(entry.itemId);
    const amount = item?.restoreAmount || 0;
    InventoryManager.removeItem(entry.itemId, 1);

    if (amount > 0) {
        if (vitalKey === 'energy') HeroManager.modifyHeroEnergy(hero.id, amount);
        else HeroManager.modifyHeroHp(hero.id, amount);
    }

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

/** Does this hero want a drink right now? */
export function needsDrink(heroId) {
    const hero = HeroManager.getHero(heroId);
    return !!hero && isLow(hero.energy);
}

/**
 * Drink if energy is low. Called before energy is charged.
 *
 * Two rules:
 *   **Ambient**: below `CONSUME_THRESHOLD` of max, top up.
 *   **On demand** (`need`): the caller is about to charge exactly this much
 *   and the hero cannot pay. Threshold is irrelevant here, or a craft costing
 *   more than a quarter of max energy would stall forever with a full
 *   waterskin in the grid.
 *
 * One drink may not cover a large `need`; callers tick again and this converges.
 *
 * @param {string} heroId
 * @param {{need?: number}} [opts] energy the caller is about to spend.
 * @returns {{itemId: string, amount: number}|null} what was drunk, if anything.
 */
export function tryDrink(heroId, { need = null } = {}) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return null;

    const short = need !== null && (hero.energy?.current ?? 0) < need;
    if (!isLow(hero.energy) && !short) return null;

    return consumeEquipped(hero, 'drink', 'energy');
}

/**
 * Eat if HP is low. Works anywhere; the combat cost is charged by the caller.
 * @returns {{itemId: string, amount: number}|null} what was eaten, if anything.
 */
export function tryEat(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero || !isLow(hero.hp)) return null;
    return consumeEquipped(hero, 'food', 'hp');
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

// Fantasy Guild — Consumption Engine (Area Deck Rework, C-8)

import { EventBus } from '../core/EventBus.js';
import * as HeroManager from './HeroManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getEquippedEntries, categoryIdsOfKind, CATEGORY_KINDS } from '../../config/registries/equipmentConstants.js';
import { CONSUME_THRESHOLD } from '../../config/loopConstants.js';
import { logger } from '../../utils/Logger.js';

/**
 * ConsumptionSystem — heroes feed themselves from their own loadout grid.
 *
 * Three item classes, three different rhythms (D-56):
 *
 *   **Drink** — fires at the DRAW. Energy is what pays to draw the next Task
 *   card, so a hero below the threshold drinks *first*, then draws (D-27).
 *   It slots into the gap between cards where energy is actually spent.
 *
 *   **Food** — fires whenever HP drops below the threshold, anywhere (D-27).
 *   A hero on a fight-free gathering loop is never stranded by hazard chip
 *   damage. What changes in combat is the *price*: eating pauses the attack
 *   cycle while the fight continues, so the enemy gets a free swing.
 *
 *   **Consumable** — potions, scrolls, runes. Not need-driven at all: one of
 *   each equipped Consumable is spent at the head of every loop (D-20), which
 *   the Prep Phase renders (C-6).
 *
 * ## Supply chain, not timing
 * Nothing here is scheduled or micro-managed. A slot in the grid names an item;
 * consuming draws one unit from the Guild Bank. Keep the bank stocked and a
 * hero runs unattended indefinitely; let it run dry and they visibly falter.
 * That is deliberately a *supply* problem rather than a *timing* one.
 *
 * ## Eating is uncapped (D-31)
 * No cooldown, no per-fight limit. A hero who cannot out-heal the damage is
 * supposed to lose. The known cost is that the failure mode looks like a
 * spiral — eat, get hit, eat — which is watch item W-2; a meal cooldown is the
 * fix if it reads badly rather than reading as losing.
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

    EventBus.publish('hero_consumed', {
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
 * Drink if energy is low. Called before energy is charged (D-27).
 *
 * Two rules, deliberately both here rather than in the callers:
 *
 *   **Ambient** — below `CONSUME_THRESHOLD` of max, top up. This is the idle
 *   rhythm: keep the bank stocked and the hero never runs dry.
 *
 *   **On demand** (`need`) — the caller is about to charge exactly this much
 *   and the hero cannot pay. Threshold is irrelevant here: a craft costing more
 *   than a quarter of max energy would otherwise stall *forever* with a full
 *   waterskin in the grid, because the hero never gets "low" enough to drink.
 *   Nothing authored today costs that much, so this is a trap being closed
 *   before content walks into it, not a live bug.
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
 * Eat if HP is low. Works anywhere — the combat *price* is charged by the
 * caller, not here, so this stays a single rule (D-27).
 * @returns {{itemId: string, amount: number}|null} what was eaten, if anything.
 */
export function tryEat(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero || !isLow(hero.hp)) return null;
    return consumeEquipped(hero, 'food', 'hp');
}

/**
 * Spend one of EACH equipped Consumable — the Prep Phase firing (D-20).
 *
 * Uncapped by design (D-56): a hero may carry six scrolls and fire all six.
 * The only brake is the time each costs at the head of the loop, which is why
 * this returns every item spent — the Prep Phase renders one card per entry.
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
        if (!InventoryManager.hasItem(entry.itemId, 1)) continue;   // out of stock, run unbuffed

        InventoryManager.removeItem(entry.itemId, 1);
        const item = getItem(entry.itemId);
        spent.push({ itemId: entry.itemId, item });

        EventBus.publish('hero_consumed', {
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

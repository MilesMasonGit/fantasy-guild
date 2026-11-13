import { getItem } from '../../config/registries/itemRegistry.js';
import { arrowOf } from '../../config/registries/damageTypes.js';
import { baitItemIds } from '../../config/registries/catchPools.js';
import { getAllTokenTypes } from '../../config/registries/tokenRegistry.js';
import { CARRIED_KIND } from '../../config/registries/carriedKinds.js';
import { workDoseKindOf, isFightElixir } from './ConsumptionSystem.js';
import { DOSE } from '../core/consumableRule.js';
import { spentKindOf } from '../board/CycleSavings.js';

/** Whether any water takes item `itemId` as bait. */
function isBait(itemId) {
    return Object.values(getAllTokenTypes() || {}).some(def => baitItemIds(def).includes(itemId));
}

/**
 * The kind (`carriedKinds.js`) the engine counts item `itemId` as when a hero uses it up, or null
 * for something never used up (gear). Arrows are ammo, a bait is bait, a fight elixir an elixir; a
 * drink or work potion by the dose it starts, Food by its category.
 */
export function carriedKindOf(itemId) {
    const item = getItem(itemId);
    if (!item) return null;
    if (arrowOf(item)) return CARRIED_KIND.AMMO;
    if (isBait(itemId)) return CARRIED_KIND.BAIT;
    if (isFightElixir(itemId)) return CARRIED_KIND.ELIXIR;
    // By the dose, never its length: Long-lasting Brews can make a potion last more than one cycle.
    const dose = workDoseKindOf(itemId);
    if (dose === DOSE.DRINK) return CARRIED_KIND.DRINK;
    if (dose === DOSE.POTION) return CARRIED_KIND.POTION;
    return spentKindOf(itemId) === CARRIED_KIND.FOOD ? CARRIED_KIND.FOOD : null;
}

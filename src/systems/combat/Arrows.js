// a Ranged weapon's ammo: the arrow a hero shoots next, and spending one per shot

import { getItem } from '../../config/registries/itemRegistry.js';
import { getGrid, categoryOfItem, isConsumableCategory } from '../../config/registries/equipmentConstants.js';
import { arrowOf } from '../../config/registries/damageTypes.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getHeroCombatStyle } from '../../utils/CombatFormulas.js';

/**
 * A hero fighting with a Ranged weapon shoots one arrow per shot from
 * the Bank, and the shot deals the bow's damage in the bow's type plus the arrow's in the arrow's.
 * An arrow is a Consumable with an `arrow` block (`damageTypes.arrowOf`), carried in a consumable
 * cell like bait: the first in grid order the Bank still holds is the one shot.
 *
 * ⚠️ With none left the bow shoots its own part alone, so a bow authored before arrows existed
 * keeps fighting as it did; whether an empty quiver should stop the shot instead is the owner's
 * call, not yet made.
 */

/** Whether a hero's fighting style shoots arrows. */
export function shootsArrows(hero) {
    return getHeroCombatStyle(hero) === 'ranged';
}

/** The arrows a hero carries, in grid order, whatever the Bank holds: item ids, each once. */
export function carriedArrowIds(hero) {
    const out = [];
    for (const itemId of getGrid(hero)) {
        if (!itemId || out.includes(itemId)) continue;
        if (!isConsumableCategory(categoryOfItem(itemId))) continue;
        if (arrowOf(getItem(itemId))) out.push(itemId);
    }
    return out;
}

/**
 * The arrow this hero's next shot spends: the first carried arrow the Bank holds, or null (not a
 * Ranged fighter, none carried, or the Bank is out). Draws nothing and spends nothing.
 */
export function nextArrowOf(hero) {
    if (!shootsArrows(hero)) return null;
    for (const itemId of carriedArrowIds(hero)) {
        if (InventoryManager.hasItem(itemId, 1)) return itemId;
    }
    return null;
}

/**
 * Spend one arrow for a shot. Returns the arrow's id and its part of the shot, or null when no
 * arrow was shot.
 * @returns {{itemId: string, arrow: {damage: number, damageType: string}}|null}
 */
export function spendArrow(hero) {
    const itemId = nextArrowOf(hero);
    if (!itemId || !InventoryManager.removeItem(itemId, 1)) return null;
    return { itemId, arrow: arrowOf(getItem(itemId)) };
}

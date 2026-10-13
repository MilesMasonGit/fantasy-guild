// map upcycling: trade N of one map for 1 of the map its `upcycle` names, from the Cartography table

import { getItem } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { isMapItem, upcycleOf } from './mapItems.js';
import { TEXT } from './regionNames.js';

/** Where the collection log says an upcycled map came from. */
const SOURCE = 'cartography_upcycle';

/**
 * The trade a map offers, or null when it has none: `{ from, to, toName, ratio, held, reason }`.
 * `ratio` is how many it takes (a whole number), `held` how many the Bank holds, and `reason` why
 * the trade would be refused now, or null when it would go through. A map that trades into itself
 * or into something that is not a map offers nothing (the boot audit names the second).
 */
export function upcycleOffer(itemId) {
    const def = getItem(itemId);
    const upcycle = upcycleOf(def);
    if (!upcycle || upcycle.itemId === itemId) return null;
    const target = getItem(upcycle.itemId);
    if (!isMapItem(target)) return null;

    const ratio = Math.ceil(upcycle.ratio);
    const held = InventoryManager.getItemCount(itemId);
    const toName = target.name || upcycle.itemId;
    let reason = null;
    if (held < ratio) reason = TEXT.refuseUpcycleShort(ratio, held);
    // ⚠️ A trade that keeps some of this map needs a free Bank place for the new one; trading the
    // last of them frees their own place first. Otherwise the new map would land on the floor.
    else if (held > ratio && InventoryManager.lacksSlotFor(upcycle.itemId)) reason = TEXT.refuseUpcycleNoRoom(toName);
    return { from: itemId, to: upcycle.itemId, toName, ratio, held, reason };
}

/**
 * Trade `ratio` of this map for one of the map its upcycle names: one step, never on into the next
 * map. Takes exactly `ratio` and gives exactly one, and nothing else in the Bank changes; the Bank
 * announces both (`INVENTORY_UPDATED`). A refusal takes nothing.
 *
 * @returns {{success: boolean, reason?: string, taken?: {itemId: string, count: number},
 *   given?: {itemId: string, count: number}}}
 */
export function upcycle(itemId) {
    const offer = upcycleOffer(itemId);
    if (!offer) return { success: false, reason: TEXT.REFUSE_NO_UPCYCLE };
    if (offer.reason) return { success: false, reason: offer.reason };

    if (!InventoryManager.removeItem(offer.from, offer.ratio)) {
        return { success: false, reason: TEXT.refuseUpcycleShort(offer.ratio, InventoryManager.getItemCount(offer.from)) };
    }
    InventoryManager.addItem(offer.to, 1, SOURCE);
    return { success: true, taken: { itemId: offer.from, count: offer.ratio }, given: { itemId: offer.to, count: 1 } };
}

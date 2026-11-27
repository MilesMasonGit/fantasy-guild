// Using items from the Bank: an item's Use pays its drops at once, into the Bank, with no hero

import { getItem } from '../../config/registries/itemRegistry.js';
import { itemUseDropsOf } from '../../config/registries/itemUse.js';
import { rollOutputQuantity } from '../../config/registries/tokenConstants.js';
import { roundByChance } from '../../utils/RNG.js';
import { InventoryManager } from './InventoryManager.js';
import { ItemRateTracker } from './ItemRateTracker.js';

/**
 * Up to this many copies at once, every copy rolls every drop, as a work cycle rolls its outputs.
 * Past it, each drop pays its expected amount made whole by chance (`roundByChance`): the same on
 * average, and a stack of millions does not freeze the game for seconds.
 */
export const ROLL_EACH_UP_TO = 10_000;

/**
 * What `count` copies of a Use give: a `Map` of item id to quantity, in the drops' order, only the
 * items that came. Each copy rolls each line's chance (`random() * 100` over it misses, as
 * `BoardRunner` reads a chance) and then its amount (`rollOutputQuantity`). No rule reaches a Use:
 * there is no Token and no hero, so no Yield, Double Loot or Lucky.
 *
 * ⚠️ Draws from `random` (the game's `Math.random`, seeded in the tests and the bench) in a fixed
 * order: copy by copy, line by line, a chance only under 100, an amount for every line that lands.
 */
export function rollUse(drops, count, random = Math.random) {
    const out = new Map();
    const n = Math.max(0, Math.floor(Number(count) || 0));
    const add = (itemId, quantity) => {
        if (quantity > 0) out.set(itemId, (out.get(itemId) || 0) + quantity);
    };
    if (n <= ROLL_EACH_UP_TO) {
        for (let i = 0; i < n; i++) {
            for (const line of drops) {
                if (line.chance < 100 && random() * 100 > line.chance) continue;
                add(line.itemId, rollOutputQuantity(line, random));
            }
        }
        return out;
    }
    for (const line of drops) {
        add(line.itemId, roundByChance(n * (line.chance / 100) * ((line.minQty + line.maxQty) / 2), random));
    }
    return out;
}

/**
 * Use `count` of the Bank's `itemId` (at most what it holds): the copies leave the Bank, then their
 * drops go in through `InventoryManager.addItem`, all announced once (`InventoryManager.batch`).
 *
 * ⚠️ A full Bank loses nothing: what it has no room for (no free slot for a new kind, or a stack at
 * the shared ceiling) goes to the floor as loot, as all income does (`SpriteLayer`'s
 * `inventory_overflow`), and the Bank Full banner says so. The copies are taken first, so using
 * the last of a stack frees its slot for a drop.
 *
 * @returns {{ itemId: string, used: number, paid: {itemId: string, quantity: number}[],
 *   waiting: {itemId: string, quantity: number}[] } | null} `paid` everything the copies gave,
 *   `waiting` the part of it left on the mat; null when the item has no Use or the Bank holds none
 */
export function applyItemUse(itemId, count) {
    const drops = itemUseDropsOf(getItem(itemId));
    if (!drops.length) return null;
    const n = Math.min(InventoryManager.getItemCount(itemId), Math.max(0, Math.floor(Number(count) || 0)));
    if (n <= 0) return null;
    const rolled = rollUse(drops, n);
    const paid = [];
    const waiting = [];
    let taken = false;
    InventoryManager.batch(() => {
        taken = InventoryManager.removeItem(itemId, n);
        if (!taken) return;
        for (const [dropId, quantity] of rolled) {
            // A drop naming no item is a content slip the audits name; it pays nothing.
            if (!getItem(dropId)) continue;
            const added = InventoryManager.addItem(dropId, quantity);
            // Loot counts in an item's per hour as it lands (`SpriteLayer.addSprite`, the overflow's
            // part too); straight into the Bank it counts here.
            if (added > 0) ItemRateTracker.recordGain(dropId, added);
            paid.push({ itemId: dropId, quantity });
            if (added < quantity) waiting.push({ itemId: dropId, quantity: quantity - added });
        }
    });
    return taken ? { itemId, used: n, paid, waiting } : null;
}

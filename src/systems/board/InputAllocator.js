// input availability and consumption

import { InventoryManager } from '../inventory/InventoryManager.js';
import * as SpriteLayer from './SpriteLayer.js';

/**
 * Where a Token's inputs come from, and who gets them when there aren't enough.
 *
 * Inputs are pulled automatically from the global Bank: there is no assignment step. Supply is not
 * spatial: a Forest in one corner supplies a Forge in the other as well as a neighbour would. If
 * the Bank is short, any matching sprite on the board is used, so loot on the floor never starves a
 * chain.
 *
 * First come, first served: whichever Token's cycle completes first takes what is in the Bank;
 * others wait. There are no partial cycles. Shortfall resolves per item, so a coal shortage affects
 * only coal-burners and throttling cascades downstream without explicit logic.
 *
 * ⚠️ A Token needing 1 Coal can act sooner than one needing 5, so under sustained shortage the
 * deep, expensive chains starve first. {@link getStarvationStats} counts blocked ticks per Token
 * type to measure it.
 */

/** Blocked-tick counts per Token type. */
const starvation = new Map();

/** How many units of an item are reachable — Bank plus anything on the floor. */
export function availableOf(itemId) {
    return InventoryManager.getItemCount(itemId) + SpriteLayer.countOnBoard(itemId);
}

/**
 * Can this Token pay for a cycle right now?
 *
 * @returns {{ok: boolean, missing: Array<{itemId, needed, available}>}}
 */
export function checkInputs(inputs) {
    const missing = [];
    for (const input of inputs || []) {
        const needed = input.quantity || 1;
        const available = availableOf(input.itemId);
        if (available < needed) missing.push({ itemId: input.itemId, needed, available });
    }
    return { ok: missing.length === 0, missing };
}

/**
 * Spend a Token's inputs. Bank first, then the floor.
 *
 * Deliberately atomic: it verifies the whole cost is payable before taking anything, so a half-paid
 * recipe never destroys items for no output.
 *
 * @returns {boolean} whether the full cost was paid
 */
export function consumeInputs(inputs) {
    if (!inputs?.length) return true;
    if (!checkInputs(inputs).ok) return false;

    for (const input of inputs) {
        let owed = input.quantity || 1;

        const banked = InventoryManager.getItemCount(input.itemId);
        const fromBank = Math.min(banked, owed);
        if (fromBank > 0) {
            InventoryManager.removeItem(input.itemId, fromBank);
            owed -= fromBank;
        }
        if (owed > 0) owed -= SpriteLayer.consumeFromSprites(input.itemId, owed);

        // Should be unreachable — `checkInputs` ran above and nothing else runs
        // between here and there. Logged rather than thrown so one bad recipe
        // cannot stop the whole board ticking.
        if (owed > 0) {
            console.warn(`[InputAllocator] Short by ${owed}× ${input.itemId} after the check passed`);
        }
    }
    return true;
}

/** Record that a Token type could not run for want of inputs. */
export function noteStarved(typeId) {
    starvation.set(typeId, (starvation.get(typeId) || 0) + 1);
}

/**
 * Blocked-tick counts per Token type, for comparing a cheap consumer against an expensive one under
 * the same shortage.
 */
export function getStarvationStats() {
    return Object.fromEntries(starvation);
}

/** Clear the measurement (between balance runs, and in tests). */
export function resetStarvationStats() {
    starvation.clear();
}

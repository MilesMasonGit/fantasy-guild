// Fantasy Guild — Input availability and consumption (7×7 Playmat rework, Phase 4)

import { InventoryManager } from '../inventory/InventoryManager.js';
import * as SpriteLayer from './SpriteLayer.js';

/**
 * Where a Token's inputs come from, and who gets them when there aren't enough.
 *
 * ## Inputs are pulled automatically from the global Bank (D-24)
 * There is **no assignment step**. The player never drags an item onto a Token,
 * never fills an input slot, never picks which stack to spend. The deck loop
 * required all of that (`card.assignedItems`), and none of it survives: a Forge
 * simply takes coal from the Bank when it needs coal.
 *
 * ## Supply is not spatial (D-83)
 * A Forest in one corner supplies a Forge in the other exactly as well as a
 * neighbour would. There is no locality bonus, no routing and no range.
 *
 * > **What a Token makes is spatial. Where its materials come from is not.**
 *
 * ## Loot on the ground counts (D-42)
 * If the Bank is short, any matching **sprite on the board** is used. Loot lying
 * on the floor must never starve a chain — otherwise a player with a full Bank
 * would watch their board deadlock while the missing ingredient sat three tiles
 * away.
 *
 * ## First-come allocation (D-127), and the risk it carries
 * **Whichever Token's cycle completes first takes what is in the Bank**; others
 * wait for more to arrive. There are no partial cycles — a Token runs at full
 * speed when it has its inputs and waits when it does not.
 *
 * Degradation is therefore **emergent rather than per-cycle**: two Forges
 * sharing a coal supply that covers one will alternate, each running full cycles
 * about half the time, so aggregate throughput lands near 50% each without any
 * Token ever running "at half speed". Shortfall resolves **per item**, so a coal
 * shortage affects only coal-burners and throttling cascades downstream with no
 * explicit cascade logic.
 *
 * ⚠️ **Risk 13 lives here.** A Token needing 1 Coal can act sooner than one
 * needing 5, so under sustained shortage the *deep, expensive* chains the game
 * wants players to build are the ones that starve first — the opposite of the
 * pressure §6.2 intends. That is a consequence of D-127, not a bug in it, and it
 * is measured rather than guessed: {@link getStarvationStats} counts blocked
 * ticks per Token type so the first balance pass has data instead of a hunch.
 */

/** Blocked-tick counts per Token type, for the risk-13 measurement. */
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
 * Spend a Token's inputs. **Bank first, then the floor** (D-42).
 *
 * Deliberately atomic: it verifies the whole cost is payable before taking
 * anything. Spending half a recipe and then discovering the rest is gone would
 * destroy items for no output, which is the failure `CardPreflight` was
 * originally written to prevent — the rule survives the rework even though its
 * old home did not.
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

/** Record that a Token type could not run for want of inputs (risk 13). */
export function noteStarved(typeId) {
    starvation.set(typeId, (starvation.get(typeId) || 0) + 1);
}

/**
 * Blocked-tick counts per Token type.
 *
 * The first balance pass compares a cheap consumer against an expensive one
 * under the same shortage. If the expensive one starves disproportionately,
 * D-127 needs a rule that favours deep chains, or expensive steps need buffered
 * inputs — but that call should be made against numbers.
 */
export function getStarvationStats() {
    return Object.fromEntries(starvation);
}

/** Clear the measurement (between balance runs, and in tests). */
export function resetStarvationStats() {
    starvation.clear();
}

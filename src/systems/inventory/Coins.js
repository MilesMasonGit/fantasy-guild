// The guild's coins, and selling from the Bank

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { stackWorth } from '../../config/registries/itemCoins.js';
import { InventoryManager } from './InventoryManager.js';

/**
 * Coins are a whole number on the guild (`state.progress.coins`), not an item in the Bank. Selling
 * takes only the Bank's stack: worn copies stay worn, and a carried food, drink or potion reads the
 * Bank's count, so it shows empty until the Bank holds more.
 */

/** The guild's coins now. */
export function getCoins() {
    const n = Number(GameState.state?.progress?.coins);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Add `amount` coins (a whole number above 0; anything else adds nothing) and announce the count. */
export function addCoins(amount) {
    const n = Math.floor(Number(amount) || 0);
    const progress = GameState.state?.progress;
    if (n <= 0 || !progress) return getCoins();
    progress.coins = getCoins() + n;
    EventBus.publish(ENGINE_EVENTS.COINS_UPDATED, { coins: progress.coins, added: n });
    return progress.coins;
}

/**
 * Take `amount` coins, all or nothing: true when paid (0 always is), false, taking nothing, when
 * the guild holds fewer. Announces the new count.
 */
export function spendCoins(amount) {
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    const progress = GameState.state?.progress;
    if (n === 0) return true;
    if (!progress || getCoins() < n) return false;
    progress.coins = getCoins() - n;
    EventBus.publish(ENGINE_EVENTS.COINS_UPDATED, { coins: progress.coins, spent: n });
    return true;
}

/** What the Bank's stack of `itemId` would sell for: `{ count, coins }`. */
export function bankStackWorth(itemId) {
    const count = InventoryManager.getItemCount(itemId);
    return { count, coins: stackWorth(getItem(itemId), count) };
}

/** What the Bank's stacks of `itemIds` would sell for together: `{ stacks, count, coins }`. */
export function bankStacksWorth(itemIds) {
    let stacks = 0, count = 0, coins = 0;
    for (const id of new Set(itemIds || [])) {
        const worth = bankStackWorth(id);
        if (worth.count <= 0) continue;
        stacks++;
        count += worth.count;
        coins += worth.coins;
    }
    return { stacks, count, coins };
}

/** Take one item's whole stack out of the Bank; the coins it is worth, or null when none was held. */
function takeStack(itemId) {
    const { count, coins } = bankStackWorth(itemId);
    if (count <= 0 || !InventoryManager.removeItem(itemId, count)) return null;
    return coins;
}

/** Sell the Bank's whole stack of `itemId`: the coins it paid, or null when the Bank holds none. */
export function sellBankStack(itemId) {
    const coins = takeStack(itemId);
    if (coins == null) return null;
    addCoins(coins);
    return coins;
}

/** Sell the Bank's whole stacks of `itemIds`, announced once: `{ sold: itemId[], coins }`. */
export function sellBankStacks(itemIds) {
    const sold = [];
    let coins = 0;
    InventoryManager.batch(() => {
        for (const id of new Set(itemIds || [])) {
            const paid = takeStack(id);
            if (paid == null) continue;
            sold.push(id);
            coins += paid;
        }
    });
    addCoins(coins);
    return { sold, coins };
}

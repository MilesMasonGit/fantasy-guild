// the ledger's coins: an item's coin worth from its value, and a coin cost proposed from the guild's coin income

import { coinWorthOf } from '../../../../src/config/registries/itemCoins.js';

/**
 * Gold Coins in the CMS (brief 870 C3):
 *
 * - **Coin worth.** What one copy of an item sells for (`coinWorth`, read by the game's
 *   `itemCoins.coinWorthOf`) is its value in whole coins: the simulator's `value`, which Recalculate
 *   works out from the time it takes to make. Recalculate writes it (`sim/writeBack.js`); a number
 *   the author typed is kept while `sim.coinWorthPinned` is set. An item with no value and no pin
 *   has no worth (it sells for 0). The ledger reads the worth through the same rule, so its pace
 *   agrees with what the next Recalculate writes.
 * - **A proposed coin cost** is the coins one hero earns in the coin curve's minutes at the price's
 *   stage (`settings.coinCurve`, `pace.coinPrices`), times its rank for a Guild Hall rank, rounded
 *   down to two figures.
 *
 * Pure.
 */

/** Whether an item's coin worth is the author's (Recalculate keeps it as typed). */
export function isCoinWorthPinned(item) {
    return item?.sim?.coinWorthPinned === true;
}

/** An item's value as whole coins, or null when it has no value (an item nothing prices). */
export function coinWorthFromValue(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** What Recalculate writes as an item's `coinWorth`: its pinned number, else its value in coins; null for none. */
export function derivedCoinWorth(item) {
    if (!item) return null;
    if (isCoinWorthPinned(item)) return item.coinWorth == null ? null : coinWorthOf(item);
    return coinWorthFromValue(item.value);
}

/** The coins one copy sells for as the ledger reads it: {@link derivedCoinWorth}, 0 for none. */
export function ledgerCoinWorth(item) {
    return derivedCoinWorth(item) ?? 0;
}

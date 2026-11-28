// the ledger's coins: an item's coin worth from its value, and a coin cost proposed from the guild's coin income

import { coinWorthOf } from '../../../../src/config/registries/itemCoins.js';
import { coinsOf, shopCoinsOf, enemyCoinDropOf, stealCoinsOf } from '../../../../src/config/registries/coinCosts.js';

/**
 * Gold Coins in the CMS (brief 870 C3):
 *
 * - **Coin worth.** What one copy of an item sells for (`coinWorth`, read by the game's
 *   `itemCoins.coinWorthOf`) is its value in whole coins: the simulator's `value`, which Recalculate
 *   works out from the time it takes to make. Recalculate writes it (`sim/writeBack.js`) once the
 *   content uses coins ({@link coinsInPlay}); a number the author typed is kept while
 *   `sim.coinWorthPinned` is set. An item with no value and no pin has no worth (it sells for 0).
 *   The ledger reads the worth through the same rule, so its pace agrees with what Recalculate
 *   writes once coins are in play (the ledger reads coins only when a price asks some).
 *   ⚠️ Until then Recalculate leaves `coinWorth` alone: content with no coins round-trips through
 *   Recalculate and Sync byte for byte, and the coin pack that brings coin costs brings the sale
 *   prices with it.
 * - **A proposed coin cost** is the coins one hero earns in its coin curve's minutes at the price's
 *   stage, rounded down to two figures (`pace.coinPrices`): the everyday curve for a Shop Token or a
 *   Foundation (`settings.coinCurve`), the big one for settling a place (`settings.bigCoinCurve`).
 *   A Guild Hall rank's coins are on no curve: the payback check judges them with its items
 *   (BALANCE_RULES section 7).
 *
 * Pure.
 */

/**
 * Whether the content uses coins anywhere: a Shop Token's coins, an enemy's Coin drop or steal
 * table coins, a Guild Hall star rank's coins, or settling a ring of the world tables. Read from the
 * workspace's own records (`tokens`, `hallStars`, `world`).
 */
export function coinsInPlay({ tokens = {}, hallStars = {}, world = null } = {}) {
    for (const def of Object.values(tokens || {})) {
        if (def && (shopCoinsOf(def) > 0 || enemyCoinDropOf(def) > 0 || stealCoinsOf(def) > 0)) return true;
    }
    for (const star of Object.values(hallStars || {})) {
        if ((Array.isArray(star?.ranks) ? star.ranks : []).some(rank => coinsOf(rank?.coins) > 0)) return true;
    }
    const prices = world && typeof world === 'object' ? world.prices : null;
    return !!prices && typeof prices === 'object' && Object.values(prices).some(p => coinsOf(p?.coins) > 0);
}

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

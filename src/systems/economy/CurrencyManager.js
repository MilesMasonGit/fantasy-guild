// Fantasy Guild - Currency Manager
// Reads and writes the player's currency balances in GameState.

import { GameState } from '../../state/GameState.js';
import { logger } from '../../utils/Logger.js';
import { EventBus } from '../core/EventBus.js';

/**
 * CurrencyManager - the single place currency balances change.
 *
 * **Gold is currently the only currency the game has.** It is earned by
 * selling Tokens at the Bank and by Markets paying out (`BoardRunner` credits
 * an output entry carrying a `currency`), and spent on Guild Hall upgrades,
 * Cartographer maps and hero promotion.
 *
 * The API stays currency-agnostic — `BoardRunner` passes through whatever
 * currency id the content names, and `OUTPUT_CURRENCIES` in `tokenConstants.js`
 * is the list of ids that are legal there. Adding a second currency is a row in
 * that list plus a starting balance in `StateSchema`; nothing here needs to
 * change.
 *
 * Every change publishes `currency_changed` with `{ type, amount, delta,
 * source }`; the UI and the toast subscriber both listen for it.
 */
export const CurrencyManager = {
    /**
     * Get current amount of a specific currency
     * @param {string} currencyType - currency id, e.g. 'gold'
     * @returns {number}
     */
    getCurrency(currencyType) {
        return GameState.currency?.[currencyType] ?? 0;
    },

    /**
     * Add currency to the player's total
     * @param {string} currencyType - currency id, e.g. 'gold'
     * @param {number} amount - Amount to add
     * @param {string} source - Source of the currency
     * @returns {number} New total
     */
    addCurrency(currencyType, amount, source = 'unknown') {
        if (amount <= 0) return this.getCurrency(currencyType);

        const current = this.getCurrency(currencyType);
        const newTotal = current + amount;

        if (GameState.state?.currency) {
            GameState.state.currency[currencyType] = newTotal;
        }

        EventBus.publish('currency_changed', {
            type: currencyType,
            amount: newTotal,
            delta: amount,
            source
        });

        logger.debug('CurrencyManager', `+${amount} ${currencyType} from ${source} (Total: ${newTotal})`);
        return newTotal;
    },

    /**
     * Spend currency if affordable
     * @param {string} currencyType - currency id, e.g. 'gold'
     * @param {number} amount - Amount to spend
     * @param {string} purpose - What the currency is being spent on
     * @returns {boolean} True if successful
     */
    spendCurrency(currencyType, amount, purpose = 'unknown') {
        if (amount <= 0) return true;

        const current = this.getCurrency(currencyType);
        if (current < amount) {
            console.warn(`[CurrencyManager] Cannot spend ${amount} ${currencyType} (have ${current})`);
            return false;
        }

        const newTotal = current - amount;

        if (GameState.state?.currency) {
            GameState.state.currency[currencyType] = newTotal;
        }

        EventBus.publish('currency_changed', {
            type: currencyType,
            amount: newTotal,
            delta: -amount,
            source: purpose
        });

        logger.debug('CurrencyManager', `-${amount} ${currencyType} for ${purpose} (Total: ${newTotal})`);
        return true;
    },

    /**
     * Check if player can afford a cost
     * @param {string} currencyType 
     * @param {number} amount 
     * @returns {boolean}
     */
    canAffordCurrency(currencyType, amount) {
        return this.getCurrency(currencyType) >= amount;
    },

    // ==========================================
    // Gold Methods (Wrappers)
    // ==========================================

    getGold() {
        return this.getCurrency('gold');
    },

    addGold(amount, source = 'unknown') {
        return this.addCurrency('gold', amount, source);
    },

    spendGold(amount, purpose = 'unknown') {
        return this.spendCurrency('gold', amount, purpose);
    },

    canAffordGold(amount) {
        return this.canAffordCurrency('gold', amount);
    }
};

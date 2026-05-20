// Fantasy Guild - Currency Manager
// Manages Influence currency for recruitment and projects

import { GameState } from '../../state/GameState.js';
import { logger } from '../../utils/Logger.js';
import { EventBus } from '../core/EventBus.js';

/**
 * CurrencyManager - Handles Influence currency operations
 * 
 * Influence is used for:
 * - Recruiting heroes (cost scales with completed projects)
 * - Selecting Area Projects
 * 
 * Influence is gained from:
 * - Starting amount (31)
 * - Retiring heroes (based on level)
 */
export const CurrencyManager = {
    /**
     * Get current amount of a specific currency
     * @param {string} currencyType - e.g., 'influence' or 'gold'
     * @returns {number}
     */
    getCurrency(currencyType) {
        return GameState.currency?.[currencyType] ?? 0;
    },

    /**
     * Add currency to the player's total
     * @param {string} currencyType - e.g., 'influence' or 'gold'
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

        // Backwards compatibility for influence events
        if (currencyType === 'influence') {
            EventBus.publish('influence_changed', {
                amount: newTotal,
                delta: amount,
                source
            });
        }

        logger.debug('CurrencyManager', `+${amount} ${currencyType} from ${source} (Total: ${newTotal})`);
        return newTotal;
    },

    /**
     * Spend currency if affordable
     * @param {string} currencyType - e.g., 'influence' or 'gold'
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

        // Backwards compatibility for influence events
        if (currencyType === 'influence') {
            EventBus.publish('influence_changed', {
                amount: newTotal,
                delta: -amount,
                source: purpose
            });
        }

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
    // Legacy Influence Methods (Wrappers)
    // ==========================================
 
    getInfluence() {
        return this.getCurrency('influence');
    },
 
    addInfluence(amount, source = 'unknown') {
        return this.addCurrency('influence', amount, source);
    },
 
    spendInfluence(amount, purpose = 'unknown') {
        return this.spendCurrency('influence', amount, purpose);
    },
 
    canAfford(amount) {
        return this.canAffordCurrency('influence', amount);
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

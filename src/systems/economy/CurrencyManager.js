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
     * Get current Influence amount
     * @returns {number}
     */
    getInfluence() {
        return GameState.currency?.influence ?? 0;
    },

    /**
     * Add Influence to the player's total
     * @param {number} amount - Amount to add
     * @param {string} source - Source of the Influence (for logging/events)
     * @returns {number} New total
     */
    addInfluence(amount, source = 'unknown') {
        if (amount <= 0) return this.getInfluence();

        const current = this.getInfluence();
        const newTotal = current + amount;

        // Update state directly
        if (GameState.state?.currency) {
            GameState.state.currency.influence = newTotal;
        }

        EventBus.publish('influence_changed', {
            amount: newTotal,
            delta: amount,
            source
        });

        logger.debug('CurrencyManager', `+${amount} Influence from ${source} (Total: ${newTotal})`);
        return newTotal;
    },

    /**
     * Spend Influence if affordable
     * @param {number} amount - Amount to spend
     * @param {string} purpose - What the Influence is being spent on
     * @returns {boolean} True if successful
     */
    spendInfluence(amount, purpose = 'unknown') {
        if (amount <= 0) return true;

        const current = this.getInfluence();
        if (current < amount) {
            console.warn(`[CurrencyManager] Cannot spend ${amount} Influence (have ${current})`);
            return false;
        }

        const newTotal = current - amount;

        if (GameState.state?.currency) {
            GameState.state.currency.influence = newTotal;
        }

        EventBus.publish('influence_changed', {
            amount: newTotal,
            delta: -amount,
            source: purpose
        });

        logger.debug('CurrencyManager', `-${amount} Influence for ${purpose} (Total: ${newTotal})`);
        return true;
    },

    /**
     * Check if player can afford a cost
     * @param {number} amount 
     * @returns {boolean}
     */
    canAfford(amount) {
        return this.getInfluence() >= amount;
    }
};

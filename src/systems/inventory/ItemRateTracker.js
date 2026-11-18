import { createRollingRate } from '../core/rollingRate.js';

/**
 * ItemRateTracker
 * Specialized logic for calculating harvest/production throughput, over a sliding 5-minute window
 * of item gains and spending (spending as negative gains; `rollingRate.js`).
 */

const rate = createRollingRate({
    windowMs: 5 * 60 * 1000,
    // A first record with nothing before it is taken as made over at least this long.
    minMs: 30 * 1000
});

export const ItemRateTracker = {
    /**
     * Record a new item gain event
     * @param {string} itemId 
     * @param {number} amount 
     */
    recordGain(itemId, amount) {
        rate.record(itemId, amount);
    },

    /**
     * Record a new item loss event (as negative gain)
     * @param {string} itemId 
     * @param {number} amount 
     */
    recordLoss(itemId, amount) {
        this.recordGain(itemId, -amount);
    },

    /**
     * Calculate and return the estimated Items Per Hour (IPH)
     * @param {string} itemId 
     * @returns {number}
     */
    getRate(itemId) {
        return rate.perHour(itemId);
    },

    /**
     * What the window holds for an item, split: made (`gained`), spent (`spent`), and the net per
     * hour (the same figure as {@link getRate}). The item stubs' hover reads it.
     * @param {string} itemId
     * @returns {{gained: number, spent: number, perHour: number}}
     */
    getFlow(itemId) {
        let gained = 0;
        let spent = 0;
        for (const g of rate.entries(itemId)) {
            if (g.amount >= 0) gained += g.amount;
            else spent -= g.amount;
        }
        return { gained, spent, perHour: this.getRate(itemId) };
    },

    /**
     * Wipe all history caches (useful for game reset/load)
     */
    clearAll() {
        rate.clear();
    }
};

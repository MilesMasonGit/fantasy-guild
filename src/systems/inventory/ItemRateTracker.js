/**
 * ItemRateTracker
 * Specialized logic for calculating harvest/production throughput.
 * Stores a sliding 5-minute window of inventory gains.
 */

// Private state: Map of itemId -> Array of { amount, timestamp }
const history = new Map();
const WINDOW_MS = 5 * 60 * 1000; // 5 minute rolling window
const MIN_WINDOW_MS = 30 * 1000; // Minimum 30s for stable initial rate calculation

export const ItemRateTracker = {
    /**
     * Record a new item gain event
     * @param {string} itemId 
     * @param {number} amount 
     */
    recordGain(itemId, amount) {
        if (!history.has(itemId)) {
            history.set(itemId, []);
        }
        const gains = history.get(itemId);
        gains.push({ amount, timestamp: Date.now() });
        
        // Lazy cleanup for this specific item
        this.prune(itemId);
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
     * Remove data points older than WINDOW_MS
     * @param {string} itemId 
     */
    prune(itemId) {
        const gains = history.get(itemId);
        if (!gains) return;
        
        const now = Date.now();
        while (gains.length > 0 && (now - gains[0].timestamp) > WINDOW_MS) {
            gains.shift();
        }
        
        // If empty, clean up the map entry entirely
        if (gains.length === 0) {
            history.delete(itemId);
        }
    },

    /**
     * Calculate and return the estimated Items Per Hour (IPH)
     * @param {string} itemId 
     * @returns {number}
     */
    getRate(itemId) {
        this.prune(itemId);
        const gains = history.get(itemId);
        
        if (!gains || gains.length === 0) return 0;

        // Sum up total amount in current window
        const totalAmount = gains.reduce((sum, g) => sum + g.amount, 0);
        
        // Calculate duration: Either the actual elapsed time in the window 
        // or a minimum safe window to prevent massive spikes on the first gain.
        const first = gains[0].timestamp;
        const now = Date.now();
        const durationMs = Math.max(now - first, MIN_WINDOW_MS);
        const durationHours = durationMs / (1000 * 60 * 60);
        
        return totalAmount / durationHours;
    },

    /**
     * Wipe all history caches (useful for game reset/load)
     */
    clearAll() {
        history.clear();
    }
};

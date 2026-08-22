/**
 * XpRateTracker
 * Calculates rolling XP gain rates and estimated time to next level per hero & skill.
 * Stores a sliding 5-minute window of XP gains.
 */

const history = new Map(); // key: `${heroId}:${skillId}` -> [{ amount, timestamp }]
const WINDOW_MS = 5 * 60 * 1000; // 5-minute rolling window
const MIN_WINDOW_MS = 15 * 1000; // Minimum 15s to smooth initial bursts

function makeKey(heroId, skillId) {
    return `${heroId}:${skillId}`;
}

export const XpRateTracker = {
    /**
     * Record a skill XP gain event
     * @param {string} heroId
     * @param {string} skillId
     * @param {number} amount
     */
    recordGain(heroId, skillId, amount) {
        if (!heroId || !skillId || !amount || amount <= 0) return;
        const key = makeKey(heroId, skillId);
        if (!history.has(key)) {
            history.set(key, []);
        }
        const entries = history.get(key);
        entries.push({ amount, timestamp: Date.now() });
        this.prune(key);
    },

    /**
     * Prune expired entries older than WINDOW_MS
     * @param {string} key
     */
    prune(key) {
        const entries = history.get(key);
        if (!entries) return;
        const now = Date.now();
        while (entries.length > 0 && (now - entries[0].timestamp) > WINDOW_MS) {
            entries.shift();
        }
        if (entries.length === 0) {
            history.delete(key);
        }
    },

    /**
     * Calculate and return estimated XP per hour (XP/hr)
     * @param {string} heroId
     * @param {string} skillId
     * @returns {number}
     */
    getRate(heroId, skillId) {
        const key = makeKey(heroId, skillId);
        this.prune(key);
        const entries = history.get(key);
        if (!entries || entries.length === 0) return 0;

        const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
        const first = entries[0].timestamp;
        const now = Date.now();
        const durationMs = Math.max(now - first, MIN_WINDOW_MS);
        const durationHours = durationMs / (1000 * 60 * 60);

        return totalAmount / durationHours;
    },

    /**
     * Estimated time in seconds to gain `xpRemaining` at current XP/hr rate.
     * Returns null if rate is 0 or xpRemaining <= 0.
     * @param {string} heroId
     * @param {string} skillId
     * @param {number} xpRemaining
     * @returns {number|null}
     */
    getTimeToNextLevelSeconds(heroId, skillId, xpRemaining) {
        if (xpRemaining <= 0) return 0;
        const rate = this.getRate(heroId, skillId);
        if (rate <= 0) return null;
        return (xpRemaining / rate) * 3600;
    },

    /**
     * Format a seconds duration into human-readable shorthand (e.g. "12m 30s", "1h 15m")
     * @param {number|null} totalSeconds
     * @returns {string}
     */
    formatDuration(totalSeconds) {
        if (totalSeconds == null || totalSeconds === Infinity || isNaN(totalSeconds)) return '--';
        if (totalSeconds <= 0) return 'Ready';
        const secs = Math.round(totalSeconds);
        if (secs < 60) return `${secs}s`;
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        if (mins < 60) return `${mins}m ${remSecs}s`;
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        if (hours < 24) return `${hours}h ${remMins}m`;
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        return `${days}d ${remHours}h`;
    },

    /**
     * Clear all recorded history (e.g. for tests / session resets)
     */
    clearAll() {
        history.clear();
    }
};

export default XpRateTracker;

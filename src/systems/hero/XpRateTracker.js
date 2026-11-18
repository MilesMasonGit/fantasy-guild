import { createRollingRate } from '../core/rollingRate.js';

/**
 * XpRateTracker
 * Calculates rolling XP gain rates and estimated time to next level per hero & skill, over a
 * sliding 5-minute window of XP gains (`rollingRate.js`).
 */

const rate = createRollingRate({
    windowMs: 5 * 60 * 1000,
    // A first gain with nothing before it is taken as earned over at least this long.
    minMs: 15 * 1000
});

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
        rate.record(makeKey(heroId, skillId), amount);
    },

    /**
     * Calculate and return estimated XP per hour (XP/hr)
     * @param {string} heroId
     * @param {string} skillId
     * @returns {number}
     */
    getRate(heroId, skillId) {
        return rate.perHour(makeKey(heroId, skillId));
    },

    /**
     * Estimated time in seconds to gain `xpRemaining` at current XP/hr rate.
     * Returns 0 if xpRemaining <= 0, and null if the rate is 0.
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
        rate.clear();
    }
};

// Fantasy Guild - Time Manager
// Phase 4: Core Systems

import { logger } from '../../utils/Logger.js';
import { MAX_TICK_DELTA_MS } from '../../config/loopConstants.js';

/**
 * TimeManager - Tracks game time and delta between ticks
 * 
 * Responsibilities:
 * - Track real time elapsed
 * - Calculate delta time between updates
 * - Handle pause/resume
 * - Track total game time
 */

class TimeManagerClass {
    constructor() {
        this.lastTickTime = 0;
        this.deltaTime = 0;
        this.gameTime = 0;        // Total game time in milliseconds
        this.isPaused = false;
        this.pausedAt = null;
        this.timeScale = 1.0;     // For speed adjustments (future feature)
        /**
         * Game-time this tick could not deliver because it exceeded
         * MAX_TICK_DELTA_MS. Read and zeroed by `GameLoop` via
         * `consumeOverflow()`, which hands it to the Time Bank (CR2-041).
         */
        this.overflowMs = 0;
    }

    /**
     * Initialize the time manager
     * @param {number} savedGameTime - Game time from save data (optional)
     */
    init(savedGameTime = 0) {
        this.lastTickTime = Date.now();
        this.gameTime = savedGameTime;
        this.deltaTime = 0;
        this.overflowMs = 0;
        this.isPaused = false;
    }

    /**
     * Update time tracking - called at start of each tick.
     *
     * The returned delta is CLAMPED to `MAX_TICK_DELTA_MS` (CR2-041). Without
     * that clamp a sleeping laptop, a suspended tab or a throttled timer hands
     * the next tick the whole gap, and every handler treats it as time played:
     * an 8-hour lid-shut added 8 hours to both `meta.totalPlaytime` and
     * `time.gameTimeMs` in one tick while the board produced nothing.
     *
     * The clipped remainder is not thrown away — it is parked on
     * `overflowMs` for `GameLoop` to route into the Time Bank (owner decision
     * 4, 2026-08-19). ⚠ The Bank's spend UI is switched off today (CR2-141),
     * so this earns the player nothing yet, deliberately: the accounting is
     * correct for when the Bank returns.
     *
     * @returns {number} Delta time in milliseconds, at most MAX_TICK_DELTA_MS
     */
    update() {
        const now = Date.now();

        if (this.isPaused) {
            this.deltaTime = 0;
            return 0;
        }

        // Clamp in GAME time, after the time-scale, because the 1000 ms ceiling
        // is a property of the board's cycle floor, not of the wall clock.
        const scaled = (now - this.lastTickTime) * this.timeScale;
        this.deltaTime = Math.min(scaled, MAX_TICK_DELTA_MS);
        this.overflowMs += scaled - this.deltaTime;
        this.lastTickTime = now;
        this.gameTime += this.deltaTime;

        return this.deltaTime;
    }

    /**
     * Take the accumulated overflow, zeroing it. Called once per tick by
     * `GameLoop`, which publishes it for the Time Bank to accrue.
     * @returns {number} Un-delivered game time in milliseconds
     */
    consumeOverflow() {
        const overflow = this.overflowMs;
        this.overflowMs = 0;
        return overflow;
    }

    /**
     * Get the delta time from the last update
     * @returns {number} Delta time in milliseconds
     */
    getDelta() {
        return this.deltaTime;
    }

    /**
     * Get delta time in seconds (convenience method)
     * @returns {number} Delta time in seconds
     */
    getDeltaSeconds() {
        return this.deltaTime / 1000;
    }

    /**
     * Get total game time
     * @returns {number} Total game time in milliseconds
     */
    getGameTime() {
        return this.gameTime;
    }

    /**
     * Pause the game
     */
    pause() {
        if (!this.isPaused) {
            this.isPaused = true;
            this.pausedAt = Date.now();
            logger.info('TimeManager', 'Game paused');
        }
    }

    /**
     * Resume the game
     */
    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            // Adjust lastTickTime to prevent time jump
            if (this.pausedAt) {
                this.lastTickTime = Date.now();
            }
            this.pausedAt = null;
            logger.info('TimeManager', 'Game resumed');
        }
    }

    /**
     * Toggle pause state
     * @returns {boolean} New pause state
     */
    togglePause() {
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
        return this.isPaused;
    }

    /**
     * Check if game is paused
     * @returns {boolean}
     */
    getIsPaused() {
        return this.isPaused;
    }

    /**
     * Set time scale (for speed adjustments)
     * @param {number} scale - Time multiplier (1.0 = normal)
     */
    setTimeScale(scale) {
        this.timeScale = Math.max(0, scale); // Allow up to x100 for dev tools
    }

    /**
     * Get current time scale
     * @returns {number}
     */
    getTimeScale() {
        return this.timeScale;
    }

    /**
     * Get serializable state for saving
     * @returns {Object}
     */
    serialize() {
        return {
            gameTimeMs: this.gameTime,
            isPaused: this.isPaused
        };
    }
}

// Export singleton instance
export const TimeManager = new TimeManagerClass();

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
        this.timeScale = 1.0;     // Speed multiplier; set by the Time Bank
        /**
         * Game-time this tick could not deliver because it exceeded
         * MAX_TICK_DELTA_MS. Read and zeroed by `GameLoop` via
         * `consumeOverflow()`, which hands it to the catch-up (`CatchUp`).
         */
        this.overflowMs = 0;
    }

    /**
     * Initialize the time manager
     * @param {number} savedGameTime - Game time from save data (optional)
     */
    init(savedGameTime = 0) {
        // `performance.now()`, not `Date.now()` — see `update()`.
        this.lastTickTime = performance.now();
        this.gameTime = savedGameTime;
        this.deltaTime = 0;
        this.overflowMs = 0;
        this.isPaused = false;
    }

    /**
     * Update time tracking - called at start of each tick.
     *
     * Reads `performance.now()`, not `Date.now()`: the OS can step the wall clock
     * (manual change, NTP, DST), which made working Tokens' `cycleElapsedMs` go
     * negative so `BoardRunner` replayed `CYCLE_START` every tick. The wall clock
     * stays for *time away* (`SaveManager`'s `savedAt`, the catch-up on load),
     * which only it can answer.
     *
     * The returned delta is CLAMPED to `MAX_TICK_DELTA_MS` (a sleeping laptop or
     * suspended tab would otherwise hand the next tick the whole gap as time
     * played) and FLOORED at 0 (a negative delta must never reach a handler).
     * The clipped remainder is parked on `overflowMs` for `GameLoop` to hand to
     * the catch-up, which plays it.
     *
     * @returns {number} Delta time in milliseconds, at most MAX_TICK_DELTA_MS, at least 0
     */
    update() {
        const now = performance.now();

        if (this.isPaused) {
            this.deltaTime = 0;
            return 0;
        }

        // Clamp in GAME time, after the time-scale, because the 1000 ms ceiling
        // is a property of the board's cycle floor, not of the wall clock.
        // Floor at 0 first so a backward step can neither produce a negative delta
        // nor subtract from `overflowMs` below.
        const scaled = Math.max(0, (now - this.lastTickTime) * this.timeScale);
        this.deltaTime = Math.min(scaled, MAX_TICK_DELTA_MS);
        this.overflowMs += scaled - this.deltaTime;
        this.lastTickTime = now;
        this.gameTime += this.deltaTime;

        return this.deltaTime;
    }

    /**
     * Take the accumulated overflow, zeroing it. Called once per tick by
     * `GameLoop`, which publishes it for the catch-up to play.
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
            // Adjust lastTickTime to prevent time jump. Must match update()'s
            // clock — Date.now() here would hand the next update() a
            // huge or negative gap between two different clocks.
            if (this.pausedAt) {
                this.lastTickTime = performance.now();
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
        this.timeScale = Math.max(0, scale);
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

// Fantasy Guild - Time Manager
// Phase 4: Core Systems

import { EventBus } from './EventBus.js';
import { logger } from '../../utils/Logger.js';

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
    }

    /**
     * Initialize the time manager
     * @param {number} savedGameTime - Game time from save data (optional)
     */
    init(savedGameTime = 0) {
        this.lastTickTime = Date.now();
        this.gameTime = savedGameTime;
        this.deltaTime = 0;
        this.isPaused = false;
    }

    /**
     * Update time tracking - called at start of each tick
     * @returns {number} Delta time in milliseconds
     */
    update() {
        const now = Date.now();

        if (this.isPaused) {
            this.deltaTime = 0;
            return 0;
        }

        this.deltaTime = (now - this.lastTickTime) * this.timeScale;
        this.lastTickTime = now;
        this.gameTime += this.deltaTime;

        return this.deltaTime;
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
        this.timeScale = Math.max(0, Math.min(10, scale)); // Clamp 0-10x
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

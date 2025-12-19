// Fantasy Guild - GameLoop
// Phase 4: Core Systems

import { TimeManager } from './TimeManager.js';
import { EventBus } from './EventBus.js';
import { logger } from '../../utils/Logger.js';
import { TICK_INTERVAL_MS } from '../../config/constants.js';

/**
 * GameLoop - Main game tick loop
 * 
 * Runs at configurable interval (default 100ms = 10 ticks/second).
 * Calls registered tick handlers in order each tick.
 */

class GameLoopClass {
    constructor() {
        this.tickInterval = TICK_INTERVAL_MS;  // Import from constants.js
        this.isRunning = false;
        this.tickCount = 0;
        this.intervalId = null;

        /** @type {Array<{name: string, handler: Function, priority: number}>} */
        this.tickHandlers = [];
    }

    /**
     * Start the game loop
     */
    start() {
        if (this.isRunning) {
            console.warn('GameLoop: Already running');
            return;
        }

        this.isRunning = true;
        TimeManager.init();

        this.intervalId = setInterval(() => this.tick(), this.tickInterval);

        logger.info('GameLoop', `Started (${1000 / this.tickInterval} ticks/second)`);
        EventBus.publish('game_loop_started');
    }

    /**
     * Stop the game loop
     */
    stop() {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        logger.info('GameLoop', 'Stopped');
        EventBus.publish('game_loop_stopped');
    }

    /**
     * Perform one game tick
     */
    tick() {
        if (!this.isRunning) return;

        // Update time tracking
        const delta = TimeManager.update();

        // Skip processing if paused
        if (TimeManager.getIsPaused()) return;

        this.tickCount++;

        // Call all tick handlers in priority order
        // Note: delta is in MILLISECONDS for consistency across all systems
        for (const { name, handler } of this.tickHandlers) {
            try {
                handler(delta, this.tickCount);  // Pass delta in milliseconds
            } catch (error) {
                console.error(`GameLoop: Error in tick handler "${name}"`, error);
            }
        }

        // Publish tick event (for debugging/monitoring)
        EventBus.publish('game_tick', {
            tickCount: this.tickCount,
            delta,
            gameTime: TimeManager.getGameTime()
        });
    }

    /**
     * Register a tick handler
     * @param {string} name - Handler name (for debugging)
     * @param {Function} handler - Function to call each tick (delta, tickCount)
     * @param {number} priority - Lower = earlier (default 100)
     */
    onTick(name, handler, priority = 100) {
        this.tickHandlers.push({ name, handler, priority });
        // Sort by priority (lower first)
        this.tickHandlers.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Remove a tick handler by name
     * @param {string} name - Handler name
     */
    offTick(name) {
        this.tickHandlers = this.tickHandlers.filter(h => h.name !== name);
    }

    /**
     * Set the tick interval
     * @param {number} ms - Milliseconds between ticks
     */
    setTickInterval(ms) {
        this.tickInterval = Math.max(16, Math.min(1000, ms)); // Clamp 16ms-1000ms

        // Restart if running
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }

    /**
     * Get current tick count
     * @returns {number}
     */
    getTickCount() {
        return this.tickCount;
    }

    /**
     * Check if loop is running
     * @returns {boolean}
     */
    getIsRunning() {
        return this.isRunning;
    }

    /**
     * Force a single tick (for testing)
     */
    forceTick() {
        this.tick();
    }
}

// Export singleton instance
export const GameLoop = new GameLoopClass();

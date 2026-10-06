import { TimeManager } from './TimeManager.js';
import { EventBus } from './EventBus.js';
import { logger } from '../../utils/Logger.js';
import { TICK_INTERVAL_MS } from '../../config/loopConstants.js';
import { ENGINE_EVENTS } from './engineEvents.js';

/**
 * GameLoop - Main game tick loop. Calls registered tick handlers in order each tick.
 */

class GameLoopClass {
    constructor() {
        this.tickInterval = TICK_INTERVAL_MS;
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
    }

    /**
     * Perform one game tick
     */
    tick() {
        if (!this.isRunning) return;

        // Update time tracking. `delta` is clamped to MAX_TICK_DELTA_MS.
        const delta = TimeManager.update();

        if (TimeManager.getIsPaused()) return;

        // Time the clamp refused to deliver goes to the Time Bank rather than being
        // discarded. Published, not called, so the clock keeps no dependency on the
        // bank. Fires only after a real gap (a sleep, a suspend, a throttled timer).
        const overflow = TimeManager.consumeOverflow();
        if (overflow > 0) {
            EventBus.publish(ENGINE_EVENTS.TIME_OVERFLOW, { overflowMs: overflow });
        }

        this.runHandlers(delta);
    }

    /**
     * Run every registered tick handler once with an explicit `delta`, and
     * count it as a tick. This is the body of `tick()` minus the wall clock:
     * `tick()` measures the delta, this delivers it. Exposed so a dev tool
     * (`DevTools.advanceTime`) can fast-forward the whole game by feeding the
     * same handlers synthetic deltas — anything that advances by `delta`
     * moves with it.
     * @param {number} delta - Milliseconds of game time this step represents
     */
    runHandlers(delta) {
        this.tickCount++;

        // Note: delta is in MILLISECONDS for consistency across all systems
        for (const { name, handler } of this.tickHandlers) {
            try {
                handler(delta, this.tickCount);  // Pass delta in milliseconds
            } catch (error) {
                console.error(`GameLoop: Error in tick handler "${name}"`, error);
            }
        }
    }

    /**
     * Register a tick handler
     * @param {string} name - Handler name (for debugging)
     * @param {Function} handler - Function to call each tick (delta, tickCount)
     * @param {number} priority - Lower = earlier (default 100)
     */
    onTick(name, handler, priority = 100) {
        this.tickHandlers.push({ name, handler, priority });
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
        this.tickInterval = Math.max(16, Math.min(1000, ms));

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
